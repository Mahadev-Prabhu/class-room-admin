import type { Metadata } from "next";
import AdminLayout from "@/app/admin/layout";
import DashboardPage from "@/app/admin/dashboard/page";
import { APP_CONFIGS } from "@/lib/app-config";

const config = APP_CONFIGS.elementarylearning;
const description =
  "Admin portal for managing Classroom K-5 teachers and students";

export const metadata: Metadata = {
  metadataBase: new URL(config.adminBaseUrl),
  title: config.portalName,
  description,
  icons: { icon: config.logoPath, apple: config.logoPath },
};

export default function K5DashboardPage() {
  return (
    <AdminLayout>
      <DashboardPage />
    </AdminLayout>
  );
}
