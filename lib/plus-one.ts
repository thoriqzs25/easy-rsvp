import type { DocumentData } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

export type PlusOneRequestStatusPublic = "none" | "pending" | "rejected";

/** Default true when field is missing (legacy invitations). */
export function readIncludesPlusOne(d: DocumentData): boolean {
  return d.includes_plus_one !== false;
}

/** Whether an accepted guest counts as bringing a plus-one. */
export function guestHasPlusOne(d: DocumentData): boolean {
  return d.allow_plus_one === true || d.includes_plus_one === true;
}

/** Headcount for a single accepted invitation (1 guest, or 2 with +1). */
export function headcountForAcceptedGuest(d: DocumentData): number {
  return guestHasPlusOne(d) ? 2 : 1;
}

export function readPlusOneRequestStatusPublic(
  d: DocumentData,
): PlusOneRequestStatusPublic {
  const s = d.plus_one_request_status;
  if (s === "pending" || s === "rejected") return s;
  return "none";
}

export function plusOneRequestFieldDeletes(): Record<string, unknown> {
  return {
    plus_one_request_status: FieldValue.delete(),
    plus_one_requested_at: FieldValue.delete(),
    plus_one_resolved_at: FieldValue.delete(),
    plus_one_resolved_by: FieldValue.delete(),
  };
}
