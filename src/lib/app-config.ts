import type { FirebaseOptions } from "firebase/app";

export type AppKey = "earlylearning" | "elementarylearning";

export interface AppConfig {
  key: AppKey;
  pathPrefix: string;
  appName: string;
  portalName: string;
  logoPath: string;
  primaryColor: string;
  primaryHoverColor: string;
  adminBaseUrl: string;
  iosAppUrl: string;
  androidAppUrl: string;
  firebase: FirebaseOptions & { databaseURL: string };
}

const earlyLearningFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const APP_CONFIGS: Record<AppKey, AppConfig> = {
  earlylearning: {
    key: "earlylearning",
    pathPrefix: "/earlylearning",
    appName: "Early Learning Library",
    portalName: "Early Learning Admin Portal",
    logoPath: "/brands/earlylearning/logo.png",
    primaryColor: "#155C8A",
    primaryHoverColor: "#0F4D78",
    adminBaseUrl: "https://class-room-admin.vercel.app",
    iosAppUrl: "https://apps.apple.com/us/app/head-start-learning-library/id6457893828",
    androidAppUrl: "https://play.google.com/store/apps/details?id=com.skc.head.start.learning.library",
    firebase: earlyLearningFirebaseConfig,
  },
  elementarylearning: {
    key: "elementarylearning",
    pathPrefix: "/elementarylearning",
    appName: "Classroom Solution",
    portalName: "Elementary Learning Admin Portal",
    logoPath: "/brands/classroom/logo.png",
    primaryColor: "#660033",
    primaryHoverColor: "#4D0026",
    adminBaseUrl: "https://admin.classroomsolution.app",
    iosAppUrl: "https://apps.apple.com/us/app/smart-kidz-club-classroom/id1505785970?ls=1",
    androidAppUrl: "https://play.google.com/store/apps/details?id=com.skc.classroom",
    firebase: {
      apiKey: "AIzaSyAc-yMj7Avsybe4tcvf0kmNU_6VBUk6EBM",
      authDomain: "classroomapp-1abfc.firebaseapp.com",
      databaseURL: "https://classroomapp-1abfc.firebaseio.com",
      projectId: "classroomapp-1abfc",
      storageBucket: "classroomapp-1abfc.appspot.com",
      messagingSenderId: "475697762464",
      appId: "1:475697762464:web:2b4aebc9ce35cff83ab9c5",
      measurementId: "G-0MY3NJDR14",
    },
  },
};

export const APP_KEYS = Object.keys(APP_CONFIGS) as AppKey[];

export function getAppKeyFromPath(pathname: string): AppKey | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];

  return APP_KEYS.includes(firstSegment as AppKey)
    ? (firstSegment as AppKey)
    : null;
}

export function getCurrentAppKey(): AppKey {
  if (typeof window === "undefined") {
    return "earlylearning";
  }

  return getAppKeyFromPath(window.location.pathname) || "earlylearning";
}

export function getCurrentAppConfig() {
  return APP_CONFIGS[getCurrentAppKey()];
}

export function getAppConfigByPath(pathname: string) {
  return APP_CONFIGS[getAppKeyFromPath(pathname) || "earlylearning"];
}
