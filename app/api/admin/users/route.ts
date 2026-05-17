import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-api";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serialize-invitation";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "super_admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const snap = await adminDb().collection("admins").get();
    const items = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          uid: doc.id,
          email: d.email ?? "",
          name: d.name ?? "",
          role: d.role as AdminRole,
          createdAt: toIso(d.created_at),
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "super_admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      role?: AdminRole;
    };
    if (!body.email || !body.password || !body.name || !body.role) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    if (!["viewer", "editor", "super_admin"].includes(body.role)) {
      return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
    }

    const user = await adminAuth().createUser({
      email: body.email,
      password: body.password,
      displayName: body.name,
    });

    await adminDb()
      .collection("admins")
      .doc(user.uid)
      .set({
        email: body.email,
        name: body.name,
        role: body.role,
        created_at: new Date(),
      });

    await adminAuth().setCustomUserClaims(user.uid, { role: body.role });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("email-already-exists")) {
      return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
