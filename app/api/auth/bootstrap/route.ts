import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function firebaseAuthError(e: unknown): { code: string; message: string } | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const code = o.code;
  if (typeof code === "string" && code.startsWith("auth/")) {
    return {
      code,
      message: typeof o.message === "string" ? o.message : code,
    };
  }
  const info = o.errorInfo as { code?: string; message?: string } | undefined;
  if (info?.code?.startsWith("auth/")) {
    return {
      code: info.code,
      message: info.message ?? info.code,
    };
  }
  return null;
}

const isDev = process.env.NODE_ENV === "development";

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
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("Missing FIREBASE_SERVICE_ACCOUNT_KEY")) {
      return NextResponse.json(
        {
          error: "ADMIN_SDK_NOT_CONFIGURED",
          detail: isDev ? msg : undefined,
        },
        { status: 503 },
      );
    }

    if (msg.includes("must be valid JSON")) {
      return NextResponse.json(
        {
          error: "INVALID_SERVICE_ACCOUNT_JSON",
          detail: isDev ? msg : undefined,
        },
        { status: 503 },
      );
    }

    const authErr = firebaseAuthError(e);
    if (authErr) {
      if (authErr.code === "auth/email-already-exists") {
        return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
      }
      return NextResponse.json(
        {
          error: authErr.code,
          detail: isDev ? authErr.message : undefined,
        },
        { status: 400 },
      );
    }

    if (msg.includes("email-already-exists")) {
      return NextResponse.json({ error: "EMAIL_IN_USE" }, { status: 409 });
    }

    console.error(e);
    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        detail: isDev ? msg : undefined,
      },
      { status: 500 },
    );
  }
}
