import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { toIso, effectiveInvitationStatus } from "@/lib/serialize-invitation";
import { readIncludesPlusOne, readPlusOneRequestStatusPublic } from "@/lib/plus-one";

export const dynamic = "force-dynamic";

export async function GET(
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
    const doc = snap.docs[0]!;
    const d = doc.data();
    const status = d.status as string;
    if (status === "draft") {
      return NextResponse.json({ error: "INVITATION_NOT_FOUND" }, { status: 404 });
    }
    const expiresAt = d.expires_at?.toDate?.() ?? null;
    const effective = effectiveInvitationStatus(status, expiresAt);

    const eventSnap = await db.collection("event_config").doc("current").get();
    const eventData = eventSnap.exists ? eventSnap.data() : null;

    return NextResponse.json({
      id: doc.id,
      guestName: d.guest_name,
      locale: d.locale,
      status,
      effectiveStatus: effective,
      expiresAt: toIso(d.expires_at),
      wishes: d.wishes ?? "",
      respondedAt: toIso(d.responded_at),
      includesPlusOne: readIncludesPlusOne(d),
      plusOneRequestStatus: readPlusOneRequestStatusPublic(d),
      event: eventData
        ? { lines: eventData.lines ?? null, venueUrl: eventData.venueUrl ?? "", invitationUrl: eventData.invitationUrl ?? "", updatedAt: toIso(eventData.updated_at) }
        : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
