import { ref, get, runTransaction, set, remove, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { deleteApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth, database, firebaseConfig, functions } from "./firebase";
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
  AccountRole,
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
    name:
      formatDisplayName(teacherUser.teacher_details?.teacher_name) ||
      formatDisplayName(teacherUser.display_name) ||
      "Unknown",
    email: teacherUser.sign_in_details?.sign_in_email || "Unknown",
    school:
      formatDisplayName(teacherUser.school_name) ||
      formatDisplayName(teacherUser.teacher_details?.teacher_school) ||
      formatDisplayName(teacherUser.display_school) ||
      "Unknown",
    schoolAdminUid: teacherUser.school_admin_uid || teacher.school_admin_uid,
    teacherCode: teacherUser.teacher_code || teacher.teacher_code || "",
    status: teacherUser.teacher_status,
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

function getDateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
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

function getAdminSchoolName(schoolAdmin?: Admin) {
  return (
    schoolAdmin?.school_details?.school_name ||
    schoolAdmin?.sign_in_details?.name ||
    schoolAdmin?.name ||
    ""
  );
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
        name:
          formatDisplayName(teacher.teacher_details?.teacher_name) ||
          formatDisplayName(teacher.display_name) ||
          "Unknown",
        email: teacher.sign_in_details?.sign_in_email || "Unknown",
        school:
          formatDisplayName(teacher.school_name) ||
          formatDisplayName(teacher.teacher_details?.teacher_school) ||
          formatDisplayName(teacher.display_school) ||
          "Unknown",
        schoolAdminUid: teacher.school_admin_uid,
        teacherCode,
        status: teacher.teacher_status,
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

// Fetch students by class code
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
      ...scopedClassCodes.map((classCode) => classCode.used_by),
      ...adminTeachers.map((teacher) => teacher.uid),
    ].filter(isString)
  );
  const scopedTeacherKeys = new Set(
    [
      ...adminTeachers.map((teacher) => teacher.uid || teacher.teacherCode),
      ...scopedClassCodes.map((classCode) => classCode.used_by || classCode.code),
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
        scopedTeacherCodes.has(teacher.teacher_code || "") ||
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

// Class Codes management
const TEACHER_CODE_PATTERN = /^E[A-Z0-9]{3}\d{2,4}$/;
const TEST_TEACHER_CODE_PATTERN = /^TEST\d{3,4}$/;
const TEACHER_CODE_REQUIREMENTS =
  "Teacher code must start with E, followed by 3 uppercase letters or numbers, and end with 2 to 4 numbers.";
const CLASS_CODE_PENDING_STATUS = "class_code_pending";

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
        teacher_uid?: string;
        school_admin_uid?: string;
        valid_days_after_applied?: number;
      };
      const usedBy = teacherCode.used_by || teacherCode.teacher_uid;
      const schoolAdminUid =
        teacherCode.school_admin_uid || schoolAdminByTeacherCode.get(code);
      const schoolAdmin = schoolAdminUid
        ? (users[schoolAdminUid] as Partial<Admin> | undefined)
        : undefined;
      const teacherUser = usedBy
        ? (users[usedBy] as TeacherUser | undefined)
        : undefined;

      return {
        code,
        used_by: usedBy,
        teacher_name:
          formatDisplayName(teacherUser?.teacher_details?.teacher_name) ||
          formatDisplayName(teacherUser?.display_name),
        teacher_email: teacherUser?.sign_in_details?.sign_in_email,
        school_admin_uid: schoolAdminUid,
        school_admin_name:
          formatDisplayName(schoolAdmin?.school_details?.school_name) ||
          formatDisplayName(schoolAdmin?.sign_in_details?.name) ||
          formatDisplayName(schoolAdmin?.name),
        expiration_date: parseTeacherCodeDate(teacherCode.expiry_date),
        student_limit: teacherCode.students_limits,
        valid_days_after_applied: teacherCode.valid_days_after_applied,
        created_at: "",
      };
    });
  }
  
  return [];
}

