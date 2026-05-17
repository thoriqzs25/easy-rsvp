import type { Firestore } from "firebase-admin/firestore";
import type { ActivityKind } from "./types";

export async function logActivity(
  db: Firestore,
  params: {
    kind: ActivityKind;
    invitationId?: string;
    guestName?: string;
    actorAdminId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.collection("activity_events").add({
    kind: params.kind,
    invitation_id: params.invitationId ?? null,
    guest_name: params.guestName ?? null,
    actor_admin_id: params.actorAdminId ?? null,
    metadata: params.metadata ?? {},
    created_at: new Date(),
  });
}
