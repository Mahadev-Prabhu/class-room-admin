import { ref, get, runTransaction, set, remove, update } from "firebase/database";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth, database, firebaseConfig } from "./firebase";
import {
  TeacherUser,
  StudentUser,
  FirebaseUser,
  TeacherListItem,
  StudentListItem,
  DashboardStats,
  ClassCode,
  Admin,
  AdminTeacher,
} from "./types";
import { formatDisplayName } from "./utils";

// Helper to check if database is configured
function getDatabase() {
  if (!database) {
    throw new Error("Firebase database not configured");
  }
  return database;
}

function isString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStudentUser(user: FirebaseUser): user is StudentUser {
  return user.is_teacher === false && !user.role;
}

function adminTeacherToListItem(
  teacher: AdminTeacher,
  teacherUser: TeacherUser
): TeacherListItem {
  return {
    uid: teacher.uid,
    name: formatDisplayName(teacherUser.teacher_details?.teacher_name) || "Unknown",
    email: teacherUser.sign_in_details?.sign_in_email || "Unknown",
    school: formatDisplayName(teacherUser.teacher_details?.teacher_school) || "Unknown",
    teacherCode: teacherUser.teacher_code || teacher.teacher_code,
    studentCount: countTeacherStudents(teacherUser),
    lastSignIn: teacherUser.sign_in_details?.sign_in_time || "Never",
    classAssignmentsCount: countTeacherClassAssignments(teacherUser),
    individualAssignmentsCount: countTeacherIndividualAssignments(teacherUser),
  };
}

function countTeacherStudents(teacher: TeacherUser) {
  if (!teacher.students) {
    return 0;
  }

  return Object.values(teacher.students).reduce(
    (count, children) => count + Object.keys(children || {}).length,
    0
  );
}

function countTeacherClassAssignments(teacher?: TeacherUser) {
  return teacher?.assigned_to_class ? Object.keys(teacher.assigned_to_class).length : 0;
}

function countTeacherIndividualAssignments(teacher?: TeacherUser) {
  if (!teacher?.students) {
    return 0;
  }

  return Object.values(teacher.students).reduce(
    (total, children) =>
      total +
      Object.values(children || {}).reduce(
        (childTotal, link) => childTotal + Object.keys(link.assigned || {}).length,
        0
      ),
    0
  );
}

function getTeacherStudentCounts(users: Record<string, FirebaseUser>) {
  const counts = {
    byUid: new Map<string, number>(),
    byCode: new Map<string, number>(),
  };

  for (const [uid, user] of Object.entries(users)) {
    if (user.is_teacher !== true) {
      continue;
    }

    const teacher = user as TeacherUser;
    const studentCount = countTeacherStudents(teacher);
    counts.byUid.set(uid, studentCount);

    if (teacher.teacher_code) {
      counts.byCode.set(teacher.teacher_code, studentCount);
    }
  }

  return counts;
}

function getTeacherSchoolAdminMap(users: Record<string, FirebaseUser>) {
  const schoolAdminByTeacherCode = new Map<string, string>();

  for (const [uid, user] of Object.entries(users)) {
    const adminUser = user as Partial<Admin>;

    if (adminUser.role !== "school_admin" || !adminUser.teachers) {
      continue;
    }

    for (const teacher of Object.values(adminUser.teachers)) {
      if (teacher.teacher_code && !schoolAdminByTeacherCode.has(teacher.teacher_code)) {
        schoolAdminByTeacherCode.set(teacher.teacher_code, uid);
      }
    }
  }

  return schoolAdminByTeacherCode;
}

function formatTeacherCodeDate(date?: string | null) {
  if (!date) {
    return null;
  }

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
}

