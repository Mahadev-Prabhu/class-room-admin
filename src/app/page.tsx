"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user, admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && admin) {
        if (!admin.sign_in_details?.is_setup_complete) {
          router.push("/setup");
        } else {
          router.push("/admin/dashboard");
        }
      } else {
        router.push("/login");
      }
    }
  }, [user, admin, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="Smart Kidz Club"
          className="w-24 h-24 mx-auto mb-4 rounded-2xl animate-pulse"
        />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
