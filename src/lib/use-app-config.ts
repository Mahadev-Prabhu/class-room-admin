"use client";

import { usePathname } from "next/navigation";
import { getAppConfigByPath } from "./app-config";

export function useAppConfig() {
  const pathname = usePathname();
  const browserPathname =
    typeof window === "undefined" ? pathname : window.location.pathname;

  return getAppConfigByPath(browserPathname);
}
