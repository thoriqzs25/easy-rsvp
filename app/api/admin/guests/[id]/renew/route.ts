import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { plusOneRequestFieldDeletes } from "@/lib/plus-one";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = params;
    const body = (await req.json()) as { expiresAt?: string };
    const expRaw = body.expiresAt ?? "";
    if (!expRaw || Number.isNaN(Date.parse(expRaw))) {
      return NextResponse.json({ error: "INVALID_EXPIRES_AT" }, { status: 400 });
    }
    const newExp = new Date(expRaw);

    const ref = adminDb().collection("invitations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const d = snap.data()!;
    const status = d.status as string;

    const allowed = ["expired", "declined", "revoked"].includes(status);
    if (!allowed && status !== "pending") {
      return NextResponse.json(
        { error: "CANNOT_RENEW_STATE" },
        { status: 400 },
      );
    }

    const renewPatch: Record<string, unknown> = {
      status: "pending",
      expires_at: newExp,
      responded_at: FieldValue.delete(),
      updated_at: FieldValue.serverTimestamp(),
      ...plusOneRequestFieldDeletes(),
    };
    if (d.wishes !== undefined && d.wishes !== null) {
      renewPatch.wishes = FieldValue.delete();
    }

    await ref.update(renewPatch);

    const kind =
      status === "revoked" ? "invitation_renewed" : "invitation_renewed";
    await logActivity(adminDb(), {
      kind,
      invitationId: id,
      guestName: d.guest_name,
      actorAdminId: auth.admin.uid,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
