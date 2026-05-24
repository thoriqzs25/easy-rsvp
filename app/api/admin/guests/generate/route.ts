import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { generateTokenUrlSafe } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
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

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      ids?: string[];
      expiresAt?: string | null;
    };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const db = adminDb();
    const expires =
      body.expiresAt && !Number.isNaN(Date.parse(body.expiresAt))
        ? new Date(body.expiresAt)
        : defaultInvitationExpiresAt();

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const id of body.ids) {
      const ref = db.collection("invitations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        results.push({ id, ok: false, error: "NOT_FOUND" });
        continue;
      }

      const d = snap.data()!;
      if (d.status !== "draft") {
        results.push({ id, ok: false, error: "NOT_DRAFT" });
        continue;
      }

      if (!d.guest_phone || typeof d.guest_phone !== "string" || !d.guest_phone.trim()) {
        results.push({ id, ok: false, error: "MISSING_PHONE" });
        continue;
      }

      const token = await uniqueInviteToken(db);
      await ref.update({
        token,
        status: "pending",
        expires_at: expires,
        updated_at: FieldValue.serverTimestamp(),
      });

      await logActivity(db, {
        kind: "invitation_created",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });

      results.push({ id, ok: true });
    }

    return NextResponse.json({ items: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
