import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { generateTokenUrlSafe } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { toIso } from "@/lib/serialize-invitation";
import type { InviteLocale } from "@/lib/types";
import { defaultInvitationExpiresAt } from "@/lib/datetime-local";

export const dynamic = "force-dynamic";

async function uniqueInviteToken(db: Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const t = generateTokenUrlSafe();
    const exists = await db
      .collection("invitations")
      .where("token", "==", t)
      .limit(1)
      .get();
    if (exists.empty) return t;
  }
  throw new Error("TOKEN_COLLISION");
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const nameQ = (searchParams.get("name") || "").trim().toLowerCase();
    const db = adminDb();
    const snap =
      status && status !== "all"
        ? await db
            .collection("invitations")
            .where("status", "==", status)
            .orderBy("created_at", "desc")
            .limit(100)
            .get()
        : await db
            .collection("invitations")
            .orderBy("created_at", "desc")
            .limit(100)
            .get();
    let rows = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        token: d.token,
        guestName: d.guest_name,
        guestPhone: d.guest_phone ?? null,
        locale: d.locale,
        status: d.status,
        expiresAt: toIso(d.expires_at),
        respondedAt: toIso(d.responded_at),
        hasWishes: Boolean(d.wishes && String(d.wishes).trim()),
        createdAt: toIso(d.created_at),
      };
    });
    if (nameQ) {
      rows = rows.filter((r) => r.guestName.toLowerCase().includes(nameQ));
    }
    return NextResponse.json({ items: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      guestName?: string;
      guestPhone?: string | null;
      locale?: InviteLocale;
      expiresAt?: string | null;
    };
    if (!body.guestName || typeof body.guestName !== "string") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const locale: InviteLocale = body.locale === "id" ? "id" : "en";
    const expires =
      body.expiresAt && !Number.isNaN(Date.parse(body.expiresAt))
        ? new Date(body.expiresAt)
        : defaultInvitationExpiresAt();

    const db = adminDb();
    const token = await uniqueInviteToken(db);
    const ref = await db.collection("invitations").add({
      token,
      guest_name: body.guestName.trim(),
      guest_phone: body.guestPhone?.trim() || null,
      locale,
      status: "pending",
      expires_at: expires,
      responded_at: null,
      created_by: auth.admin.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await logActivity(db, {
      kind: "invitation_created",
      invitationId: ref.id,
      guestName: body.guestName.trim(),
      actorAdminId: auth.admin.uid,
    });

    const created = await ref.get();
    const d = created.data()!;

    return NextResponse.json({
      id: ref.id,
      token: d.token,
      sharePath: `/rsvp/${d.token}`,
      expiresAt: toIso(d.expires_at),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
