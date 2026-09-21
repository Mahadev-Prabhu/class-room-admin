"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAppConfigByPath } from "@/lib/app-config";

export function AppBranding() {
  const pathname = usePathname();

  useEffect(() => {
    const config = getAppConfigByPath(pathname);
    const root = document.documentElement;

    root.style.setProperty("--primary", config.primaryColor);
    root.style.setProperty("--ring", config.primaryColor);
    root.style.setProperty("--sidebar-primary", config.primaryColor);
    root.style.setProperty("--sidebar-ring", config.primaryColor);
    root.style.setProperty("--app-primary", config.primaryColor);
    root.style.setProperty("--app-primary-hover", config.primaryHoverColor);
    document.title = config.portalName;

    const icon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (icon) {
      icon.href = config.logoPath;
    }
  }, [pathname]);

  return null;
}

