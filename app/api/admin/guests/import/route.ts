import { NextResponse } from "next/server";
import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/auth-api";
import { adminDb } from "@/lib/firebase-admin";
import { logActivity } from "@/lib/activity";
import { guestIdentityKey, parseGuestCsv } from "@/lib/guest-csv";
import { toIso } from "@/lib/serialize-invitation";

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

export async function POST(req: Request) {
  const auth = await requireAdmin(req, "editor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await req.json()) as { csv?: string };
    if (!body.csv || typeof body.csv !== "string" || !body.csv.trim()) {
      return NextResponse.json({ error: "INVALID_CSV" }, { status: 400 });
    }

    const { rows, errors } = parseGuestCsv(body.csv);
    if (rows.length === 0 && errors.length === 0) {
      return NextResponse.json(
        {
          created: [],
          skipped: 0,
          errors: [{ row: 0, message: "No guest rows found in CSV" }],
        },
        { status: 400 },
      );
    }

    const db = adminDb();
    const existingSnap = await db.collection("invitations").limit(500).get();
    const existingKeys = new Set(
      existingSnap.docs.map((doc) => {
        const d = doc.data();
        const name = typeof d.guest_name === "string" ? d.guest_name : "";
        const phone = typeof d.guest_phone === "string" ? d.guest_phone : "";
        if (!name.trim() || !phone.trim()) return null;
        return guestIdentityKey(name, phone);
      }).filter((key): key is string => key !== null),
    );

    const seenInFile = new Set<string>();
    const toCreate: typeof rows = [];
    let skipped = 0;

    for (const row of rows) {
      const key = guestIdentityKey(row.guestName, row.guestPhone);
      if (existingKeys.has(key) || seenInFile.has(key)) {
        skipped++;
        continue;
      }
      seenInFile.add(key);
      toCreate.push(row);
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        created: [],
        skipped,
        errors,
      });
    }

    let nextPriority = await getNextPriority(db);
    const batch = db.batch();
    const refs: DocumentReference[] = [];

    for (const row of toCreate) {
      const ref = db.collection("invitations").doc();
      batch.set(ref, {
        guest_name: row.guestName,
        guest_phone: row.guestPhone,
        locale: row.locale,
        allow_plus_one: row.allowPlusOne,
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

    const createdSnaps = await Promise.all(refs.map((ref) => ref.get()));
    const created = createdSnaps.map((snap) => makeGuestResponse(snap.id, snap.data()!));

    await logActivity(db, {
      kind: "guests_csv_imported",
      actorAdminId: auth.admin.uid,
      metadata: {
        created: created.length,
        skipped,
        errors: errors.length,
      },
    });

    return NextResponse.json({
      created,
      skipped,
      errors,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
