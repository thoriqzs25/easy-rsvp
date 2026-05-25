"use client";

import { useEffect, useState, useCallback } from "react";
import { inviteCopy } from "@/lib/invite-copy";
import {
  formatRsvpDeadlineLong,
  formatRsvpTimeRemaining,
} from "@/lib/datetime-local";
import type { InviteLocale } from "@/lib/types";

type EventLines = {
  heading: string;
  date: string;
  time: string;
  venue: string;
  notes: string;
};

type PublicPayload = {
  id: string;
  guestName: string;
  locale: InviteLocale;
  status: string;
  effectiveStatus: string;
  expiresAt: string | null;
  wishes: string;
  includesPlusOne: boolean;
  plusOneRequestStatus: "none" | "pending" | "rejected";
  event: { lines: Record<InviteLocale, EventLines> | null; venueUrl?: string } | null;
};

function str(
  c: (typeof inviteCopy)["en"],
  key: keyof typeof inviteCopy.en,
  name?: string,
): string {
  const v = c[key];
  if (typeof v === "function" && name !== undefined) return v(name);
  return typeof v === "string" ? v : "";
}

function eventHasContent(lines: EventLines | undefined): boolean {
  if (!lines) return false;
  return Boolean(
    lines.heading?.trim() ||
      lines.date?.trim() ||
      lines.time?.trim() ||
      lines.venue?.trim() ||
      lines.notes?.trim(),
  );
}

function EventDetailsUl({ lines }: { lines: EventLines | undefined }) {
  if (!eventHasContent(lines) || !lines) return null;
  return (
    <ul className="space-y-3 text-stone-700 text-sm sm:text-base">
      {lines.heading?.trim() ? (
        <li className="font-medium text-lg">{lines.heading}</li>
      ) : null}
      {lines.date?.trim() ? <li>{lines.date}</li> : null}
      {lines.time?.trim() ? <li>{lines.time}</li> : null}
      {lines.venue?.trim() ? <li>{lines.venue}</li> : null}
      {lines.notes?.trim() ? (
        <li className="text-sm text-stone-500 whitespace-pre-wrap">{lines.notes}</li>
      ) : null}
    </ul>
  );
}

