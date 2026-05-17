import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/** Registers the first super_admin when passkey matches and no super_admin exists yet. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      passkey?: string;
    };
    const { email, password, name, passkey } = body;
    if (
      !email ||
      !password ||
      !name ||
      !passkey ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string"
    ) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const expected = process.env.SUPER_ADMIN_BOOTSTRAP_PASSKEY;
    if (!expected) {
      return NextResponse.json(
        { error: "BOOTSTRAP_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    if (passkey !== expected) {
      return NextResponse.json({ error: "INVALID_PASSKEY" }, { status: 403 });
    }

    const db = adminDb();
    const existingSuper = await db
      .collection("admins")
      .where("role", "==", "super_admin")
      .limit(1)
      .get();
    if (!existingSuper.empty) {
      return NextResponse.json(
        { error: "BOOTSTRAP_DISABLED" },
        { status: 403 },
      );
    }

    const auth = adminAuth();
    const user = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    await db.collection("admins").doc(user.uid).set({
      email,
      name,
      role: "super_admin",
      created_at: new Date(),
    });

    await auth.setCustomUserClaims(user.uid, { role: "super_admin" });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.includes("email-already-exists")) {
      return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
