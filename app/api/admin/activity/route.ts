import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { toIso } from "@/lib/serialize-invitation";
import type { ActivityKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACCESS_KIND: ActivityKind = "invitation_page_view";

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit")) || 30),
    );
    const nameQ = (searchParams.get("name") || "").trim().toLowerCase();
    const kindFilter = (searchParams.get("kind") || "").trim() as ActivityKind | "";
    const accessOnly = searchParams.get("accessOnly") === "1";
    const includeAll = searchParams.get("includeAll") === "1";

    const snap = await adminDb()
      .collection("activity_events")
      .orderBy("created_at", "desc")
      .limit(Math.min(200, limit * 6))
      .get();

    let rows = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        kind: d.kind as string,
        invitationId: d.invitation_id ?? null,
        guestName: d.guest_name ?? null,
        actorAdminId: d.actor_admin_id ?? null,
        metadata: d.metadata ?? {},
        createdAt: toIso(d.created_at),
      };
    });

    if (accessOnly) {
      rows = rows.filter((r) => r.kind === ACCESS_KIND);
    } else if (kindFilter) {
      rows = rows.filter((r) => r.kind === kindFilter);
    } else if (!includeAll) {
      rows = rows.filter((r) => r.kind !== ACCESS_KIND);
    }

    if (nameQ) {
      rows = rows.filter((r) =>
        (r.guestName || "").toLowerCase().includes(nameQ),
      );
    }

    const page = rows.slice(0, limit);

    return NextResponse.json({ items: page });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
