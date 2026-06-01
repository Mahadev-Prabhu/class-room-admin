"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && admin) {
      if (!admin.sign_in_details?.is_setup_complete) {
        router.push("/setup");
      } else {
        router.push("/admin/dashboard");
      }
    }
  }, [user, admin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
        <img
          src="/logo.png"
          alt="Smart Kidz Club"
          className="w-20 h-20 rounded-2xl animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
