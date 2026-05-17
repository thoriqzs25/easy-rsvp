import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { toIso } from "@/lib/serialize-invitation";

export const dynamic = "force-dynamic";

const DOC_ID = "current";

type Lines = {
  en: {
    heading: string;
    date: string;
    time: string;
    venue: string;
    notes: string;
  };
  id: {
    heading: string;
    date: string;
    time: string;
    venue: string;
    notes: string;
  };
};

const emptyLines = (): Lines => ({
  en: { heading: "", date: "", time: "", venue: "", notes: "" },
  id: { heading: "", date: "", time: "", venue: "", notes: "" },
});

export async function GET(req: Request) {
  const auth = await requireAdmin(req, "viewer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const doc = await adminDb().collection("event_config").doc(DOC_ID).get();
    if (!doc.exists) {
      return NextResponse.json({
        lines: emptyLines(),
        updatedAt: null,
      });
    }
    const d = doc.data()!;
    return NextResponse.json({
      lines: d.lines ?? emptyLines(),
      updatedAt: toIso(d.updated_at),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = (await req.json()) as { lines?: Lines };
    if (!body.lines || typeof body.lines !== "object") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }
    const lines = {
      en: {
        heading: String(body.lines.en?.heading ?? "").slice(0, 500),
        date: String(body.lines.en?.date ?? "").slice(0, 500),
        time: String(body.lines.en?.time ?? "").slice(0, 500),
        venue: String(body.lines.en?.venue ?? "").slice(0, 2000),
        notes: String(body.lines.en?.notes ?? "").slice(0, 4000),
      },
      id: {
        heading: String(body.lines.id?.heading ?? "").slice(0, 500),
        date: String(body.lines.id?.date ?? "").slice(0, 500),
        time: String(body.lines.id?.time ?? "").slice(0, 500),
        venue: String(body.lines.id?.venue ?? "").slice(0, 2000),
        notes: String(body.lines.id?.notes ?? "").slice(0, 4000),
      },
    };

    await adminDb()
      .collection("event_config")
      .doc(DOC_ID)
      .set(
        {
          lines,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    await logActivity(adminDb(), {
      kind: "event_config_updated",
      actorAdminId: auth.admin.uid,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
