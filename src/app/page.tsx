"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { toAppPathForPath } from "@/lib/routes";
import { useAppConfig } from "@/lib/use-app-config";

export default function Home() {
  const { user, admin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const appConfig = useAppConfig();

  useEffect(() => {
    if (!loading) {
      if (user && admin) {
        if (!admin.sign_in_details?.is_setup_complete) {
          router.push(toAppPathForPath("/setup", pathname));
        } else {
          router.push(toAppPathForPath("/admin/dashboard", pathname));
        }
      } else {
        router.push(toAppPathForPath("/login", pathname));
      }
    }
  }, [user, admin, loading, pathname, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
      <div className="text-center">
        <img
          src={appConfig.logoPath}
          alt={appConfig.appName}
          className="w-24 h-24 mx-auto mb-4 rounded-2xl animate-pulse"
        />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
