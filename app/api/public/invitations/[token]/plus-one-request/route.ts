import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { effectiveInvitationStatus } from "@/lib/serialize-invitation";
import { readIncludesPlusOne, readPlusOneRequestStatusPublic } from "@/lib/plus-one";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;
    const db = adminDb();
    const snap = await db
      .collection("invitations")
      .where("token", "==", token)
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ error: "INVITATION_NOT_FOUND" }, { status: 404 });
    }

    const docRef = snap.docs[0]!.ref;
    const d = snap.docs[0]!.data();
    const status = d.status as string;
    const expiresAt = d.expires_at?.toDate?.() ?? null;
    const effective = effectiveInvitationStatus(status, expiresAt);

    if (status === "revoked") {
      return NextResponse.json({ error: "INVITATION_REVOKED" }, { status: 403 });
    }
    if (effective !== "pending") {
      if (effective === "expired") {
        return NextResponse.json({ error: "INVITATION_EXPIRED" }, { status: 409 });
      }
      return NextResponse.json({ error: "NOT_PENDING" }, { status: 409 });
    }

    if (readIncludesPlusOne(d)) {
      return NextResponse.json({ error: "ALREADY_INCLUDES_PLUS_ONE" }, { status: 409 });
    }

    const reqStatus = readPlusOneRequestStatusPublic(d);
    if (reqStatus === "pending") {
      return NextResponse.json({ ok: true, status: "already_pending" });
    }

    await docRef.update({
      plus_one_request_status: "pending",
      plus_one_requested_at: FieldValue.serverTimestamp(),
      plus_one_resolved_at: FieldValue.delete(),
      plus_one_resolved_by: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await logActivity(db, {
      kind: "plus_one_requested",
      invitationId: docRef.id,
      guestName: d.guest_name,
    });

    return NextResponse.json({ ok: true, status: "pending" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
