function pad(n: number) {
  return n.toString().padStart(2, "0");
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

/** Default RSVP expiry: 7 days from now, end of that day (local). */
export function defaultInvitationExpiresAt(): Date {
  return addDaysEndOfDay(new Date(), 7);
}
