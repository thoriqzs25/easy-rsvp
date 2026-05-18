import { NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { toIso, effectiveInvitationStatus } from "@/lib/serialize-invitation";
import type { InviteLocale, InvitationStatus } from "@/lib/types";
import {
  readIncludesPlusOne,
  readPlusOneRequestStatusPublic,
  plusOneRequestFieldDeletes,
} from "@/lib/plus-one";

export const dynamic = "force-dynamic";

function serialize(docId: string, d: DocumentData) {
  const expiresAt = d.expires_at?.toDate?.() ?? null;
  const effective = effectiveInvitationStatus(
    d.status as string,
    expiresAt,
  );
  return {
    id: docId,
    token: d.token,
    guestName: d.guest_name,
    guestPhone: d.guest_phone ?? null,
    locale: d.locale,
    status: d.status,
    effectiveStatus: effective,
    wishes: d.wishes ?? "",
    expiresAt: toIso(d.expires_at),
    respondedAt: toIso(d.responded_at),
    createdAt: toIso(d.created_at),
    updatedAt: toIso(d.updated_at),
    sharePath: `/rsvp/${d.token}`,
    includesPlusOne: readIncludesPlusOne(d),
    plusOneRequestStatus: readPlusOneRequestStatusPublic(d),
  };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = params;
    const doc = await adminDb().collection("invitations").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(serialize(doc.id, doc.data()!));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = params;
    const body = (await req.json()) as
      | {
          action: "renew";
          expiresAt: string;
        }
      | { action: "reopen"; expiresAt: string }
      | { action: "revoke" }
      | {
          action: "update";
          guestName?: string;
          guestPhone?: string | null;
          locale?: InviteLocale;
        }
      | { action: "approve_plus_one" }
      | { action: "reject_plus_one" };

    const ref = adminDb().collection("invitations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const d = snap.data()!;
    const status = d.status as InvitationStatus;
    const expiresAtDate = d.expires_at?.toDate?.() ?? null;
    const now = Date.now();
    const pastExpiry =
      Boolean(expiresAtDate) && expiresAtDate!.getTime() <= now;

    if (body.action === "revoke") {
      if (status === "revoked") {
        return NextResponse.json({ error: "ALREADY_REVOKED" }, { status: 409 });
      }
      await ref.update({
        status: "revoked",
        updated_at: FieldValue.serverTimestamp(),
      });
      await logActivity(adminDb(), {
        kind: "invitation_revoked",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "approve_plus_one") {
      if (d.plus_one_request_status !== "pending") {
        return NextResponse.json(
          { error: "NO_PENDING_PLUS_ONE_REQUEST" },
          { status: 409 },
        );
      }
      await ref.update({
        includes_plus_one: true,
        updated_at: FieldValue.serverTimestamp(),
        ...plusOneRequestFieldDeletes(),
      });
      await logActivity(adminDb(), {
        kind: "plus_one_approved",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reject_plus_one") {
      if (d.plus_one_request_status !== "pending") {
        return NextResponse.json(
          { error: "NO_PENDING_PLUS_ONE_REQUEST" },
          { status: 409 },
        );
      }
      await ref.update({
        plus_one_request_status: "rejected",
        plus_one_resolved_at: FieldValue.serverTimestamp(),
        plus_one_resolved_by: auth.admin.uid,
        updated_at: FieldValue.serverTimestamp(),
      });
      await logActivity(adminDb(), {
        kind: "plus_one_rejected",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update") {
      const patch: Record<string, unknown> = {
        updated_at: FieldValue.serverTimestamp(),
      };
      if (body.guestName !== undefined) {
        if (typeof body.guestName !== "string" || !body.guestName.trim()) {
          return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
        }
        patch.guest_name = body.guestName.trim();
      }
      if (body.guestPhone !== undefined) {
        patch.guest_phone =
          body.guestPhone === null || body.guestPhone === ""
            ? null
            : String(body.guestPhone).trim();
      }
      if (body.locale !== undefined) {
        patch.locale = body.locale === "id" ? "id" : "en";
      }
      await ref.update(patch);
      return NextResponse.json({ ok: true });
    }

    const expRaw =
      body.action === "renew" || body.action === "reopen"
        ? body.expiresAt
        : "";
    if (!expRaw || Number.isNaN(Date.parse(expRaw))) {
      return NextResponse.json({ error: "INVALID_EXPIRES_AT" }, { status: 400 });
    }
    const newExp = new Date(expRaw);

    if (body.action === "renew") {
      const allowed =
        status === "expired" ||
        status === "declined" ||
        status === "revoked" ||
        (status === "pending" && pastExpiry);
      if (!allowed) {
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
      await logActivity(adminDb(), {
        kind: "invitation_renewed",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reopen") {
      if (status !== "accepted") {
        return NextResponse.json(
          { error: "CANNOT_REOPEN" },
          { status: 400 },
        );
      }
      const reopenPatch: Record<string, unknown> = {
        status: "pending",
        expires_at: newExp,
        responded_at: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
        ...plusOneRequestFieldDeletes(),
      };
      if (d.wishes !== undefined && d.wishes !== null) {
        reopenPatch.wishes = FieldValue.delete();
      }
      await ref.update(reopenPatch);
      await logActivity(adminDb(), {
        kind: "invitation_reopened",
        invitationId: id,
        guestName: d.guest_name,
        actorAdminId: auth.admin.uid,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
