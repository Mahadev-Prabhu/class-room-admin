// Firebase User Types based on existing database structure

export interface SignInDetails {
  created_at?: string;
  device_id: string;
  device_type: string;
  email?: string;
  is_active?: boolean;
  is_setup_complete?: boolean;
  is_sign_in: boolean;
  name?: string;
  sign_in_email: string;
  sign_in_time: string;
}

export interface Reward {
  book_id?: string;
  date: string;
  points: string;
  start_date: string;
  type: "reading" | "play_activity" | "comeback";
}

export interface ChildProfile {
  child_name?: string;
  child_age?: string;
  child_avatar?: string;
  "my-resources"?: Record<string, string>;
  number_of_books_read?: number;
  rewards?: Record<string, Reward>;
  teacher_code?: string;
  teacher_uid?: string;
}

export interface TeacherDetails {
  teacher_grade: string;
  teacher_name: string;
  teacher_profile: string;
  teacher_school: string;
}

export interface StudentLink {
  child_mail: string;
  assigned?: Record<string, string>;
}

// Teacher user in Firebase
export interface TeacherUser {
  is_teacher: true;
  role?: undefined;
  teacher_code: string;
  teacher_details: TeacherDetails;
  sign_in_details: SignInDetails;
  assigned_to_class?: Record<string, string>;
  students?: Record<string, Record<string, StudentLink>>;
  children?: Record<string, ChildProfile>;
}

// Student/Parent user in Firebase
export interface StudentUser {
  is_teacher: false;
  role?: undefined;
  sign_in_details: SignInDetails;
  fcm_token?: string;
  last_used?: string;
  children: Record<string, ChildProfile>;
}

// Admin Types (new structure)
export type AdminRole = "super_admin" | "school_admin" | "viewer";

export interface SchoolDetails {
  school_name: string;
  country: string;
  state: string;
  address_1: string;
  address_2?: string;
  zip_code: string;
  phone: string;
}

export interface Admin {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  sign_in_details?: SignInDetails;
  school_details?: SchoolDetails;
  assigned_class_codes?: string[];
  teachers?: Record<string, AdminTeacher>;
  created_at: string;
  created_by?: string;
  is_active: boolean;
  is_setup_complete: boolean;
}

export interface AdminUser extends Omit<Admin, "uid"> {
  is_teacher?: false;
  children?: undefined;
}

export type FirebaseUser = TeacherUser | StudentUser | AdminUser;

// Teacher Code structure
export interface ClassCode {
  code: string;
  teacher_uid?: string;
  teacher_name?: string;
  teacher_email?: string;
  school_admin_uid?: string;
  school_admin_name?: string;
  expiration_date?: string;
  student_limit?: number;
  class_name?: string;
  created_at: string;
}

export interface AdminTeacher {
  uid: string;
  school_admin_uid: string;
  teacher_code: string;
  assigned_at: string;
}

// View models for UI
export interface TeacherListItem {
  uid: string;
  name: string;
  email: string;
  school: string;
  teacherCode: string;
  studentCount: number;
  lastSignIn: string;
  classAssignmentsCount: number;
  individualAssignmentsCount: number;
}

export interface StudentListItem {
  uid: string;
  parentEmail: string;
  children: {
    id: string;
    name: string;
    age: string;
    booksRead: number;
    totalPoints: number;
    resourcesCount: number;
    teacherCode: string;
    teacherUid?: string;
    teacherName?: string;
  }[];
  lastUsed: string;
}

export interface DashboardStats {
  totalTeachers: number;
  totalStudents: number;
  totalChildren: number;
  activeToday: number;
  totalBooksRead: number;
  classCodes: number;
}
