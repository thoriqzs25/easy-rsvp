import type { InviteLocale } from "./types";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

const RSVP_DISPLAY_LOCALE: Record<InviteLocale, string> = {
  en: "en-US",
  id: "id-ID",
};

/** Guest-facing deadline (absolute), in the invitation page language. */
export function formatRsvpDeadlineLong(iso: string, locale: InviteLocale): string {
  return new Date(iso).toLocaleString(RSVP_DISPLAY_LOCALE[locale], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time until expiry, or null if already passed. */
export function formatRsvpTimeRemaining(
  iso: string,
  locale: InviteLocale,
): string | null {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const rtf = new Intl.RelativeTimeFormat(locale === "id" ? "id" : "en", {
    numeric: "auto",
  });
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return rtf.format(days, "day");
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return rtf.format(hours, "hour");
  const minutes = Math.max(1, Math.ceil(ms / (60 * 1000)));
  return rtf.format(minutes, "minute");
}

export function toDatetimeLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Same calendar day in local time, advanced by `days`, at 23:59:59.999. */
export function addDaysEndOfDay(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Same calendar day in local time, advanced by `days`, at 00:00:00.000 local.
 * Matches a daily cron at midnight in the same environment TZ (browser vs Vercel UTC).
 */
export function addDaysStartOfDay(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Default RSVP expiry: 7 calendar days from today at local midnight (start of that day). */
export function defaultInvitationExpiresAt(): Date {
  return addDaysStartOfDay(new Date(), 7);
}
