import type { Metadata } from "next";
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import { APP_CONFIGS } from "@/lib/app-config";

const config = APP_CONFIGS.earlylearning;
const description = "Admin portal for managing Early Learning teachers and students";
const url = `${config.adminBaseUrl}${config.pathPrefix}/login`;
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

export default function EarlyLearningLoginPage() {
  return (
    <AuthLayout>
      <LoginPage />
    </AuthLayout>
  );
}
