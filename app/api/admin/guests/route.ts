import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { toIso } from "@/lib/serialize-invitation";
import type { InviteLocale } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getNextPriority(db: Firestore): Promise<number> {
  const snap = await db
    .collection("invitations")
    .orderBy("priority", "desc")
    .limit(1)
    .get();
  if (snap.empty) return 1;
  const highest = snap.docs[0].data().priority ?? 0;
  return (typeof highest === "number" ? highest : 0) + 1;
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sortBy = searchParams.get("sortBy") || "priority";
    const filterStatus = searchParams.get("filterStatus") || "";
    const filterName = (searchParams.get("filterName") || "").trim().toLowerCase();
    const db = adminDb();

    // For guests page, include all statuses (draft + invited)
    const snap = await db
      .collection("invitations")
      .orderBy("priority", "asc")
      .limit(500)
      .get();

    let rows = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
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
    });

    // client-side filtering
    if (filterStatus) {
      const statuses = filterStatus.split(",").filter(Boolean);
      if (statuses.length > 0) {
        rows = rows.filter((r) => statuses.includes(r.status));
      }
    }
    if (filterName) {
      rows = rows.filter((r) =>
        r.guestName.toLowerCase().includes(filterName),
      );
    }

    // client-side sorting
    if (sortBy === "name") {
      rows.sort((a, b) => a.guestName.localeCompare(b.guestName));
    } else if (sortBy === "status") {
      const order = ["accepted", "pending", "expired", "declined", "revoked", "draft"];
      rows.sort((a, b) => {
        const ai = order.indexOf(a.status);
        const bi = order.indexOf(b.status);
        if (ai !== bi) return ai - bi;
        return a.guestName.localeCompare(b.guestName);
      });
    } else if (sortBy === "createdAt") {
      rows.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (at !== bt) return at - bt;
        return a.guestName.localeCompare(b.guestName);
      });
    }
    // default sortBy === "priority" already in Firestore order

    return NextResponse.json({ items: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as {
      guestName?: string;
      guestPhone?: string | null;
      locale?: InviteLocale;
      allowPlusOne?: boolean;
    };

    if (!body.guestName || typeof body.guestName !== "string" || !body.guestName.trim()) {
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    }

    const locale: InviteLocale = body.locale === "id" ? "id" : "en";
    const allowPlusOne = body.allowPlusOne !== false;
    const db = adminDb();
    const priority = await getNextPriority(db);

    const ref = await db.collection("invitations").add({
      guest_name: body.guestName.trim(),
      guest_phone: body.guestPhone?.trim() || null,
      locale,
      allow_plus_one: allowPlusOne,
      status: "draft",
      priority,
      token: null,
      expires_at: null,
      responded_at: null,
      created_by: auth.admin.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    const d = created.data()!;

    return NextResponse.json({
      id: ref.id,
      guestName: d.guest_name,
      guestPhone: d.guest_phone ?? null,
      locale: d.locale,
      status: d.status,
      priority: d.priority ?? 0,
      allowPlusOne: d.allow_plus_one !== false,
      createdAt: toIso(d.created_at),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
