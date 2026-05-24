export type InvitationStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked";

export type InviteLocale = "id" | "en";

export type AdminRole = "super_admin" | "editor" | "viewer";

export type ActivityKind =
  | "invitation_created"
  | "rsvp_accepted"
  | "rsvp_declined"
  | "invitation_expired"
  | "invitation_revoked"
  | "invitation_renewed"
  | "invitation_reopened"
  | "invitation_page_view"
  | "event_config_updated"
  | "plus_one_requested"
  | "plus_one_approved"
  | "plus_one_rejected";

export const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 0,
  editor: 1,
  super_admin: 2,
};
