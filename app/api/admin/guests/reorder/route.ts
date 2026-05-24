import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as { ids?: string[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const db = adminDb();
    const batch = db.batch();

    body.ids.forEach((id, index) => {
      const ref = db.collection("invitations").doc(id);
      batch.update(ref, {
        priority: index + 1,
        updated_at: FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    return NextResponse.json({ ok: true, updated: body.ids.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
