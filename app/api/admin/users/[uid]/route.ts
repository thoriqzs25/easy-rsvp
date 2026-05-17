import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-api";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { uid: string } },
) {
  const auth = await requireAdmin(req, "super_admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { uid } = params;
    const body = (await req.json()) as { role?: AdminRole };
    if (!body.role || !["viewer", "editor", "super_admin"].includes(body.role)) {
      return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
    }
    if (uid === auth.admin.uid && body.role !== "super_admin") {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 400 },
      );
    }
    const ref = adminDb().collection("admins").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await ref.update({ role: body.role });
    await adminAuth().setCustomUserClaims(uid, { role: body.role });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
