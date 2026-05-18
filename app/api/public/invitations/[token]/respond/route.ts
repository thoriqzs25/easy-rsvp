import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { effectiveInvitationStatus } from "@/lib/serialize-invitation";
import type { InvitationStatus } from "@/lib/types";
import { plusOneRequestFieldDeletes } from "@/lib/plus-one";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;
    const body = (await req.json()) as {
      action?: "accept" | "decline";
      wishes?: string;
    };
    if (body.action !== "accept" && body.action !== "decline") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

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
    const status = d.status as InvitationStatus;
    const expiresAt = d.expires_at?.toDate?.() ?? null;
    const effective = effectiveInvitationStatus(status, expiresAt);

    if (status === "revoked") {
      return NextResponse.json({ error: "INVITATION_REVOKED" }, { status: 403 });
    }

    if (effective !== "pending") {
      if (effective === "expired") {
        return NextResponse.json({ error: "INVITATION_EXPIRED" }, { status: 409 });
      }
      return NextResponse.json({ error: "ALREADY_RESPONDED" }, { status: 409 });
    }

    if (body.action === "decline") {
      const declinePatch: Record<string, unknown> = {
        status: "declined",
        responded_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        ...plusOneRequestFieldDeletes(),
      };
      if (d.wishes !== undefined && d.wishes !== null) {
        declinePatch.wishes = FieldValue.delete();
      }
      await docRef.update(declinePatch);
      await logActivity(db, {
        kind: "rsvp_declined",
        invitationId: docRef.id,
        guestName: d.guest_name,
      });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    const wishes =
      typeof body.wishes === "string" ? body.wishes.trim().slice(0, 4000) : "";

    const patch: Record<string, unknown> = {
      status: "accepted",
      responded_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      ...plusOneRequestFieldDeletes(),
    };
    if (wishes) patch.wishes = wishes;
    else patch.wishes = FieldValue.delete();

    await docRef.update(patch);
    await logActivity(db, {
      kind: "rsvp_accepted",
      invitationId: docRef.id,
      guestName: d.guest_name,
      metadata: wishes ? { hasWishes: true } : {},
    });

    return NextResponse.json({ ok: true, status: "accepted" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
