import type { DocumentData } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

export type PlusOneRequestStatusPublic = "none" | "pending" | "rejected";

/** Default true when field is missing (legacy invitations). */
export function readIncludesPlusOne(d: DocumentData): boolean {
  return d.includes_plus_one !== false;
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