export default function RsvpPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [data, setData] = useState<PublicPayload | null | "nf">(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"main" | "wishes" | "decline_confirm">("main");
  const [wishesDraft, setWishesDraft] = useState("");
  const [plusOneBusy, setPlusOneBusy] = useState(false);
  const [plusOneMsg, setPlusOneMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const res = await fetch(`/api/public/invitations/${encodeURIComponent(token)}`);
      if (res.status === 404) {
        setData("nf");
        return;
      }
      if (!res.ok) throw new Error("load failed");
      const j = (await res.json()) as PublicPayload;
      setData({
        ...j,
        includesPlusOne: j.includesPlusOne !== false,
        plusOneRequestStatus: j.plusOneRequestStatus ?? "none",
      });
    } catch {
      setErr("Could not load invitation.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void fetch(`/api/public/invitations/${encodeURIComponent(token)}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [token]);

  const locale: InviteLocale =
    data && data !== "nf" && data.locale === "id" ? "id" : "en";
  const c = inviteCopy[locale];

  async function requestPlusOne() {
    setPlusOneBusy(true);
    setPlusOneMsg("");
    setErr("");
    try {
      const res = await fetch(
        `/api/public/invitations/${encodeURIComponent(token)}/plus-one-request`,
        { method: "POST" },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error || res.statusText);
      }
      setPlusOneMsg(c.plusOneRequestSent);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPlusOneBusy(false);
    }
  }

  async function respond(action: "accept" | "decline", wishes?: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/public/invitations/${encodeURIComponent(token)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, wishes }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (j as { error?: string }).error || res.statusText,
        );
      }
      await load();
      setStep("main");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (data === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <p className="text-stone-600 font-serif text-lg">{c.loading}</p>
      </div>
    );
  }

  if (data === "nf") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#faf8f5]">
        <div className="max-w-md text-center rounded-2xl border border-stone-200 bg-white p-10 shadow-sm">
          <h1 className="font-serif text-2xl text-stone-800 mb-3">
            {c.notFoundTitle}
          </h1>
          <p className="text-stone-600">{c.notFoundBody}</p>
        </div>
      </div>
    );
  }

  const display = data.effectiveStatus;

  if (display === "accepted") {
    const ev = data.event?.lines?.[locale];
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-stone-50 p-6">
        <div className="max-w-lg mx-auto rounded-2xl border border-rose-100 bg-white/90 p-10 shadow-sm mt-10">
          <p className="text-rose-800 font-medium text-sm uppercase tracking-wide mb-2">
            {c.thankYou}
          </p>
          <h1 className="font-serif text-3xl text-stone-900 mb-2">
            {str(c, "greeting", data.guestName)}
          </h1>
          <p className="text-stone-600 mb-8">{c.acceptedLead}</p>
          {data.includesPlusOne ? (
            <p className="text-rose-900/75 text-sm mb-6">{c.plusOne}</p>
          ) : null}
          <h2 className="font-serif text-xl text-stone-800 mb-4">
            {c.eventHeading}
          </h2>
          <EventDetailsUl lines={ev} />
          {!eventHasContent(ev) ? (
            <p className="text-stone-500 text-sm">{c.loading}</p>
          ) : null}
          {data.event?.venueUrl ? (
            <a
              href={data.event.venueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-rose-800 hover:text-rose-900 underline underline-offset-4"
            >
              {c.getDirections}
            </a>
          ) : null}
          {data.wishes ? (
            <div className="mt-8 pt-6 border-t border-stone-100">
              <p className="text-xs uppercase text-stone-500 mb-1">{c.wishesLabel}</p>
              <p className="text-stone-700 whitespace-pre-wrap font-serif">{data.wishes}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (display === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-md text-center rounded-2xl border border-stone-200 bg-white p-10 shadow-sm">
          <h1 className="font-serif text-2xl text-stone-800 mb-3">
            {c.declinedTitle}
          </h1>
          <p className="text-stone-600">{c.declinedBody}</p>
        </div>
      </div>
    );
  }

  if (display === "revoked") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-md text-center rounded-2xl border border-stone-200 bg-white p-10 shadow-sm">
          <h1 className="font-serif text-2xl text-stone-800 mb-3">
            {c.revokedTitle}
          </h1>
          <p className="text-stone-600">{c.revokedBody}</p>
        </div>
      </div>
    );
  }

  if (display === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-md text-center rounded-2xl border border-stone-200 bg-white p-10 shadow-sm">
          <h1 className="font-serif text-2xl text-stone-800 mb-3">
            {c.expiredTitle}
          </h1>
          <p className="text-stone-600">{c.expiredBody}</p>
        </div>
      </div>
    );
  }

  const evPending = data.event?.lines?.[locale];
  const expiresAtGuest = data.expiresAt;
  const deadlineLong =
    expiresAtGuest != null && expiresAtGuest !== ""
      ? formatRsvpDeadlineLong(expiresAtGuest, locale)
      : null;
  const deadlineRelative =
    expiresAtGuest != null && expiresAtGuest !== ""
      ? formatRsvpTimeRemaining(expiresAtGuest, locale)
      : null;

  /* pending */
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-stone-50 p-6">
      <div className="max-w-lg mx-auto rounded-2xl border border-stone-200 bg-white p-10 shadow-sm mt-10">
        <h1 className="font-serif text-3xl text-stone-900 mb-2">
          {str(c, "greeting", data.guestName)}
        </h1>
        <p className="text-rose-900/80 text-sm mb-6">
          {data.includesPlusOne ? c.plusOne : c.plusOneNone}
        </p>

        {!data.includesPlusOne && data.plusOneRequestStatus === "pending" ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {c.plusOneRequestPending}
          </div>
        ) : null}
        {!data.includesPlusOne &&
        (data.plusOneRequestStatus === "none" ||
          data.plusOneRequestStatus === "rejected") ? (
          <div className="mb-6 space-y-3">
            {data.plusOneRequestStatus === "rejected" ? (
              <div className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-stone-900">
                  {c.plusOneRequestRejectedTitle}
                </p>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {c.plusOneRequestRejectedBody}
                </p>
              </div>
            ) : null}
            {plusOneMsg ? (
              <p className="text-sm text-emerald-800">{plusOneMsg}</p>
            ) : null}
            <button
              type="button"
              disabled={plusOneBusy}
              onClick={() => void requestPlusOne()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-rose-300 text-rose-900 font-medium hover:bg-rose-50 disabled:opacity-50"
            >
              {plusOneBusy
                ? c.plusOneRequestBusy
                : data.plusOneRequestStatus === "rejected"
                  ? c.plusOneRequestAgainBtn
                  : c.plusOneRequestBtn}
            </button>
          </div>
        ) : null}

        {deadlineLong ? (
          <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/90">
              {c.rsvpDeadlineTitle}
            </p>
            <p className="text-sky-950">
              <span className="font-medium text-sky-900">
                {c.rsvpDeadlineRespondBy}:{" "}
              </span>
              {deadlineLong}
            </p>
            {deadlineRelative ? (
              <p className="text-sky-900/90">
                <span className="font-medium">{c.rsvpDeadlineTimeLeft}: </span>
                {deadlineRelative}
              </p>
            ) : null}
            <p className="text-sky-900/85 leading-relaxed">
              {c.rsvpDeadlinePolicy}
            </p>
          </div>
        ) : null}

        <div className="mb-8 pb-8 border-b border-stone-100">
          <h2 className="font-serif text-xl text-stone-800 mb-2">
            {c.eventHeading}
          </h2>
          <p className="text-sm text-stone-600 mb-4">{c.eventRsvpHint}</p>
          <EventDetailsUl lines={evPending} />
          {!eventHasContent(evPending) ? (
            <p className="text-stone-500 text-sm italic">{c.eventDetailsPending}</p>
          ) : null}
          {data.event?.venueUrl ? (
            <a
              href={data.event.venueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-rose-800 hover:text-rose-900 underline underline-offset-4"
            >
              {c.getDirections}
            </a>
          ) : null}
        </div>

        {err ? (
          <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {err}
          </p>
        ) : null}

        {step === "decline_confirm" ? (
          <div className="space-y-4">
            <p className="text-stone-700">{c.declineConfirm}</p>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("main")}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
              >
                {c.back}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => respond("decline")}
                className="px-4 py-2 rounded-lg bg-stone-800 text-white hover:bg-stone-900 disabled:opacity-50"
              >
                {c.declineYes}
              </button>
            </div>
          </div>
        ) : step === "wishes" ? (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">{c.wishesLabel}</span>
              <textarea
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 min-h-[120px]"
                value={wishesDraft}
                onChange={(e) => setWishesDraft(e.target.value)}
                placeholder={c.wishesPlaceholder}
              />
            </label>
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep("main")}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700"
              >
                {c.back}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => respond("accept", wishesDraft)}
                className="px-4 py-2 rounded-lg bg-rose-700 text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {c.submitWish}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setWishesDraft("");
                setStep("wishes");
              }}
              className="flex-1 px-4 py-3 rounded-xl bg-rose-700 text-white font-medium hover:bg-rose-800 disabled:opacity-50"
            >
              {c.confirmBtn}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("decline_confirm")}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-stone-300 text-stone-800 hover:bg-stone-50 disabled:opacity-50"
            >
              {c.declineBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
