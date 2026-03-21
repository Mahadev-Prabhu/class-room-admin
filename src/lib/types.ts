// Firebase User Types based on existing database structure

export interface SignInDetails {
  device_id: string;
  device_type: string;
  is_sign_in: boolean;
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
}

// Teacher user in Firebase
export interface TeacherUser {
  is_teacher: true;
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
  sign_in_details: SignInDetails;
  fcm_token?: string;
  last_used?: string;
  children: Record<string, ChildProfile>;
}

export type FirebaseUser = TeacherUser | StudentUser;

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
  school_details?: SchoolDetails;
  assigned_class_codes?: string[];
  created_at: string;
  created_by?: string;
  is_active: boolean;
  is_setup_complete: boolean;
}

// Class Code structure
export interface ClassCode {
  code: string;
  teacher_uid?: string;
  teacher_name?: string;
  teacher_email?: string;
  school_admin_uid?: string;
  expiration_date?: string;
  student_limit?: number;
  class_name?: string;
  created_at: string;
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
    teacherCode: string;
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
