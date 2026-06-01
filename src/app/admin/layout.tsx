"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || !admin) {
        router.push("/login");
      } else if (!admin.sign_in_details?.is_setup_complete) {
        router.push("/setup");
      }
    }
  }, [user, admin, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <img
          src="/logo.png"
          alt="Smart Kidz Club"
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
