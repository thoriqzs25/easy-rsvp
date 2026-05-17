import { Timestamp } from "firebase-admin/firestore";

export function toIso(
  value: Timestamp | Date | undefined | null,
): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function effectiveInvitationStatus(
  status: string,
  expiresAt: Date | null,
): string {
  if (status === "pending" && expiresAt && expiresAt.getTime() <= Date.now()) {
    return "expired";
  }
  return status;
}
