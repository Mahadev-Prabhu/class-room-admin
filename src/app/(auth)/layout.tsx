"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toAppPathForPath } from "@/lib/routes";
import { useAppConfig } from "@/lib/use-app-config";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const appConfig = useAppConfig();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isClassroomHost =
      window.location.hostname === "admin.classroomsolution.app" ||
      window.location.hostname === "classroomsolution.app" ||
      window.location.hostname === "www.classroomsolution.app" ||
      window.location.hostname === "classroomapp-1abfc.web.app" ||
      window.location.hostname === "classroomapp-1abfc.firebaseapp.com";

    if (isClassroomHost && !pathname.startsWith("/elementarylearning")) {
      window.location.replace(`/elementarylearning${pathname}`);
    }
  }, [pathname]);

  useEffect(() => {
    if (!loading && user && admin) {
      if (!admin.sign_in_details?.is_setup_complete) {
        router.push(toAppPathForPath("/setup", pathname));
      } else {
        router.push(toAppPathForPath("/admin/dashboard", pathname));
      }
    }
  }, [user, admin, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
        <img
          src={appConfig.logoPath}
          alt={appConfig.appName}
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
