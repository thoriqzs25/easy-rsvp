import { NextResponse } from "next/server";
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
    const results: {
      id: string;
      ok: boolean;
      action?: "deleted";
      error?: string;
    }[] = [];

    for (const id of body.ids) {
      const ref = db.collection("invitations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        results.push({ id, ok: false, error: "NOT_FOUND" });
        continue;
      }

      await ref.delete();
      results.push({ id, ok: true, action: "deleted" });
    }

    return NextResponse.json({ items: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
