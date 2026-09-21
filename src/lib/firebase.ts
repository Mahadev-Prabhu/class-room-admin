import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getDatabase, Database } from "firebase/database";
import { getFunctions, Functions } from "firebase/functions";
import { getCurrentAppConfig } from "./app-config";

const activeAppConfig = getCurrentAppConfig();
export const firebaseConfig = activeAppConfig.firebase;

// Check if Firebase config is valid
const isConfigValid =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.databaseURL &&
  firebaseConfig.projectId &&
  firebaseConfig.appId;

// Initialize Firebase only if config is valid
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let database: Database | undefined;
let functions: Functions | undefined;

if (isConfigValid) {
  app = getApps().some((item) => item.name === activeAppConfig.key)
    ? getApp(activeAppConfig.key)
    : initializeApp(firebaseConfig, activeAppConfig.key);
  auth = getAuth(app);
  database = getDatabase(app);
  functions = getFunctions(app, "us-central1");
}

export { app, auth, database, functions };
