import { redirect } from "next/navigation";
import { APP_CONFIGS, getDefaultAppKey } from "@/lib/app-config";

export default function DashboardRedirectPage() {
  const pathPrefix = APP_CONFIGS[getDefaultAppKey()].pathPrefix;
  redirect(`${pathPrefix}/dashboard`);
}