export async function createClassCode(
  classCode: ClassCode,
  options: { enforceFormat?: boolean } = {}
): Promise<void> {
  const enforceFormat = options.enforceFormat ?? true;

  if (
    enforceFormat &&
    !TEACHER_CODE_PATTERN.test(classCode.code) &&
    !TEST_TEACHER_CODE_PATTERN.test(classCode.code)
  ) {
    throw new Error(TEACHER_CODE_REQUIREMENTS);
  }

  const db = getDatabase();
  const teacherCodeRef = ref(db, `teacher_codes/${classCode.code}`);
  await update(teacherCodeRef, {
    ...(classCode.expiration_date !== undefined
      ? { expiry_date: formatTeacherCodeDate(classCode.expiration_date) }
      : {}),
    ...(classCode.student_limit !== undefined
      ? { students_limits: classCode.student_limit }
      : {}),
    ...(classCode.used_by ? { used_by: classCode.used_by } : {}),
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

      if (teacherUser.teacher_status === "replaced" || teacherUser.is_active === false) {
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

  if ("used_by" in updates) {
    teacherCodeUpdates.used_by = updates.used_by ?? null;
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
  const users = await fetchAllUsers();
  const schoolAdmin = users[schoolAdminUid] as Admin | undefined;
  const teacherCodeRef = ref(db, `teacher_codes/${code}`);
  const teacherEntry = Object.entries(users).find(([, user]) => {
    const teacher = user as TeacherUser;
    return teacher.is_teacher === true && teacher.teacher_code === code;
  });
  let teacherUid = teacherEntry?.[0] || "";

  if (!schoolAdmin || schoolAdmin.role !== "school_admin") {
    throw new Error("School account not found");
  }

  const teacherCodeSnapshot = await get(teacherCodeRef);
  const teacherCode = teacherCodeSnapshot.val() as
    | {
        used_by?: string;
        teacher_uid?: string;
        school_admin_uid?: string;
      }
    | null;

  if (!teacherCode || typeof teacherCode !== "object") {
    throw new Error("Teacher code not found");
  }

  if (
    teacherCode.school_admin_uid &&
    teacherCode.school_admin_uid !== schoolAdminUid
  ) {
    throw new Error("This class code is already assigned to another school");
  }

  teacherUid = teacherCode.used_by || teacherCode.teacher_uid || teacherUid;

  if (!teacherUid) {
    throw new Error("Teacher account not found for this code");
  }

  await update(ref(db), {
    [`teacher_codes/${code}/used_by`]: teacherUid,
    [`teacher_codes/${code}/school_admin_uid`]: schoolAdminUid,
    [`users/${teacherUid}/school_name`]: getAdminSchoolName(schoolAdmin),
    [`users/${teacherUid}/school_admin_uid`]: schoolAdminUid,
  });
}

export async function setTeacherSchool(
  teacherUid: string,
  schoolAdminUid: string
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const teacher = users[teacherUid] as TeacherUser | undefined;
  const schoolAdmin = users[schoolAdminUid] as Admin | undefined;

  if (!teacher || teacher.is_teacher !== true || !teacher.teacher_code) {
    throw new Error("Teacher must have a class code before setting school");
  }

  if (!schoolAdmin || schoolAdmin.role !== "school_admin") {
    throw new Error("School account not found");
  }

  const normalizedTeacherCode = teacher.teacher_code.trim().toUpperCase();
  const teacherCodesSnapshot = await get(ref(db, "teacher_codes"));
  const teacherCodes = teacherCodesSnapshot.exists()
    ? (teacherCodesSnapshot.val() as Record<string, unknown>)
    : {};
  let resolvedCode = normalizedTeacherCode;
  let resolvedCodeValue = teacherCodes[resolvedCode];

  if (!resolvedCodeValue || typeof resolvedCodeValue !== "object") {
    const matchingEntry = Object.entries(teacherCodes).find(([, value]) => {
      if (!value || typeof value !== "object") {
        return false;
      }

      return (value as { used_by?: string }).used_by === teacherUid;
    });

    if (matchingEntry) {
      resolvedCode = matchingEntry[0];
      resolvedCodeValue = matchingEntry[1];
    }
  }

  if (!resolvedCodeValue || typeof resolvedCodeValue !== "object") {
    throw new Error("Class code not found");
  }

  const teacherCodeRef = ref(db, `teacher_codes/${resolvedCode}`);
  let assignedToAnotherSchool = false;
  let assignedToAnotherTeacher = false;

  const result = await runTransaction(teacherCodeRef, (teacherCode) => {
    if (!teacherCode || typeof teacherCode !== "object") {
      return;
    }

    if (teacherCode.used_by && teacherCode.used_by !== teacherUid) {
      assignedToAnotherTeacher = true;
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
      used_by: teacherUid,
      school_admin_uid: schoolAdminUid,
    };
  });

  if (assignedToAnotherTeacher) {
    throw new Error("This class code is already assigned to another teacher");
  }

  if (assignedToAnotherSchool) {
    throw new Error("This class code is already assigned to another school");
  }

  if (!result.committed) {
    throw new Error("Class code not found");
  }

  const schoolName = getAdminSchoolName(schoolAdmin);
  const assignedAt = new Date().toISOString();

  await update(ref(db), {
    [`users/${schoolAdminUid}/teachers/${teacherUid}`]: {
      uid: teacherUid,
      school_admin_uid: schoolAdminUid,
      teacher_code: resolvedCode,
      assigned_at: assignedAt,
    },
    [`users/${teacherUid}/teacher_code`]: resolvedCode,
    [`users/${teacherUid}/school_name`]: schoolName,
    [`users/${teacherUid}/school_admin_uid`]: schoolAdminUid,
  });
}

export async function deleteClassCode(code: string): Promise<void> {
  const db = getDatabase();
  const teacherCodeRef = ref(db, `teacher_codes/${code}`);
  await remove(teacherCodeRef);
}

export async function deleteExpiredTeacherCode(code: string): Promise<{
  deletedCode: string;
  deletedTeacherUid?: string | null;
  deletedParentAccounts: number;
  deletedChildProfiles: number;
  detachedSchoolAdmin: boolean;
}> {
  if (!functions) {
    throw new Error("Firebase functions not configured");
  }

  const deleteCode = httpsCallable<
    { code: string },
    {
      deletedCode: string;
      deletedTeacherUid?: string | null;
      deletedParentAccounts: number;
      deletedChildProfiles: number;
      detachedSchoolAdmin: boolean;
    }
  >(functions, "deleteExpiredTeacherCode");
  const result = await deleteCode({ code });

  return result.data;
}

// Validate if a class code exists in the users
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
  newTeacherUid: string,
  requestedByAdmin?: Pick<Admin, "uid" | "role" | "roles">
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();
  const student = users[studentUid] as StudentUser | undefined;
  const targetTeacher = users[newTeacherUid] as TeacherUser | undefined;
  const targetCode = classCodes.find(
    (code) => code.code === newTeacherCode && code.used_by === newTeacherUid
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

  if (!targetCode.school_admin_uid) {
    throw new Error("Selected class code is not assigned to a school");
  }

  const isSuperAdmin =
    requestedByAdmin?.role === "super_admin" ||
    requestedByAdmin?.roles?.includes("super_admin");

  if (
    requestedByAdmin &&
    !isSuperAdmin &&
    requestedByAdmin.uid !== targetCode.school_admin_uid
  ) {
    throw new Error("You can move students only within your school");
  }

  if (
    targetCode.expiration_date &&
    targetCode.expiration_date <= getLocalDateValue()
  ) {
    throw new Error("Selected class code is expired");
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

    const currentCode = classCodes.find(
      (code) =>
        code.code === child.teacher_code ||
        (child.teacher_uid && code.used_by === child.teacher_uid)
    );

    if (currentCode?.school_admin_uid !== targetCode.school_admin_uid) {
      throw new Error("Students can be moved only within the same school");
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
  toTeacherUid: string,
  requestedByAdmin?: Pick<Admin, "uid" | "role" | "roles">
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();
  const classCode = classCodes.find((code) => code.code === teacherCode);
  const schoolAdminUid = classCode?.school_admin_uid;
  const fromTeacher = users[fromTeacherUid] as TeacherUser | undefined;
  const toTeacher = users[toTeacherUid] as TeacherUser | undefined;
  const schoolAdmin = schoolAdminUid
    ? (users[schoolAdminUid] as Admin | undefined)
    : undefined;

  if (!schoolAdminUid) {
    throw new Error("Teacher code is not assigned to a school");
  }

  const isSuperAdmin =
    requestedByAdmin?.role === "super_admin" ||
    requestedByAdmin?.roles?.includes("super_admin");

  if (requestedByAdmin && !isSuperAdmin && requestedByAdmin.uid !== schoolAdminUid) {
    throw new Error("You can transfer only classes connected to your school");
  }

  if (!fromTeacher || fromTeacher.is_teacher !== true) {
    throw new Error("Current teacher not found");
  }

  if (!toTeacher || toTeacher.is_teacher !== true) {
    throw new Error("New teacher not found");
  }

  const targetHasActiveCode = classCodes.some(
    (code) => code.used_by === toTeacherUid && code.school_admin_uid
  );
  const targetStudentCount = countTeacherStudents(toTeacher);

  const targetBelongsToSchool =
    toTeacher.school_admin_uid === schoolAdminUid ||
    Boolean(schoolAdmin?.teachers?.[toTeacherUid]);

  if (!targetBelongsToSchool) {
    throw new Error("Selected incoming teacher belongs to another school");
  }

  if (targetHasActiveCode || targetStudentCount > 0 || toTeacher.teacher_code) {
    throw new Error("Selected teacher already has an active class");
  }

  const transferredAt = new Date().toISOString();
  const schoolName = getAdminSchoolName(schoolAdmin);
  const updates: Record<string, unknown> = {
    [`teacher_codes/${teacherCode}/used_by`]: toTeacherUid,
    [`teacher_codes/${teacherCode}/school_admin_uid`]: schoolAdminUid,
    [`users/${fromTeacherUid}/teacher_code`]: "",
    [`users/${fromTeacherUid}/teacher_status`]: CLASS_CODE_PENDING_STATUS,
    [`users/${fromTeacherUid}/is_active`]: true,
    [`users/${fromTeacherUid}/replaced_at`]: transferredAt,
    [`users/${fromTeacherUid}/replaced_by`]: toTeacherUid,
    [`users/${toTeacherUid}/teacher_code`]: teacherCode,
    [`users/${toTeacherUid}/teacher_status`]: null,
    [`users/${toTeacherUid}/school_name`]: schoolName,
    [`users/${toTeacherUid}/school_admin_uid`]: schoolAdminUid,
    [`users/${schoolAdminUid}/teachers/${fromTeacherUid}`]: removeUndefinedValues({
      uid: fromTeacherUid,
      school_admin_uid: schoolAdminUid,
      assigned_at: transferredAt,
    } satisfies AdminTeacher),
    [`users/${schoolAdminUid}/teachers/${toTeacherUid}`]: removeUndefinedValues({
      uid: toTeacherUid,
      school_admin_uid: schoolAdminUid,
      teacher_code: teacherCode,
      assigned_at: transferredAt,
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

export async function deletePendingTeacher(
  teacherUid: string,
  requestedByAdmin: Admin
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const teacher = users[teacherUid] as TeacherUser | undefined;

  if (!teacher || teacher.is_teacher !== true) {
    throw new Error("Teacher account not found");
  }

  if (teacher.teacher_code) {
    throw new Error("Only teachers without an active class code can be deleted");
  }

  if (countTeacherStudents(teacher) > 0) {
    throw new Error("Move students before deleting this teacher");
  }

  if (
    requestedByAdmin.role !== "super_admin" &&
    !requestedByAdmin.roles?.includes("super_admin")
  ) {
    const schoolAdmin = users[requestedByAdmin.uid] as Admin | undefined;

    if (!schoolAdmin?.teachers?.[teacherUid]) {
      throw new Error("You can delete only teachers connected to your school");
    }
  }

  const updates: Record<string, unknown> = {
    [`users/${teacherUid}`]: null,
  };

  for (const [uid, user] of Object.entries(users)) {
    const possibleAdmin = user as Partial<Admin>;
    if (possibleAdmin.role === "school_admin" && possibleAdmin.teachers?.[teacherUid]) {
      updates[`users/${uid}/teachers/${teacherUid}`] = null;
    }
  }

  await update(ref(db), updates);
}

export async function deleteTeacherAccountCascade(
  teacherUid: string,
  requestedByAdmin: Admin
): Promise<{
  deletedTeacherUid: string;
  deletedClassCode?: string;
  deletedStudentAccounts: number;
  deletedChildProfiles: number;
}> {
  const isSuperAdmin =
    requestedByAdmin.role === "super_admin" ||
    requestedByAdmin.roles?.includes("super_admin");

  if (!isSuperAdmin) {
    throw new Error("Only Super Admin can delete teacher accounts with connected data");
  }

  const db = getDatabase();
  const users = await fetchAllUsers();
  const teacher = users[teacherUid] as TeacherUser | undefined;

  if (!teacher || teacher.is_teacher !== true) {
    throw new Error("Teacher account not found");
  }

  const classCodes = await fetchClassCodes();
  const classCode =
    teacher.teacher_code ||
    classCodes.find((code) => code.used_by === teacherUid)?.code ||
    "";
  const matchingChildrenByStudentUid = new Map<string, Set<string>>();

  const addMatchingChild = (studentUid: string, childId: string) => {
    const existing = matchingChildrenByStudentUid.get(studentUid) || new Set<string>();
    existing.add(childId);
    matchingChildrenByStudentUid.set(studentUid, existing);
  };

  if (teacher.students) {
    for (const [studentUid, children] of Object.entries(teacher.students)) {
      for (const childId of Object.keys(children || {})) {
        addMatchingChild(studentUid, childId);
      }
    }
  }

  for (const [studentUid, user] of Object.entries(users)) {
    if (!isStudentUser(user) || !user.children) {
      continue;
    }

    for (const [childId, child] of Object.entries(user.children)) {
      if (
        child.teacher_uid === teacherUid ||
        (classCode && child.teacher_code === classCode)
      ) {
        addMatchingChild(studentUid, childId);
      }
    }
  }

  let deletedStudentAccounts = 0;
  let deletedChildProfiles = 0;
  const updates: Record<string, unknown> = {
    [`users/${teacherUid}`]: null,
  };

  if (classCode) {
    updates[`teacher_codes/${classCode}`] = null;
  }

  for (const [uid, user] of Object.entries(users)) {
    const possibleAdmin = user as Partial<Admin>;

    if (possibleAdmin.role === "school_admin" && possibleAdmin.teachers?.[teacherUid]) {
      updates[`users/${uid}/teachers/${teacherUid}`] = null;
    }

    if (classCode && possibleAdmin.assigned_class_codes?.includes(classCode)) {
      updates[`users/${uid}/assigned_class_codes`] =
        possibleAdmin.assigned_class_codes.filter((code) => code !== classCode);
    }
  }

  for (const [studentUid, childIds] of matchingChildrenByStudentUid.entries()) {
    const student = users[studentUid];

    if (!student || !isStudentUser(student)) {
      continue;
    }

    const existingChildIds = Object.keys(student.children || {});
    const matchingExistingChildIds = existingChildIds.filter((childId) =>
      childIds.has(childId)
    );

    if (matchingExistingChildIds.length === 0) {
      continue;
    }

    if (matchingExistingChildIds.length >= existingChildIds.length) {
      updates[`users/${studentUid}`] = null;
      deletedStudentAccounts += 1;
      continue;
    }

    for (const childId of matchingExistingChildIds) {
      updates[`users/${studentUid}/children/${childId}`] = null;
      deletedChildProfiles += 1;
    }
  }

  await update(ref(db), updates);

  return {
    deletedTeacherUid: teacherUid,
    deletedClassCode: classCode || undefined,
    deletedStudentAccounts,
    deletedChildProfiles,
  };
}

// Delete a student (and all their data)
export async function deleteStudent(studentUid: string): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const student = users[studentUid] as StudentUser | undefined;
  const updates: Record<string, unknown> = {
    [`users/${studentUid}`]: null,
  };

  if (student?.children) {
    for (const [childId, child] of Object.entries(student.children)) {
      const teacherUid =
        child.teacher_uid ||
        Object.entries(users).find(
          ([, user]) =>
            user.is_teacher === true &&
            (user as TeacherUser).teacher_code === child.teacher_code
        )?.[0];

      if (teacherUid) {
        updates[`users/${teacherUid}/students/${studentUid}/${childId}`] = null;
      }
    }
  }

  await update(ref(db), updates);
}

export async function deleteStudentChild(
  studentUid: string,
  childId: string
): Promise<void> {
  const db = getDatabase();
  const users = await fetchAllUsers();
  const student = users[studentUid] as StudentUser | undefined;
  const child = student?.children?.[childId];

  if (!student || !child) {
    throw new Error("Child profile not found");
  }

  if (Object.keys(student.children || {}).length <= 1) {
    throw new Error("Delete the entire student account when only one child profile exists");
  }

  const teacherUid =
    child.teacher_uid ||
    Object.entries(users).find(
      ([, user]) =>
        user.is_teacher === true &&
        (user as TeacherUser).teacher_code === child.teacher_code
    )?.[0];
  const updates: Record<string, unknown> = {
    [`users/${studentUid}/children/${childId}`]: null,
  };

  if (teacherUid) {
    updates[`users/${teacherUid}/students/${studentUid}/${childId}`] = null;
  }

  await update(ref(db), updates);
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
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();
  const provisioningApp = initializeApp(
    firebaseConfig,
    `school-admin-provisioning-${Date.now()}`
  );
  const provisioningAuth = getAuth(provisioningApp);

  try {
    const result = await createUserWithEmailAndPassword(
      provisioningAuth,
      normalizedEmail,
      password
    );
    const createdAt = new Date().toISOString();

    await set(ref(db, `users/${result.user.uid}`), {
      role: "school_admin",
      roles: ["school_admin"],
      created_by: createdBy,
      sign_in_details: {
        created_at: createdAt,
        device_id: "",
        device_type: "web",
        email: normalizedEmail,
        is_active: true,
        is_setup_complete: false,
        is_sign_in: false,
        name: normalizedName,
        sign_in_email: normalizedEmail,
        sign_in_time: "",
      },
    });
  } finally {
    await signOut(provisioningAuth).catch(() => undefined);
    await deleteApp(provisioningApp);
  }
}

export async function createTeacherAccountForSchool(
  schoolAdminUid: string,
  email: string,
  password: string,
  teacherCode: string,
  options: { enforceFormat?: boolean } = {}
): Promise<void> {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = teacherCode.trim().toUpperCase();
  const users = await fetchAllUsers();
  const schoolAdmin = users[schoolAdminUid] as Admin | undefined;
  const enforceFormat = options.enforceFormat ?? true;

  if (!schoolAdmin || schoolAdmin.role !== "school_admin") {
    throw new Error("School account not found");
  }

  if (
    enforceFormat &&
    !TEACHER_CODE_PATTERN.test(normalizedCode) &&
    !TEST_TEACHER_CODE_PATTERN.test(normalizedCode)
  ) {
    throw new Error(TEACHER_CODE_REQUIREMENTS);
  }

  const teacherCodeRef = ref(db, `teacher_codes/${normalizedCode}`);
  const teacherCodeSnapshot = await get(teacherCodeRef);

  if (!teacherCodeSnapshot.exists() || teacherCodeSnapshot.val() === null) {
    throw new Error("Teacher code not found");
  }

  const codeData = teacherCodeSnapshot.val() as {
    expiry_date?: string;
    students_limits?: number;
    used_by?: string;
    school_admin_uid?: string;
    valid_days_after_applied?: number;
  };

  if (codeData.used_by) {
    throw new Error("This class code is already used by another teacher");
  }

  if (codeData.school_admin_uid) {
    throw new Error("This class code is already assigned to another school");
  }

  const expirationDate =
    parseTeacherCodeDate(codeData.expiry_date) ||
    (typeof codeData.valid_days_after_applied === "number"
      ? getDateAfterDays(codeData.valid_days_after_applied)
      : undefined);
  if (expirationDate && expirationDate <= new Date().toISOString().slice(0, 10)) {
    throw new Error("This class code is expired");
  }

  const provisioningApp = initializeApp(
    firebaseConfig,
    `teacher-provisioning-${Date.now()}`
  );
  const provisioningAuth = getAuth(provisioningApp);

  try {
    const result = await createUserWithEmailAndPassword(
      provisioningAuth,
      normalizedEmail,
      password
    );
    const teacherUid = result.user.uid;
    const assignedAt = new Date().toISOString();
    const schoolName = getAdminSchoolName(schoolAdmin);

    await update(ref(db), {
      [`users/${teacherUid}`]: {
        is_teacher: true,
        teacher_code: normalizedCode,
        school_name: schoolName,
        school_admin_uid: schoolAdminUid,
        sign_in_details: {
          device_id: "",
          device_type: "",
          sign_in_email: normalizedEmail,
          is_sign_in: true,
          sign_in_time: "",
        },
      },
      [`teacher_codes/${normalizedCode}/used_by`]: teacherUid,
      [`teacher_codes/${normalizedCode}/school_admin_uid`]: schoolAdminUid,
      ...(expirationDate
        ? { [`teacher_codes/${normalizedCode}/expiry_date`]: formatTeacherCodeDate(expirationDate) }
        : {}),
      [`users/${schoolAdminUid}/teachers/${teacherUid}`]: {
        uid: teacherUid,
        school_admin_uid: schoolAdminUid,
        teacher_code: normalizedCode,
        assigned_at: assignedAt,
      },
    });
  } finally {
    await signOut(provisioningAuth).catch(() => undefined);
    await deleteApp(provisioningApp);
  }
}

export async function createPendingReplacementTeacherAccount(
  teacherName: string,
  email: string,
  password: string,
  createdBy: string,
  schoolAdminUid?: string
): Promise<void> {
  const db = getDatabase();
  const normalizedName = teacherName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const users = schoolAdminUid ? await fetchAllUsers() : {};
  const schoolAdmin = schoolAdminUid
    ? (users[schoolAdminUid] as Admin | undefined)
    : undefined;

  if (schoolAdminUid && (!schoolAdmin || schoolAdmin.role !== "school_admin")) {
    throw new Error("School account not found");
  }

  const schoolName = getAdminSchoolName(schoolAdmin);
  const provisioningApp = initializeApp(
    firebaseConfig,
    `replacement-teacher-provisioning-${Date.now()}`
  );
  const provisioningAuth = getAuth(provisioningApp);

  try {
    const result = await createUserWithEmailAndPassword(
      provisioningAuth,
      normalizedEmail,
      password
    );
    const teacherUid = result.user.uid;
    const assignedAt = new Date().toISOString();

    await update(ref(db), {
      [`users/${teacherUid}`]: removeUndefinedValues({
        is_teacher: true,
        display_name: normalizedName,
        school_name: schoolName || undefined,
        school_admin_uid: schoolAdminUid,
        teacher_status: CLASS_CODE_PENDING_STATUS,
        created_by: createdBy,
        teacher_code: "",
        sign_in_details: {
          device_id: "",
          device_type: "",
          sign_in_email: normalizedEmail,
          is_sign_in: true,
          sign_in_time: "",
        },
      }),
      ...(schoolAdminUid
        ? {
            [`users/${schoolAdminUid}/teachers/${teacherUid}`]: removeUndefinedValues({
              uid: teacherUid,
              school_admin_uid: schoolAdminUid,
              assigned_at: assignedAt,
            } satisfies AdminTeacher),
          }
        : {}),
    });
  } finally {
    await signOut(provisioningAuth).catch(() => undefined);
    await deleteApp(provisioningApp);
  }
}

export async function addSchoolAdminRoleToTeacher(
  email: string,
  createdBy: string
): Promise<void> {
  const db = getDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const usersSnapshot = await get(ref(db, "users"));

  if (!usersSnapshot.exists()) {
    throw new Error("Teacher account not found");
  }

  const users = usersSnapshot.val() as Record<string, FirebaseUser>;
  const teacherEntry = Object.entries(users).find(([, user]) => {
    if (user.is_teacher !== true) {
      return false;
    }

    const teacherEmail =
      user.sign_in_details?.email || user.sign_in_details?.sign_in_email || "";
    return teacherEmail.trim().toLowerCase() === normalizedEmail;
  });

  if (!teacherEntry) {
    throw new Error("Teacher account not found");
  }

  const [teacherUid, teacherValue] = teacherEntry;
  const teacher = teacherValue as TeacherUser;
  const existingRoles: AccountRole[] = Array.isArray(teacher.roles)
    ? teacher.roles
    : ["teacher"];

  if (existingRoles.includes("school_admin")) {
    throw new Error("This teacher is already a school admin");
  }

  const teacherCodesSnapshot = await get(ref(db, "teacher_codes"));
  const teacherCodes = teacherCodesSnapshot.exists()
    ? (teacherCodesSnapshot.val() as Record<
        string,
        { used_by?: string; school_admin_uid?: string }
      >)
    : {};
  const belongsToSchoolByCode = Object.values(teacherCodes).some(
    (code) => code?.used_by === teacherUid && Boolean(code.school_admin_uid)
  );
  const belongsToSchoolByAdminRecord = Object.entries(users).some(
    ([uid, user]) => {
      if (uid === teacherUid) {
        return false;
      }

      const possibleAdmin = user as Partial<Admin>;
      const isSchoolAdmin =
        possibleAdmin.role === "school_admin" ||
        possibleAdmin.roles?.includes("school_admin");

      return isSchoolAdmin && Boolean(possibleAdmin.teachers?.[teacherUid]);
    }
  );

  if (belongsToSchoolByCode || belongsToSchoolByAdminRecord) {
    throw new Error(
      "This teacher already belongs to another school and cannot be converted to a school admin"
    );
  }

  await update(ref(db, `users/${teacherUid}`), {
    role: "school_admin",
    roles: Array.from(new Set([...existingRoles, "teacher", "school_admin"])),
    created_by: createdBy,
    "sign_in_details/is_active": true,
    "sign_in_details/is_setup_complete": false,
  });
}

export async function sendSchoolAdminPasswordResetEmail(
  email: string,
  continueUrl?: string
): Promise<void> {
  if (!auth) {
    throw new Error("Firebase auth not configured");
  }

  await sendPasswordResetEmailWithContinueUrlFallback(email, continueUrl);
}

export async function sendTeacherPasswordResetEmail(
  email: string,
  continueUrl?: string
): Promise<void> {
  if (!auth) {
    throw new Error("Firebase auth not configured");
  }

  await sendPasswordResetEmailWithContinueUrlFallback(email, continueUrl);
}

async function sendPasswordResetEmailWithContinueUrlFallback(
  email: string,
  continueUrl?: string
) {
  if (!auth) {
    throw new Error("Firebase auth not configured");
  }

  if (!continueUrl) {
    await sendPasswordResetEmail(auth, email);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email, {
      url: continueUrl,
      handleCodeInApp: false,
    });
  } catch (error) {
    if (isUnauthorizedContinueUrlError(error)) {
      await sendPasswordResetEmail(auth, email);
      return;
    }

    throw error;
  }
}

function isUnauthorizedContinueUrlError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "auth/unauthorized-continue-uri"
  );
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