function parseTeacherCodeDate(date?: string | null) {
  if (!date) {
    return undefined;
  }

  if (date.includes("-")) {
    return date;
  }

  const [day, month, year] = date.split("/");
  if (!year || !month || !day) {
    return date;
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function removeUndefinedValues<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as Partial<T>;
}

// Fetch all users from Firebase
export async function fetchAllUsers(): Promise<Record<string, FirebaseUser>> {
  const db = getDatabase();
  const usersRef = ref(db, "users");
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return {};
}

// Fetch all teachers
export async function fetchTeachers(): Promise<TeacherListItem[]> {
  const users = await fetchAllUsers();
  const studentCounts = getTeacherStudentCounts(users);
  const teachers: TeacherListItem[] = [];

  for (const [uid, user] of Object.entries(users)) {
    if (user.is_teacher === true) {
      const teacher = user as TeacherUser;
      const teacherCode = teacher.teacher_code || "";

      teachers.push({
        uid,
        name: formatDisplayName(teacher.teacher_details?.teacher_name) || "Unknown",
        email: teacher.sign_in_details?.sign_in_email || "Unknown",
        school: formatDisplayName(teacher.teacher_details?.teacher_school) || "Unknown",
        teacherCode,
        studentCount: studentCounts.byUid.get(uid) || 0,
        lastSignIn: teacher.sign_in_details?.sign_in_time || "Never",
        classAssignmentsCount: countTeacherClassAssignments(teacher),
        individualAssignmentsCount: countTeacherIndividualAssignments(teacher),
      });
    }
  }

  return teachers.sort((a, b) => a.name.localeCompare(b.name));
}

type StudentScope = {
  teacherCodes?: Set<string>;
  teacherUids?: Set<string>;
};

function isChildInScope(
  child: StudentUser["children"][string],
  scope?: StudentScope
) {
  if (!scope) {
    return true;
  }

  return (
    scope.teacherCodes?.has(child.teacher_code || "") ||
    scope.teacherUids?.has(child.teacher_uid || "")
  );
}

// Fetch all students (parents)
export async function fetchStudents(scope?: StudentScope): Promise<StudentListItem[]> {
  const users = await fetchAllUsers();
  const students: StudentListItem[] = [];

  for (const [uid, user] of Object.entries(users)) {
    if (isStudentUser(user)) {
      const student = user as StudentUser;
      const children: StudentListItem["children"] = [];

      if (student.children) {
        for (const [childId, child] of Object.entries(student.children)) {
          if (!isChildInScope(child, scope)) {
            continue;
          }

          const totalPoints = child.rewards
            ? Object.values(child.rewards).reduce(
                (sum, reward) => sum + parseInt(reward.points || "0"),
                0
              )
            : 0;

          children.push({
            id: childId,
            name: formatDisplayName(child.child_name) || "Unknown",
            age: child.child_age || "Unknown",
            booksRead: child.number_of_books_read || 0,
            totalPoints,
            resourcesCount: child["my-resources"]
              ? Object.keys(child["my-resources"]).length
              : 0,
            teacherCode: child.teacher_code || "",
            teacherUid: child.teacher_uid || "",
            teacherName: undefined, // Will be populated later if needed
          });
        }
      }

      if (scope && children.length === 0) {
        continue;
      }

      students.push({
        uid,
        parentEmail: student.sign_in_details?.sign_in_email || "Unknown",
        children,
        lastUsed: student.last_used || "Never",
      });
    }
  }

  return students.sort((a, b) => a.parentEmail.localeCompare(b.parentEmail));
}

export async function fetchAdminStudents(adminUid: string): Promise<StudentListItem[]> {
  const adminTeachers = await fetchAdminTeachers(adminUid);
  const teacherCodes = new Set(
    [
      ...adminTeachers.map((teacher) => teacher.teacherCode),
    ].filter(isString)
  );
  const teacherUids = new Set(
    [
      ...adminTeachers.map((teacher) => teacher.uid),
    ].filter(isString)
  );

  return fetchStudents({ teacherCodes, teacherUids });
}

// Fetch students by teacher code
export async function fetchStudentsByTeacherCode(teacherCode: string): Promise<StudentListItem[]> {
  const allStudents = await fetchStudents();
  
  return allStudents.filter((student) =>
    student.children.some((child) => child.teacherCode === teacherCode)
  );
}

// Get dashboard statistics
export async function fetchDashboardStats(
  admin?: Pick<Admin, "uid" | "role">
): Promise<DashboardStats> {
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();
  const isSuperAdmin = admin?.role === "super_admin";
  const adminTeachers = !isSuperAdmin && admin
    ? await fetchAdminTeachers(admin.uid)
    : [];
  const assignedTeacherCodes = new Set(adminTeachers.map((teacher) => teacher.teacherCode));
  const scopedClassCodes = isSuperAdmin || !admin
    ? classCodes
    : classCodes.filter(
        (classCode) =>
          classCode.school_admin_uid === admin.uid ||
          assignedTeacherCodes.has(classCode.code)
      );
  const scopedTeacherCodes = new Set(
    [
      ...scopedClassCodes.map((classCode) => classCode.code),
      ...adminTeachers.map((teacher) => teacher.teacherCode),
    ].filter(isString)
  );
  const scopedTeacherUids = new Set(
    [
      ...scopedClassCodes.map((classCode) => classCode.teacher_uid),
      ...adminTeachers.map((teacher) => teacher.uid),
    ].filter(isString)
  );
  const scopedTeacherKeys = new Set(
    [
      ...adminTeachers.map((teacher) => teacher.uid || teacher.teacherCode),
      ...scopedClassCodes.map((classCode) => classCode.teacher_uid || classCode.code),
    ].filter(isString)
  );

  let totalTeachers = 0;
  let totalStudents = 0;
  let totalChildren = 0;
  let totalBooksRead = 0;
  let activeToday = 0;

  const today = new Date().toISOString().split("T")[0];

  for (const [uid, user] of Object.entries(users)) {
    if (user.is_teacher === true) {
      const teacher = user as TeacherUser;
      const isScopedTeacher =
        isSuperAdmin ||
        scopedTeacherCodes.has(teacher.teacher_code) ||
        scopedTeacherUids.has(uid);

      if (isScopedTeacher) {
        if (isSuperAdmin) {
          totalTeachers++;
        }

        if (teacher.sign_in_details?.sign_in_time?.startsWith(today)) {
          activeToday++;
        }
      }
    } else if (isStudentUser(user)) {
      const student = user as StudentUser;
      let hasScopedChild = false;
      
      if (student.children) {
        for (const child of Object.values(student.children)) {
          const isScopedChild =
            isSuperAdmin ||
            scopedTeacherCodes.has(child.teacher_code || "") ||
            scopedTeacherUids.has(child.teacher_uid || "");

          if (isScopedChild) {
            hasScopedChild = true;
            totalChildren++;
            totalBooksRead += child.number_of_books_read || 0;
          }
        }
      }
      
      if (hasScopedChild || isSuperAdmin) {
        totalStudents++;
      }

      if ((hasScopedChild || isSuperAdmin) && student.last_used === today) {
        activeToday++;
      }
    }
  }

  if (!isSuperAdmin) {
    totalTeachers = scopedTeacherKeys.size;
  }

  return {
    totalTeachers,
    totalStudents,
    totalChildren,
    activeToday,
    totalBooksRead,
    classCodes: scopedClassCodes.length,
  };
}

// Teacher Codes management
export async function fetchClassCodes(): Promise<ClassCode[]> {
  const [users, db] = await Promise.all([fetchAllUsers(), Promise.resolve(getDatabase())]);
  const schoolAdminByTeacherCode = getTeacherSchoolAdminMap(users);
  const teacherCodesRef = ref(db, "teacher_codes");
  const snapshot = await get(teacherCodesRef);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.entries(data).map(([code, value]) => {
      const teacherCode = value as {
        expiry_date?: string;
        students_limits?: number;
        used_by?: string;
        school_admin_uid?: string;
        valid_days_after_applied?: number;
      };
      const schoolAdminUid =
        teacherCode.school_admin_uid || schoolAdminByTeacherCode.get(code);
      const schoolAdmin = schoolAdminUid
        ? (users[schoolAdminUid] as Partial<Admin> | undefined)
        : undefined;
      const teacherUser = teacherCode.used_by
        ? (users[teacherCode.used_by] as TeacherUser | undefined)
        : undefined;

      if (!teacherCode.school_admin_uid && schoolAdminUid) {
        update(ref(db, `teacher_codes/${code}`), {
          school_admin_uid: schoolAdminUid,
        });
      }

      return {
        code,
        teacher_uid: teacherCode.used_by,
        teacher_name: formatDisplayName(teacherUser?.teacher_details?.teacher_name),
        teacher_email: teacherUser?.sign_in_details?.sign_in_email,
        school_admin_uid: schoolAdminUid,
        school_admin_name:
          formatDisplayName(schoolAdmin?.school_details?.school_name) ||
          formatDisplayName(schoolAdmin?.sign_in_details?.name) ||
          formatDisplayName(schoolAdmin?.name),
        expiration_date: parseTeacherCodeDate(teacherCode.expiry_date),
        student_limit: teacherCode.students_limits,
        created_at: "",
      };
    });
  }
  
  return [];
}

