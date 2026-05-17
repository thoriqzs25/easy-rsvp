import { adminAuth, adminDb } from "./firebase-admin";
import type { AdminRole } from "./types";
import { ROLE_ORDER } from "./types";

export type AuthedAdmin = {
  uid: string;
  email: string | undefined;
  role: AdminRole;
};

export async function getBearerToken(req: Request): Promise<string | null> {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

export async function requireAdmin(
  req: Request,
  minRole: AdminRole,
): Promise<{ admin: AuthedAdmin } | { error: string; status: number }> {
  const token = await getBearerToken(req);
  if (!token) return { error: "Unauthorized", status: 401 };
  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    return { error: "Invalid token", status: 401 };
  }
  const snap = await adminDb().collection("admins").doc(uid).get();
  if (!snap.exists) {
    return { error: "Not an admin", status: 403 };
  }
  const role = snap.data()?.role as AdminRole | undefined;
  if (!role || !(role in ROLE_ORDER)) {
    return { error: "Invalid role", status: 403 };
  }
  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
    return { error: "Forbidden", status: 403 };
  }
  return { admin: { uid, email, role } };
}
