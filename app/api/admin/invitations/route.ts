import { NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { generateTokenUrlSafe } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { toIso } from "@/lib/serialize-invitation";
import type { InviteLocale } from "@/lib/types";
import { defaultInvitationExpiresAt } from "@/lib/datetime-local";
import { readIncludesPlusOne, readPlusOneRequestStatusPublic } from "@/lib/plus-one";

export const dynamic = "force-dynamic";

async function uniqueInviteToken(db: Firestore): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const t = generateTokenUrlSafe();
    const exists = await db
      .collection("invitations")
      .where("token", "==", t)
      .limit(1)
      .get();
    if (exists.empty) return t;
  }
  throw new Error("TOKEN_COLLISION");
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "";
    const nameQ = (searchParams.get("name") || "").trim().toLowerCase();
    const plusOnePending = searchParams.get("plusOnePending") === "1";
    const includeDrafts = searchParams.get("includeDrafts") === "1";
    const sortBy = searchParams.get("sortBy") || "priority";
    const filterStatus = searchParams.get("filterStatus") || "";
    const filterName = (searchParams.get("filterName") || "").trim().toLowerCase();
    const db = adminDb();
    let snap;

    if (plusOnePending) {
      snap = await db
        .collection("invitations")
        .where("status", "==", "pending")
        .where("plus_one_request_status", "==", "pending")
        .orderBy("created_at", "desc")
        .limit(200)
        .get();
    } else if (statusParam && statusParam !== "all") {
      snap = await db
        .collection("invitations")
        .where("status", "==", statusParam)
        .orderBy("created_at", "desc")
        .limit(200)
        .get();
    } else if (includeDrafts) {
      // Fetch all docs without Firestore orderBy so missing-priority docs aren't skipped
      snap = await db
        .collection("invitations")
        .limit(500)
        .get();
    } else {
      snap = await db
        .collection("invitations")
        .orderBy("created_at", "desc")
        .limit(200)
        .get();
    }

    let rows = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        token: d.token,
        guestName: d.guest_name,
        guestPhone: d.guest_phone ?? null,
        locale: d.locale,
        status: d.status,
        priority: d.priority ?? 0,
        allowPlusOne: d.allow_plus_one !== false,
        expiresAt: toIso(d.expires_at),
        respondedAt: toIso(d.responded_at),
        hasWishes: Boolean(d.wishes && String(d.wishes).trim()),
        createdAt: toIso(d.created_at),
        includesPlusOne: readIncludesPlusOne(d),
        plusOneRequestStatus: readPlusOneRequestStatusPublic(d),
      };
    });

    if (nameQ) {
      rows = rows.filter((r) => r.guestName.toLowerCase().includes(nameQ));
    }

    if (includeDrafts) {
      // client-side filtering for guest list
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
      // server-side sortBy for guest list
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
      // default sortBy === "priority"
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
      expiresAt?: string | null;
      includesPlusOne?: boolean;
    };
    if (!body.guestName || typeof body.guestName !== "string") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const locale: InviteLocale = body.locale === "id" ? "id" : "en";
    const includesPlusOne = body.includesPlusOne !== false;
    const expires =
      body.expiresAt && !Number.isNaN(Date.parse(body.expiresAt))
        ? new Date(body.expiresAt)
        : defaultInvitationExpiresAt();

    const db = adminDb();
    const token = await uniqueInviteToken(db);
    const ref = await db.collection("invitations").add({
      token,
      guest_name: body.guestName.trim(),
      guest_phone: body.guestPhone?.trim() || null,
      locale,
      includes_plus_one: includesPlusOne,
      status: "pending",
      expires_at: expires,
      responded_at: null,
      created_by: auth.admin.uid,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    await logActivity(db, {
      kind: "invitation_created",
      invitationId: ref.id,
      guestName: body.guestName.trim(),
      actorAdminId: auth.admin.uid,
    });

    const created = await ref.get();
    const d = created.data()!;

    return NextResponse.json({
      id: ref.id,
      token: d.token,
      sharePath: `/rsvp/${d.token}`,
      expiresAt: toIso(d.expires_at),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
