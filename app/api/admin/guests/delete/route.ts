import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import type { InvitationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as { ids?: string[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const db = adminDb();
    const results: {
      id: string;
      ok: boolean;
      action?: "deleted" | "revoked";
      error?: string;
    }[] = [];

    for (const id of body.ids) {
      const ref = db.collection("invitations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        results.push({ id, ok: false, error: "NOT_FOUND" });
        continue;
      }

      const d = snap.data()!;
      const status = d.status as InvitationStatus;

      if (status === "draft") {
        await ref.delete();
        results.push({ id, ok: true, action: "deleted" });
        continue;
      }

      const revokePatch: Record<string, unknown> = {
        status: "revoked",
        updated_at: FieldValue.serverTimestamp(),
      };

      if (d.wishes !== undefined && d.wishes !== null) {
        revokePatch.wishes = FieldValue.delete();
      }
      if (d.responded_at !== undefined && d.responded_at !== null) {
        revokePatch.responded_at = FieldValue.delete();
      }

      await ref.update(revokePatch);

      await logActivity(db, {
        kind: "invitation_revoked",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });

      results.push({ id, ok: true, action: "revoked" });
    }

    return NextResponse.json({ items: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
