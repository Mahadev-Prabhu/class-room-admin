import { NextRequest, NextResponse } from "next/server";
import { APP_KEYS } from "@/lib/app-config";

const pageRewrites: Record<string, string> = {
  "": "/login",
  login: "/login",
  signup: "/signup",
  "forgot-password": "/forgot-password",
  setup: "/setup",
  dashboard: "/admin/dashboard",
  "class-codes": "/admin/class-codes",
  schools: "/admin/schools",
  teachers: "/admin/teachers",
  students: "/admin/students",
  settings: "/admin/settings",
};

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const appKey = segments[0];

  if (!APP_KEYS.includes(appKey as (typeof APP_KEYS)[number])) {
    return NextResponse.next();
  }

  const routeKey = segments[1] || "";
  const rewritePath = pageRewrites[routeKey];

  if (!rewritePath) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  url.search = search;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/earlylearning/:path*", "/elementarylearning/:path*"],
};
