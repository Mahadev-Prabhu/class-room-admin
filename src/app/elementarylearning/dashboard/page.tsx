import type { Metadata } from "next";
import AdminLayout from "@/app/admin/layout";
import DashboardPage from "@/app/admin/dashboard/page";
import { APP_CONFIGS } from "@/lib/app-config";

const config = APP_CONFIGS.elementarylearning;
const description =
  "Admin portal for managing Classroom Solution teachers and students";
const url = `${config.adminBaseUrl}${config.pathPrefix}/dashboard`;
const imageUrl = `${config.adminBaseUrl}${config.logoPath}`;

export const metadata: Metadata = {
  metadataBase: new URL(config.adminBaseUrl),
  title: config.portalName,
  description,
  icons: {
    icon: config.logoPath,
    apple: config.logoPath,
  },
  openGraph: {
    title: config.portalName,
    description,
    url,
    siteName: config.portalName,
    images: [
      {
        url: imageUrl,
        width: 1024,
        height: 1024,
        alt: config.appName,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: config.portalName,
    description,
    images: [imageUrl],
  },
};

export default function ElementaryLearningDashboardPage() {
  return (
    <AdminLayout>
      <DashboardPage />
    </AdminLayout>
  );
}
