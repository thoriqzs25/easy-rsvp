import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const d = (
    await adminDb().collection("admins").doc(auth.admin.uid).get()
  ).data();
  return NextResponse.json({
    uid: auth.admin.uid,
    email: auth.admin.email ?? d?.email ?? "",
    name: d?.name ?? "",
    role: auth.admin.role,
  });
}
