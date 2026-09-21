"use client";

import { usePathname } from "next/navigation";
import { getAppConfigByPath } from "./app-config";

export function useAppConfig() {
  const pathname = usePathname();

  return getAppConfigByPath(pathname);
}

