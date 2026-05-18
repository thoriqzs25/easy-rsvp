import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * Scheduled expiry job (runs once per day; Vercel cron schedules are in UTC).
 * Marks pending invitations with expires_at in the past as expired.
 *
 * If CRON_SECRET is set, require x-cron-secret or Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron supports the bearer form).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = req.headers.get("authorization");
    const header = req.headers.get("x-cron-secret");
    const ok = header === secret || bearer === `Bearer ${secret}`;
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  try {
    const db = adminDb();
    const snap = await db
      .collection("invitations")
      .where("status", "==", "pending")
      .where("expires_at", "<", new Date())
      .get();

    const CHUNK = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const slice = docs.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const doc of slice) {
        batch.update(doc.ref, {
          status: "expired",
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    for (const doc of docs) {
      const d = doc.data();
      await logActivity(db, {
        kind: "invitation_expired",
        invitationId: doc.id,
        guestName: d.guest_name,
      });
    }

    return NextResponse.json({ expired: docs.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