export async function createClassCode(classCode: ClassCode): Promise<void> {
  const db = getDatabase();
  const teacherCodeRef = ref(db, `teacher_codes/${classCode.code}`);
  await update(teacherCodeRef, {
    ...(classCode.expiration_date !== undefined
      ? { expiry_date: formatTeacherCodeDate(classCode.expiration_date) }
      : {}),
    ...(classCode.student_limit !== undefined
      ? { students_limits: classCode.student_limit }
      : {}),
    ...(classCode.teacher_uid ? { used_by: classCode.teacher_uid } : {}),
    ...(classCode.school_admin_uid ? { school_admin_uid: classCode.school_admin_uid } : {}),
    valid_days_after_applied: 365,
  });
}

export async function addTeacherToAdmin(
  adminUid: string,
  teacher: AdminTeacher
): Promise<void> {
  const db = getDatabase();
  const teacherRef = ref(db, `users/${adminUid}/teachers/${teacher.uid}`);
  await set(teacherRef, removeUndefinedValues(teacher));
}

export async function fetchAdminTeachers(adminUid: string): Promise<TeacherListItem[]> {
  const [users, db] = await Promise.all([fetchAllUsers(), Promise.resolve(getDatabase())]);
  const teachersRef = ref(db, `users/${adminUid}/teachers`);
  const snapshot = await get(teachersRef);

  if (!snapshot.exists()) {
    return [];
  }

  const studentCounts = getTeacherStudentCounts(users);

  return Object.entries(snapshot.val())
    .flatMap(([, value]) => {
      const adminTeacher = value as AdminTeacher;
      const teacherUser = users[adminTeacher.uid];

      if (!teacherUser || teacherUser.is_teacher !== true) {
        return [];
      }

      const teacher = adminTeacherToListItem(adminTeacher, teacherUser as TeacherUser);

      return {
        ...teacher,
        studentCount: studentCounts.byUid.get(teacher.uid) ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateClassCode(
  code: string,
  updates: Partial<Record<keyof ClassCode, string | number | null>>
): Promise<void> {
  const db = getDatabase();
  const teacherCodeUpdates: Record<string, string | number | null> = {};

  if ("expiration_date" in updates) {
    teacherCodeUpdates.expiry_date =
      typeof updates.expiration_date === "string"
        ? formatTeacherCodeDate(updates.expiration_date)
        : null;
  }

  if ("student_limit" in updates) {
    teacherCodeUpdates.students_limits = updates.student_limit ?? null;
  }

  if ("teacher_uid" in updates) {
    teacherCodeUpdates.used_by = updates.teacher_uid ?? null;
  }

  if ("school_admin_uid" in updates) {
    teacherCodeUpdates.school_admin_uid = updates.school_admin_uid ?? null;
  }

  const teacherCodeRef = ref(db, `teacher_codes/${code}`);
  await update(teacherCodeRef, teacherCodeUpdates);
}

export async function assignTeacherCodeToSchool(
  code: string,
  schoolAdminUid: string
): Promise<void> {
  const db = getDatabase();
  const teacherCodeRef = ref(db, `teacher_codes/${code}`);
  let assignedToAnotherSchool = false;

  const result = await runTransaction(teacherCodeRef, (teacherCode) => {
    if (!teacherCode || typeof teacherCode !== "object") {
      return;
    }

    if (
      teacherCode.school_admin_uid &&
      teacherCode.school_admin_uid !== schoolAdminUid
    ) {
      assignedToAnotherSchool = true;
      return;
    }

    return {
      ...teacherCode,
      school_admin_uid: schoolAdminUid,
    };
  });

  if (assignedToAnotherSchool) {
    throw new Error("This teacher code is already assigned to another school");
  }

  if (!result.committed) {
    throw new Error("Teacher code not found");
  }
}

export async function deleteClassCode(code: string): Promise<void> {
  const db = getDatabase();
  const teacherCodeRef = ref(db, `teacher_codes/${code}`);
  await update(teacherCodeRef, {
    expiry_date: null,
    used_by: null,
  });
}

// Validate if a teacher code exists in the users
export async function validateTeacherCode(code: string): Promise<{ valid: boolean; teacher?: TeacherListItem }> {
  const teachers = await fetchTeachers();
  const teacher = teachers.find((t) => t.teacherCode === code);
  
  return {
    valid: !!teacher,
    teacher,
  };
}

// Move student to another teacher
export async function moveStudentToTeacher(
  studentUid: string,
  childId: string,
  newTeacherCode: string,
  newTeacherUid: string
): Promise<void> {
  await moveStudentsToTeacher(studentUid, [childId], newTeacherCode, newTeacherUid);
}

export async function moveStudentsToTeacher(
  studentUid: string,
  childIds: string[],
  newTeacherCode: string,
  newTeacherUid: string
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();
  const student = users[studentUid] as StudentUser | undefined;
  const targetTeacher = users[newTeacherUid] as TeacherUser | undefined;
  const targetCode = classCodes.find(
    (code) => code.code === newTeacherCode && code.teacher_uid === newTeacherUid
  );
  const uniqueChildIds = Array.from(new Set(childIds));

  if (!student || student.is_teacher !== false) {
    throw new Error("Student account not found");
  }

  if (!targetTeacher || targetTeacher.is_teacher !== true) {
    throw new Error("Teacher not found");
  }

  if (!targetCode) {
    throw new Error("Teacher code not found");
  }

  if (
    targetCode.expiration_date &&
    targetCode.expiration_date <= getLocalDateValue()
  ) {
    throw new Error("Selected teacher code is expired");
  }

  if (uniqueChildIds.length === 0) {
    throw new Error("Please select at least one child");
  }

  const movingChildren = uniqueChildIds.map((childId) => {
    const child = student.children?.[childId];

    if (!child) {
      throw new Error("Selected child not found");
    }

    if (child.teacher_uid === newTeacherUid || child.teacher_code === newTeacherCode) {
      throw new Error(`${child.child_name || "Selected child"} is already with this teacher`);
    }

    return { childId, child };
  });

  const currentTargetCount = countTeacherStudents(targetTeacher);
  const studentLimit = targetCode.student_limit || 0;

  if (studentLimit > 0 && currentTargetCount + movingChildren.length > studentLimit) {
    throw new Error(
      `Student limit exceeded. This teacher can accept ${
        studentLimit - currentTargetCount
      } more student${studentLimit - currentTargetCount === 1 ? "" : "s"}.`
    );
  }

  const parentEmail = student.sign_in_details?.sign_in_email || "";
  const updates: Record<string, unknown> = {};

  for (const { childId, child } of movingChildren) {
    const currentTeacherUid =
      child.teacher_uid ||
      Object.entries(users).find(
        ([, user]) =>
          user.is_teacher === true &&
          (user as TeacherUser).teacher_code === child.teacher_code
      )?.[0];

    updates[`users/${studentUid}/children/${childId}/teacher_code`] = newTeacherCode;
    updates[`users/${studentUid}/children/${childId}/teacher_uid`] = newTeacherUid;
    updates[`users/${newTeacherUid}/students/${studentUid}/${childId}`] = {
      child_mail: parentEmail,
    };

    if (currentTeacherUid) {
      updates[`users/${currentTeacherUid}/students/${studentUid}/${childId}`] = null;
    }
  }

  await update(ref(db), updates);
}

export async function transferTeacherAssignment(
  teacherCode: string,
  fromTeacherUid: string,
  toTeacherUid: string
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();
  const classCode = classCodes.find((code) => code.code === teacherCode);
  const schoolAdminUid = classCode?.school_admin_uid;
  const fromTeacher = users[fromTeacherUid] as TeacherUser | undefined;
  const toTeacher = users[toTeacherUid] as TeacherUser | undefined;

  if (!schoolAdminUid) {
    throw new Error("Teacher code is not assigned to a school");
  }

  if (!fromTeacher || fromTeacher.is_teacher !== true) {
    throw new Error("Current teacher not found");
  }

  if (!toTeacher || toTeacher.is_teacher !== true) {
    throw new Error("New teacher not found");
  }

  const targetHasActiveCode = classCodes.some(
    (code) => code.teacher_uid === toTeacherUid && code.school_admin_uid
  );
  const targetStudentCount = countTeacherStudents(toTeacher);

  if (targetHasActiveCode || targetStudentCount > 0) {
    throw new Error("Selected teacher already has an active class");
  }

  const updates: Record<string, unknown> = {
    [`teacher_codes/${teacherCode}/used_by`]: toTeacherUid,
    [`teacher_codes/${teacherCode}/school_admin_uid`]: schoolAdminUid,
    [`users/${fromTeacherUid}/teacher_code`]: null,
    [`users/${toTeacherUid}/teacher_code`]: teacherCode,
    [`users/${schoolAdminUid}/teachers/${fromTeacherUid}`]: null,
    [`users/${schoolAdminUid}/teachers/${toTeacherUid}`]: removeUndefinedValues({
      uid: toTeacherUid,
      school_admin_uid: schoolAdminUid,
      teacher_code: teacherCode,
      assigned_at: new Date().toISOString(),
    } satisfies AdminTeacher),
  };

  if (fromTeacher.students) {
    for (const [parentUid, children] of Object.entries(fromTeacher.students)) {
      for (const [childId, link] of Object.entries(children)) {
        updates[`users/${parentUid}/children/${childId}/teacher_uid`] = toTeacherUid;
        updates[`users/${parentUid}/children/${childId}/teacher_code`] = teacherCode;
        updates[`users/${fromTeacherUid}/students/${parentUid}/${childId}`] = null;
        updates[`users/${toTeacherUid}/students/${parentUid}/${childId}`] = link;
      }
    }
  }

  await update(ref(db), updates);
}

// Delete a student (and all their data)
export async function deleteStudent(studentUid: string): Promise<void> {
  const db = getDatabase();
  const userRef = ref(db, `users/${studentUid}`);
  await remove(userRef);
}

// Admin management
export async function fetchAllAdmins(): Promise<Admin[]> {
  const db = getDatabase();
  const usersRef = ref(db, "users");
  const snapshot = await get(usersRef);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.entries(data)
      .filter(([, value]) => {
        const user = value as Partial<Admin>;
        return Boolean(user.role);
      })
      .map(([uid, value]) => ({
        uid,
        ...(value as Omit<Admin, "uid">),
      }));
  }
  
  return [];
}

export async function updateAdmin(uid: string, updates: Partial<Admin>): Promise<void> {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);
  const {
    created_at,
    email,
    is_active,
    is_setup_complete,
    name,
    sign_in_details,
    ...topLevelUpdates
  } = updates;
  const firebaseUpdates: Record<string, unknown> = { ...topLevelUpdates };

  if (created_at !== undefined) {
    firebaseUpdates["sign_in_details/created_at"] = created_at;
  }

  if (email !== undefined) {
    firebaseUpdates["sign_in_details/email"] = email;
    firebaseUpdates["sign_in_details/sign_in_email"] = email;
  }

  if (is_active !== undefined) {
    firebaseUpdates["sign_in_details/is_active"] = is_active;
  }

  if (is_setup_complete !== undefined) {
    firebaseUpdates["sign_in_details/is_setup_complete"] = is_setup_complete;
  }

  if (name !== undefined) {
    firebaseUpdates["sign_in_details/name"] = name;
  }

  if (sign_in_details) {
    firebaseUpdates.sign_in_details = sign_in_details;
  }

  await update(userRef, firebaseUpdates);
}

export async function deactivateAdmin(uid: string): Promise<void> {
  await updateAdmin(uid, { is_active: false });
}

export async function activateAdmin(uid: string): Promise<void> {
  await updateAdmin(uid, { is_active: true });
}

export async function createSchoolAdminAccount(
  email: string,
  password: string,
  name: string,
  createdBy: string
): Promise<void> {
  const db = getDatabase();
  const provisioningApp = initializeApp(
    firebaseConfig,
    `school-admin-provisioning-${Date.now()}`
  );
  const provisioningAuth = getAuth(provisioningApp);

  try {
    const result = await createUserWithEmailAndPassword(
      provisioningAuth,
      email,
      password
    );
    const createdAt = new Date().toISOString();

    await set(ref(db, `users/${result.user.uid}`), {
      role: "school_admin",
      created_by: createdBy,
      sign_in_details: {
        created_at: createdAt,
        device_id: "",
        device_type: "web",
        email,
        is_active: true,
        is_setup_complete: false,
        is_sign_in: false,
        name,
        sign_in_email: email,
        sign_in_time: "",
      },
    });
  } finally {
    await signOut(provisioningAuth).catch(() => undefined);
    await deleteApp(provisioningApp);
  }
}

export async function sendSchoolAdminPasswordResetEmail(
  email: string
): Promise<void> {
  if (!auth) {
    throw new Error("Firebase auth not configured");
  }

  await sendPasswordResetEmail(auth, email);
}

// Get teacher by UID
export async function getTeacherByUid(uid: string): Promise<TeacherUser | null> {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);
  
  if (snapshot.exists()) {
    const user = snapshot.val();
    if (user.is_teacher === true) {
      return user as TeacherUser;
    }
  }
  
  return null;
}

// Get teacher by code
export async function getTeacherByCode(code: string): Promise<{ uid: string; teacher: TeacherUser } | null> {
  const teachers = await fetchTeachers();
  const teacherItem = teachers.find((t) => t.teacherCode === code);
  
  if (teacherItem) {
    const teacher = await getTeacherByUid(teacherItem.uid);
    if (teacher) {
      return { uid: teacherItem.uid, teacher };
    }
  }
  
  return null;
}
