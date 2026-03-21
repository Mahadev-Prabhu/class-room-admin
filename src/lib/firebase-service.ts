import { ref, get, set, remove, update } from "firebase/database";
import { database } from "./firebase";
import {
  TeacherUser,
  StudentUser,
  FirebaseUser,
  TeacherListItem,
  StudentListItem,
  DashboardStats,
  ClassCode,
  Admin,
} from "./types";

// Helper to check if database is configured
function getDatabase() {
  if (!database) {
    throw new Error("Firebase database not configured");
  }
  return database;
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
  const teachers: TeacherListItem[] = [];

  for (const [uid, user] of Object.entries(users)) {
    if (user.is_teacher === true) {
      const teacher = user as TeacherUser;
      const studentCount = teacher.students ? Object.keys(teacher.students).length : 0;

      teachers.push({
        uid,
        name: teacher.teacher_details?.teacher_name || "Unknown",
        email: teacher.sign_in_details?.sign_in_email || "Unknown",
        school: teacher.teacher_details?.teacher_school || "Unknown",
        teacherCode: teacher.teacher_code || "",
        studentCount,
        lastSignIn: teacher.sign_in_details?.sign_in_time || "Never",
      });
    }
  }

  return teachers.sort((a, b) => a.name.localeCompare(b.name));
}

// Fetch all students (parents)
export async function fetchStudents(): Promise<StudentListItem[]> {
  const users = await fetchAllUsers();
  const students: StudentListItem[] = [];

  for (const [uid, user] of Object.entries(users)) {
    if (user.is_teacher === false) {
      const student = user as StudentUser;
      const children: StudentListItem["children"] = [];

      if (student.children) {
        for (const [childId, child] of Object.entries(student.children)) {
          const totalPoints = child.rewards
            ? Object.values(child.rewards).reduce(
                (sum, reward) => sum + parseInt(reward.points || "0"),
                0
              )
            : 0;

          children.push({
            id: childId,
            name: child.child_name || "Unknown",
            age: child.child_age || "Unknown",
            booksRead: child.number_of_books_read || 0,
            totalPoints,
            teacherCode: child.teacher_code || "",
            teacherName: undefined, // Will be populated later if needed
          });
        }
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

// Fetch students by teacher code
export async function fetchStudentsByTeacherCode(teacherCode: string): Promise<StudentListItem[]> {
  const allStudents = await fetchStudents();
  
  return allStudents.filter((student) =>
    student.children.some((child) => child.teacherCode === teacherCode)
  );
}

// Get dashboard statistics
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const users = await fetchAllUsers();
  const classCodes = await fetchClassCodes();

  let totalTeachers = 0;
  let totalStudents = 0;
  let totalChildren = 0;
  let totalBooksRead = 0;
  let activeToday = 0;

  const today = new Date().toISOString().split("T")[0];

  for (const user of Object.values(users)) {
    if (user.is_teacher === true) {
      totalTeachers++;
    } else {
      totalStudents++;
      const student = user as StudentUser;
      
      if (student.children) {
        for (const child of Object.values(student.children)) {
          totalChildren++;
          totalBooksRead += child.number_of_books_read || 0;
        }
      }
      
      if (student.last_used === today) {
        activeToday++;
      }
    }
    
    // Check teacher last sign in
    if (user.sign_in_details?.sign_in_time?.startsWith(today)) {
      activeToday++;
    }
  }

  return {
    totalTeachers,
    totalStudents,
    totalChildren,
    activeToday,
    totalBooksRead,
    classCodes: classCodes.length,
  };
}

// Class Codes management
export async function fetchClassCodes(): Promise<ClassCode[]> {
  const db = getDatabase();
  const classCodesRef = ref(db, "class_codes");
  const snapshot = await get(classCodesRef);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.entries(data).map(([code, value]) => ({
      code,
      ...(value as Omit<ClassCode, "code">),
    }));
  }
  
  return [];
}

export async function createClassCode(classCode: ClassCode): Promise<void> {
  const db = getDatabase();
  const classCodeRef = ref(db, `class_codes/${classCode.code}`);
  await set(classCodeRef, {
    teacher_uid: classCode.teacher_uid || null,
    teacher_name: classCode.teacher_name || null,
    teacher_email: classCode.teacher_email || null,
    school_admin_uid: classCode.school_admin_uid || null,
    expiration_date: classCode.expiration_date || null,
    student_limit: classCode.student_limit || null,
    class_name: classCode.class_name || null,
    created_at: classCode.created_at,
  });
}

export async function updateClassCode(code: string, updates: Partial<ClassCode>): Promise<void> {
  const db = getDatabase();
  const classCodeRef = ref(db, `class_codes/${code}`);
  await update(classCodeRef, updates);
}

export async function deleteClassCode(code: string): Promise<void> {
  const db = getDatabase();
  const classCodeRef = ref(db, `class_codes/${code}`);
  await remove(classCodeRef);
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
  const db = getDatabase();
  // Update the child's teacher code and uid
  const childRef = ref(db, `users/${studentUid}/children/${childId}`);
  await update(childRef, {
    teacher_code: newTeacherCode,
    teacher_uid: newTeacherUid,
  });
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
  const adminsRef = ref(db, "admins");
  const snapshot = await get(adminsRef);
  
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.entries(data).map(([uid, value]) => ({
      uid,
      ...(value as Omit<Admin, "uid">),
    }));
  }
  
  return [];
}

export async function updateAdmin(uid: string, updates: Partial<Admin>): Promise<void> {
  const db = getDatabase();
  const adminRef = ref(db, `admins/${uid}`);
  await update(adminRef, updates);
}

export async function deactivateAdmin(uid: string): Promise<void> {
  await updateAdmin(uid, { is_active: false });
}

export async function activateAdmin(uid: string): Promise<void> {
  await updateAdmin(uid, { is_active: true });
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
