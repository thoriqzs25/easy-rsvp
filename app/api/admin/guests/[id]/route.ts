import { NextResponse } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serialize-invitation";
import type { InviteLocale } from "@/lib/types";

export const dynamic = "force-dynamic";

function serialize(docId: string, d: DocumentData) {
  return {
    id: docId,
    token: d.token ?? null,
    guestName: d.guest_name,
    guestPhone: d.guest_phone ?? null,
    locale: d.locale,
    status: d.status,
    priority: d.priority ?? 0,
    allowPlusOne: d.allow_plus_one !== false,
    expiresAt: toIso(d.expires_at),
    respondedAt: toIso(d.responded_at),
    createdAt: toIso(d.created_at),
    updatedAt: toIso(d.updated_at),
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
    const body = (await req.json()) as {
      guestName?: string;
      guestPhone?: string | null;
      locale?: InviteLocale;
      allowPlusOne?: boolean;
    };

    const ref = adminDb().collection("invitations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const d = snap.data()!;
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

    if (body.allowPlusOne !== undefined) {
      patch.allow_plus_one = body.allowPlusOne === true;
    }

    await ref.update(patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = params;
    const ref = adminDb().collection("invitations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
