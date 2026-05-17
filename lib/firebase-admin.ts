import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App;

export function getFirebaseAdminApp(): App {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) {
      throw new Error(
        "Missing FIREBASE_SERVICE_ACCOUNT_KEY — add service account JSON string to env.",
      );
    }
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    app = initializeApp({
      credential: cert({
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key?.replace(/\\n/g, "\n"),
        projectId: parsed.project_id,
      }),
    });
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function adminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function adminDb() {
  return getFirestore(getFirebaseAdminApp());
}
