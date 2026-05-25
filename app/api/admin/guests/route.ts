import { NextResponse } from "next/server";
import { FieldValue, type Firestore, type DocumentReference } from "firebase-admin/firestore";
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

function makeGuestResponse(docId: string, d: Record<string, unknown>) {
  return {
    id: docId,
    token: (d.token as string | null) ?? null,
    guestName: d.guest_name as string,
    guestPhone: (d.guest_phone as string | null) ?? null,
    locale: d.locale as string,
    status: d.status as string,
    priority: (d.priority as number) ?? 0,
    allowPlusOne: (d.allow_plus_one as boolean) !== false,
    expiresAt: toIso(d.expires_at as Parameters<typeof toIso>[0]),
    respondedAt: toIso(d.responded_at as Parameters<typeof toIso>[0]),
    createdAt: toIso(d.created_at as Parameters<typeof toIso>[0]),
    updatedAt: toIso(d.updated_at as Parameters<typeof toIso>[0]),
  };
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

    // Fetch all docs without Firestore orderBy so missing-priority docs aren't skipped
    const snap = await db
      .collection("invitations")
      .limit(500)
      .get();

    let rows = snap.docs.map((doc) => {
      const d = doc.data();
      return makeGuestResponse(doc.id, d);
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
    } else {
      // priority sort: missing priority goes to the end
      rows.sort((a, b) => {
        const ap = typeof a.priority === "number" ? a.priority : Infinity;
        const bp = typeof b.priority === "number" ? b.priority : Infinity;
        if (ap !== bp) return ap - bp;
        return a.guestName.localeCompare(b.guestName);
      });
    }

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
      items?: Array<{
        guestName?: string;
        guestPhone?: string | null;
        locale?: InviteLocale;
        allowPlusOne?: boolean;
      }>;
    };

    const db = adminDb();
    const locale: InviteLocale = body.locale === "id" ? "id" : "en";
    const allowPlusOne = body.allowPlusOne !== false;

    // BULK: items array
    if (Array.isArray(body.items) && body.items.length > 0) {
      const validItems = body.items
        .map((it) => ({
          name: (it.guestName ?? "").trim(),
          phone: (it.guestPhone ?? "").trim() || null,
          locale: it.locale === "id" ? "id" : "en",
          allowPlusOne: it.allowPlusOne !== false,
        }))
        .filter((it) => it.name.length > 0);

      if (validItems.length === 0) {
        return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
      }

      let nextPriority = await getNextPriority(db);
      const batch = db.batch();
      const refs: DocumentReference[] = [];

      for (const it of validItems) {
        const ref = db.collection("invitations").doc();
        batch.set(ref, {
          guest_name: it.name,
          guest_phone: it.phone,
          locale: it.locale,
          allow_plus_one: it.allowPlusOne,
          status: "draft",
          priority: nextPriority++,
          token: null,
          expires_at: null,
          responded_at: null,
          created_by: auth.admin.uid,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });
        refs.push(ref);
      }

      await batch.commit();

      // Read back created docs
      const created = await Promise.all(refs.map((r) => r.get()));
      const guests = created.map((snap) => makeGuestResponse(snap.id, snap.data()!));

      await logActivity(db, {
        kind: "guests_bulk_added",
        actorAdminId: auth.admin.uid,
        metadata: { count: guests.length },
      });

      return NextResponse.json({ items: guests });
    }

    // SINGLE
    if (!body.guestName || typeof body.guestName !== "string" || !body.guestName.trim()) {
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    }

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
    const guest = makeGuestResponse(ref.id, created.data()!);

    await logActivity(db, {
      kind: "guest_added",
      actorAdminId: auth.admin.uid,
      invitationId: ref.id,
      guestName: guest.guestName,
    });

    return NextResponse.json(guest);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
