import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { browserOsFromUserAgent } from "@/lib/ua-meta";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
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
    const ua = req.headers.get("user-agent");
    const { browser, os } = browserOsFromUserAgent(ua);

    await logActivity(db, {
      kind: "invitation_page_view",
      invitationId: doc.id,
      guestName: d.guest_name,
      metadata: { browser, os },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
