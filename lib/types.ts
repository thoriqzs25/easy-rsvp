export type InvitationStatus =
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
  | "event_config_updated";

export const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 0,
  editor: 1,
  super_admin: 2,
};
