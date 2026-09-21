"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { toAppPathForPath } from "@/lib/routes";
import { useAppConfig } from "@/lib/use-app-config";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const appConfig = useAppConfig();

  useEffect(() => {
    if (!loading) {
      if (!user || !admin) {
        router.push(toAppPathForPath("/login", pathname));
      } else if (!admin.sign_in_details?.is_setup_complete) {
        router.push(toAppPathForPath("/setup", pathname));
      }
    }
  }, [user, admin, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img
          src={appConfig.logoPath}
          alt={appConfig.appName}
          className="w-16 h-16 rounded-xl animate-pulse"
        />
      </div>
    );
  }

  if (
    !user ||
    !admin ||
    !admin.sign_in_details?.is_setup_complete
  ) {
    return null;
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 p-6 bg-muted/30">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
