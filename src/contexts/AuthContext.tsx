"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, database } from "@/lib/firebase";
import { Admin, SchoolDetails, SignInDetails } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  admin: Admin | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUpSuperAdmin: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeAdminSetup: (schoolDetails: SchoolDetails) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_DEVICE_ID_KEY = "classroom_admin_device_id";

function formatSignInTime(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getDeviceId() {
  if (typeof window === "undefined") {
    return "web";
  }

  const existingDeviceId = window.localStorage.getItem(ADMIN_DEVICE_ID_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const deviceId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID().toUpperCase()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`.toUpperCase();

  window.localStorage.setItem(ADMIN_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function createSignInDetails(
  email: string,
  isSignIn: boolean,
  adminDetails?: Pick<Admin, "created_at" | "email" | "is_active" | "is_setup_complete" | "name">
): SignInDetails {
  return {
    created_at: adminDetails?.created_at || "",
    device_id: getDeviceId(),
    device_type: "web",
    email: adminDetails?.email || email,
    is_active: adminDetails?.is_active ?? true,
    is_setup_complete: adminDetails?.is_setup_complete ?? false,
    is_sign_in: isSignIn,
    name: adminDetails?.name || "",
    sign_in_email: email,
    sign_in_time: formatSignInTime(new Date()),
  };
}

function normalizeAdmin(uid: string, value: Partial<Admin>): Admin {
  const signInDetails = value.sign_in_details;
  const email = value.email || signInDetails?.email || signInDetails?.sign_in_email || "";
  const name = value.name || signInDetails?.name || "";
  const createdAt = value.created_at || signInDetails?.created_at || "";
  const isActive = value.is_active ?? signInDetails?.is_active ?? true;
  const isSetupComplete = value.is_setup_complete ?? signInDetails?.is_setup_complete ?? false;

  return {
    ...value,
    uid,
    email,
    name,
    role: value.role || "school_admin",
    created_at: createdAt,
    is_active: isActive,
    is_setup_complete: isSetupComplete,
    sign_in_details: signInDetails
      ? {
          ...signInDetails,
          email,
          name,
          created_at: createdAt,
          is_active: isActive,
          is_setup_complete: isSetupComplete,
        }
      : undefined,
  } as Admin;
}

function createAdminUserRecord(admin: Admin, signInDetails: SignInDetails) {
  return {
    role: admin.role,
    sign_in_details: signInDetails,
    ...(admin.school_details ? { school_details: admin.school_details } : {}),
    ...(admin.assigned_class_codes ? { assigned_class_codes: admin.assigned_class_codes } : {}),
    ...(admin.teachers ? { teachers: admin.teachers } : {}),
    ...(admin.created_by ? { created_by: admin.created_by } : {}),
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if Firebase is configured
  const isFirebaseConfigured = !!auth && !!database;

  // Fetch admin data from Firebase
  const fetchAdminData = async (uid: string): Promise<Admin | null> => {
    if (!database) return null;
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const value = snapshot.val();
        if (value?.role) {
          return normalizeAdmin(uid, value);
        }
      }

      const legacyAdminRef = ref(database, `admins/${uid}`);
      const legacySnapshot = await get(legacyAdminRef);
      if (legacySnapshot.exists()) {
        return normalizeAdmin(uid, legacySnapshot.val());
      }

      return null;
    } catch (err) {
      console.error("Error fetching admin data:", err);
      return null;
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        let adminData = await fetchAdminData(firebaseUser.uid);
        if (!adminData) {
          await wait(500);
          adminData = await fetchAdminData(firebaseUser.uid);
        }

        if (adminData) {
          setAdmin(adminData);
        } else {
          // User is authenticated but not an admin
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth || !database) throw new Error("Firebase not configured");
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is an admin
      const adminData = await fetchAdminData(result.user.uid);
      if (!adminData) {
        await signOut(auth);
        throw new Error("This account is not registered as an admin. Please contact support.");
      }
      
      if (!adminData.sign_in_details?.is_active) {
        await signOut(auth);
        throw new Error("Your admin account has been deactivated. Please contact support.");
      }
      
      const adminEmail = adminData.sign_in_details?.email || adminData.sign_in_details?.sign_in_email || email;
      const signInDetails = createSignInDetails(adminEmail, true, adminData);
      await set(
        ref(database, `users/${result.user.uid}/sign_in_details`),
        signInDetails
      );

      setAdmin({
        ...adminData,
        sign_in_details: signInDetails,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) throw new Error("Firebase not configured");
    try {
      setError(null);
      if (database && user && admin) {
        const adminEmail = admin.sign_in_details?.email || admin.sign_in_details?.sign_in_email || "";
        await set(
          ref(database, `users/${user.uid}/sign_in_details`),
          createSignInDetails(adminEmail, false, admin)
        );
      }
      await signOut(auth);
      setAdmin(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
      throw err;
    }
  };

  const signUpSuperAdmin = async (
    email: string,
    password: string,
    name: string
  ) => {
    if (!auth || !database) throw new Error("Firebase not configured");
    try {
      setError(null);
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const createdAt = new Date().toISOString();
      const newAdmin: Admin = {
        uid: result.user.uid,
        email,
        name,
        role: "super_admin",
        created_at: createdAt,
        is_active: true,
        is_setup_complete: true,
      };
      newAdmin.sign_in_details = createSignInDetails(email, true, newAdmin);

      await set(
        ref(database, `users/${result.user.uid}`),
        createAdminUserRecord(newAdmin, newAdmin.sign_in_details)
      );

      setUser(result.user);
      setAdmin(newAdmin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Firebase not configured");
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reset email";
      setError(message);
      throw err;
    }
  };

  const completeAdminSetup = async (schoolDetails: SchoolDetails) => {
    if (!database) throw new Error("Firebase not configured");
    if (!user || !admin) {
      throw new Error("Not authenticated");
    }
    
    try {
      setError(null);
      const updatedAdmin = {
        ...admin,
        school_details: schoolDetails,
        is_setup_complete: true,
      };
      const adminEmail = admin.sign_in_details?.email || admin.sign_in_details?.sign_in_email || "";
      const signInDetails = createSignInDetails(adminEmail, true, updatedAdmin);
      const userRef = ref(database, `users/${user.uid}`);
      await set(userRef, createAdminUserRecord(updatedAdmin, signInDetails));
      
      setAdmin({
        ...updatedAdmin,
        sign_in_details: signInDetails,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete setup";
      setError(message);
      throw err;
    }
  };

  const clearError = () => setError(null);

  // Show configuration error if Firebase is not set up
  if (!isFirebaseConfigured && typeof window !== "undefined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <img
            src="/logo.png"
            alt="Smart Kidz Club"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl"
          />
          <h1 className="text-xl font-bold text-red-600 mb-4">Firebase Not Configured</h1>
          <p className="text-gray-600 mb-4">
            Please create a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file with your Firebase configuration.
          </p>
          <p className="text-sm text-gray-500">
            Copy <code>.env.local.example</code> to <code>.env.local</code> and fill in your Firebase project details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        loading,
        error,
        signIn,
        signUpSuperAdmin,
        logout,
        resetPassword,
        completeAdminSetup,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
