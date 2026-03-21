"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, database } from "@/lib/firebase";
import { Admin, SchoolDetails } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  admin: Admin | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeAdminSetup: (schoolDetails: SchoolDetails) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      const adminRef = ref(database, `admins/${uid}`);
      const snapshot = await get(adminRef);
      if (snapshot.exists()) {
        return { uid, ...snapshot.val() } as Admin;
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
        const adminData = await fetchAdminData(firebaseUser.uid);
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
    if (!auth) throw new Error("Firebase not configured");
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
      
      if (!adminData.is_active) {
        await signOut(auth);
        throw new Error("Your admin account has been deactivated. Please contact support.");
      }
      
      setAdmin(adminData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!auth || !database) throw new Error("Firebase not configured");
    try {
      setError(null);
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create admin record
      const newAdmin: Omit<Admin, "uid"> = {
        email,
        name,
        role: "school_admin",
        created_at: new Date().toISOString(),
        is_active: true,
        is_setup_complete: false,
      };
      
      const adminRef = ref(database, `admins/${result.user.uid}`);
      await set(adminRef, newAdmin);
      
      setAdmin({ uid: result.user.uid, ...newAdmin });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!auth || !database) throw new Error("Firebase not configured");
    try {
      setError(null);
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if admin exists
      let adminData = await fetchAdminData(result.user.uid);
      
      if (!adminData) {
        // Create new admin record for Google sign-in
        const newAdmin: Omit<Admin, "uid"> = {
          email: result.user.email || "",
          name: result.user.displayName || "",
          role: "school_admin",
          created_at: new Date().toISOString(),
          is_active: true,
          is_setup_complete: false,
        };
        
        const adminRef = ref(database, `admins/${result.user.uid}`);
        await set(adminRef, newAdmin);
        adminData = { uid: result.user.uid, ...newAdmin };
      }
      
      if (!adminData.is_active) {
        await signOut(auth);
        throw new Error("Your admin account has been deactivated. Please contact support.");
      }
      
      setAdmin(adminData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in with Google";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    if (!auth || !database) throw new Error("Firebase not configured");
    try {
      setError(null);
      setLoading(true);
      const provider = new OAuthProvider("apple.com");
      provider.addScope("email");
      provider.addScope("name");
      const result = await signInWithPopup(auth, provider);
      
      // Check if admin exists
      let adminData = await fetchAdminData(result.user.uid);
      
      if (!adminData) {
        // Create new admin record for Apple sign-in
        const newAdmin: Omit<Admin, "uid"> = {
          email: result.user.email || "",
          name: result.user.displayName || "",
          role: "school_admin",
          created_at: new Date().toISOString(),
          is_active: true,
          is_setup_complete: false,
        };
        
        const adminRef = ref(database, `admins/${result.user.uid}`);
        await set(adminRef, newAdmin);
        adminData = { uid: result.user.uid, ...newAdmin };
      }
      
      if (!adminData.is_active) {
        await signOut(auth);
        throw new Error("Your admin account has been deactivated. Please contact support.");
      }
      
      setAdmin(adminData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in with Apple";
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
      await signOut(auth);
      setAdmin(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign out";
      setError(message);
      throw err;
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
      const adminRef = ref(database, `admins/${user.uid}`);
      await set(adminRef, {
        ...admin,
        school_details: schoolDetails,
        is_setup_complete: true,
      });
      
      setAdmin({
        ...admin,
        school_details: schoolDetails,
        is_setup_complete: true,
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
        signUp,
        signInWithGoogle,
        signInWithApple,
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
