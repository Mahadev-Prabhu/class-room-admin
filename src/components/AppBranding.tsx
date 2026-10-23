"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAppConfigByPath } from "@/lib/app-config";

function updateIconLinks(rel: string, href: string, cacheKey: string) {
  document
    .querySelectorAll<HTMLLinkElement>(`link[rel='${rel}']`)
    .forEach((element) => {
      element.href = `${href}?brand=${cacheKey}`;
    });
}

export function AppBranding() {
  const pathname = usePathname();

  useEffect(() => {
    const browserPathname =
      typeof window === "undefined" ? pathname : window.location.pathname;
    const config = getAppConfigByPath(browserPathname);
    const root = document.documentElement;

    root.style.setProperty("--primary", config.primaryColor);
    root.style.setProperty("--ring", config.primaryColor);
    root.style.setProperty("--sidebar-primary", config.primaryColor);
    root.style.setProperty("--sidebar-ring", config.primaryColor);
    root.style.setProperty("--app-primary", config.primaryColor);
    root.style.setProperty("--app-primary-hover", config.primaryHoverColor);
    document.title = config.portalName;

    updateIconLinks("icon", config.logoPath, config.key);
    updateIconLinks("shortcut icon", config.logoPath, config.key);
    updateIconLinks("apple-touch-icon", config.logoPath, config.key);
  }, [pathname]);

  return null;
}
