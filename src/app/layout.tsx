import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { AppBranding } from "@/components/AppBranding";
import { OfflineStatus } from "@/components/OfflineStatus";
import { APP_CONFIGS, getDefaultAppKey } from "@/lib/app-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadataAppKey = getDefaultAppKey();
const metadataConfig = APP_CONFIGS[metadataAppKey];
const metadataDescription =
  metadataAppKey === "elementarylearning"
    ? "Admin portal for managing Classroom K-5 teachers and students"
    : "Admin portal for managing Early Learning teachers and students";
const metadataUrl = `${metadataConfig.adminBaseUrl}${metadataConfig.pathPrefix}/login`;
const metadataImage = metadataConfig.logoPath;
const brandBootstrapScript = `
(() => {
  const path = window.location.pathname;
  const isEarlyLearning = path.startsWith("/earlylearning");
  const portalName = isEarlyLearning
    ? "Early Learning Admin Portal"
    : "Classroom K-5 Admin Portal";
  const logoPath = isEarlyLearning
    ? "/brands/earlylearning/logo.png"
    : "/brands/classroom/logo.png";
  const cacheKey = isEarlyLearning ? "earlylearning" : "elementarylearning";
  const appName = isEarlyLearning ? "Early Learning Library" : "Classroom K-5";

  document.title = portalName;
  document
    .querySelectorAll("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
    .forEach((element) => {
      element.setAttribute("href", logoPath + "?brand=" + cacheKey);
    });

  const syncLogos = () => {
    document.querySelectorAll("img[data-app-logo]").forEach((image) => {
      if (image.getAttribute("src") !== logoPath) {
        image.setAttribute("src", logoPath);
      }
      image.setAttribute("alt", appName);
    });
  };

  syncLogos();
  new MutationObserver(syncLogos).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(metadataConfig.adminBaseUrl),
  title: metadataConfig.portalName,
  description: metadataDescription,
  icons: {
    icon: metadataImage,
    apple: metadataImage,
  },
  openGraph: {
    title: metadataConfig.portalName,
    description: metadataDescription,
    url: metadataUrl,
    siteName: metadataConfig.portalName,
    images: [
      {
        url: metadataImage,
        width: 1024,
        height: 1024,
        alt: metadataConfig.appName,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataConfig.portalName,
    description: metadataDescription,
    images: [metadataImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: brandBootstrapScript }} />
        <AppBranding />
        <AuthProvider>
          <OfflineStatus />
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
