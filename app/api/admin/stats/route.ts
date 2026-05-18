import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import type { InvitationStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: InvitationStatus[] = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
];

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const db = adminDb();
    const results = await Promise.all(
      STATUSES.map((s) =>
        db
          .collection("invitations")
          .where("status", "==", s)
          .count()
          .get(),
      ),
    );
    const byStatus = Object.fromEntries(
      STATUSES.map((s, i) => [s, results[i]!.data().count]),
    ) as Record<InvitationStatus, number>;

    const total = STATUSES.reduce((sum, s) => sum + byStatus[s], 0);

    const plusOneSnap = await db
      .collection("invitations")
      .where("status", "==", "pending")
      .where("plus_one_request_status", "==", "pending")
      .count()
      .get();
    const pendingPlusOneRequests = plusOneSnap.data().count;

    return NextResponse.json({ total, byStatus, pendingPlusOneRequests });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
