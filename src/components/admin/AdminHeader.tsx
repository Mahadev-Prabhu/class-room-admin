"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { getAppConfigByPath } from "@/lib/app-config";
import { internalAdminPathFromPublic } from "@/lib/routes";

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/class-codes": "Class Codes",
  "/admin/teachers": "Teachers",
  "/admin/students": "Students",
  "/admin/settings": "Settings",
};

export function AdminHeader() {
  const pathname = usePathname();
  const title = pageTitles[internalAdminPathFromPublic(pathname)] || "Admin";
  const appConfig = getAppConfigByPath(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <nav className="flex items-center text-sm">
        <span className="text-muted-foreground">{appConfig.appName}</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="font-medium">{title}</span>
      </nav>
    </header>
  );
}
