import { APP_CONFIGS, getAppKeyFromPath, getCurrentAppConfig } from "./app-config";

const ADMIN_ROUTE_MAP: Record<string, string> = {
  "/admin/dashboard": "/dashboard",
  "/admin/class-codes": "/class-codes",
  "/admin/schools": "/schools",
  "/admin/teachers": "/teachers",
  "/admin/students": "/students",
  "/admin/settings": "/settings",
};

const PUBLIC_ROUTE_MAP: Record<string, string> = {
  "/login": "/login",
  "/signup": "/signup",
  "/forgot-password": "/forgot-password",
  "/setup": "/setup",
};

export function stripAppPrefix(pathname: string) {
  const appKey = getAppKeyFromPath(pathname);

  if (!appKey) {
    return pathname;
  }

  const prefix = APP_CONFIGS[appKey].pathPrefix;
  const stripped = pathname.slice(prefix.length);

  return stripped || "/";
}

export function internalAdminPathFromPublic(pathname: string) {
  const stripped = stripAppPrefix(pathname);

  if (stripped === "/dashboard") return "/admin/dashboard";
  if (stripped === "/class-codes") return "/admin/class-codes";
  if (stripped === "/schools") return "/admin/schools";
  if (stripped === "/teachers") return "/admin/teachers";
  if (stripped === "/students") return "/admin/students";
  if (stripped === "/settings") return "/admin/settings";

  return stripped;
}

export function toAppPath(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  const config = getCurrentAppConfig();
  return toAppPathForConfig(path, config.pathPrefix);
}

export function toAppPathForPath(path: string, currentPathname: string) {
  const appKey = getAppKeyFromPath(currentPathname);
  const pathPrefix = appKey ? APP_CONFIGS[appKey].pathPrefix : "";

  return toAppPathForConfig(path, pathPrefix);
}

export function toPublicAppUrlForPath(path: string, currentPathname: string) {
  const appKey = getAppKeyFromPath(currentPathname);
  const config = APP_CONFIGS[appKey || "earlylearning"];
  const appPath = toAppPathForConfig(path, config.pathPrefix);

  return `${config.adminBaseUrl.replace(/\/$/, "")}${appPath}`;
}

function toAppPathForConfig(path: string, pathPrefix: string) {
  const [pathname, query = ""] = path.split("?");
  const mappedPath = ADMIN_ROUTE_MAP[pathname] || PUBLIC_ROUTE_MAP[pathname] || pathname;
  const pathWithPrefix = `${pathPrefix}${mappedPath === "/" ? "" : mappedPath}`;

  return query ? `${pathWithPrefix}?${query}` : pathWithPrefix;
}
