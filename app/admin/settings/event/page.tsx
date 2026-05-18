"use client";

import { useEffect, useState } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";
import { inviteCopy } from "@/lib/invite-copy";
import type { InviteLocale } from "@/lib/types";

type Lines = {
  en: {
    heading: string;
    date: string;
    time: string;
    venue: string;
    notes: string;
  };
  id: {
    heading: string;
    date: string;
    time: string;
    venue: string;
    notes: string;
  };
};

const empty: Lines = {
  en: { heading: "", date: "", time: "", venue: "", notes: "" },
  id: { heading: "", date: "", time: "", venue: "", notes: "" },
};

function str(
  c: (typeof inviteCopy)["en"],
  key: keyof typeof inviteCopy.en,
  name: string,
): string {
  const v = c[key];
  if (typeof v === "function") return v(name);
  return typeof v === "string" ? v : "";
}

type EventLineSlice = Lines["en"];

function GuestThankYouPreview({
  locale,
  lines,
  guestName,
  showSampleWishes,
}: {
  locale: InviteLocale;
  lines: EventLineSlice;
  guestName: string;
  showSampleWishes: boolean;
}) {
  const c = inviteCopy[locale];
  const sampleWish =
    locale === "id"
      ? "Selamat berbahagia!"
      : "So happy for you both!";

  return (
    <div className="rounded-2xl border border-dashed border-rose-200 bg-gradient-to-b from-rose-50/80 to-stone-50/80 p-6 sm:p-8">
      <p className="text-[11px] font-medium uppercase tracking-wide text-rose-900/70 mb-4">
        Guest preview · after RSVP confirm
      </p>
      <div className="rounded-2xl border border-rose-100 bg-white/90 p-8 shadow-sm max-w-lg mx-auto">
        <p className="text-rose-800 font-medium text-sm uppercase tracking-wide mb-2">
          {c.thankYou}
        </p>
        <h3 className="font-serif text-2xl sm:text-3xl text-stone-900 mb-2">
          {str(c, "greeting", guestName)}
        </h3>
        <p className="text-stone-600 mb-8 text-sm sm:text-base">{c.acceptedLead}</p>
        <h4 className="font-serif text-lg sm:text-xl text-stone-800 mb-4">
          {c.eventHeading}
        </h4>
        {lines.heading ||
        lines.date ||
        lines.time ||
        lines.venue ||
        lines.notes ? (
          <ul className="space-y-3 text-stone-700 text-sm sm:text-base">
            {lines.heading ? (
              <li className="font-medium text-lg">{lines.heading}</li>
            ) : null}
            {lines.date ? <li>{lines.date}</li> : null}
            {lines.time ? <li>{lines.time}</li> : null}
            {lines.venue ? <li>{lines.venue}</li> : null}
            {lines.notes ? (
              <li className="text-sm text-stone-500 whitespace-pre-wrap">
                {lines.notes}
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-stone-400 text-sm italic">
            Add fields above — nothing to show yet for this language.
          </p>
        )}
        {showSampleWishes ? (
          <div className="mt-8 pt-6 border-t border-stone-100">
            <p className="text-xs uppercase text-stone-500 mb-1">{c.wishesLabel}</p>
            <p className="text-stone-700 whitespace-pre-wrap font-serif text-sm">
              {sampleWish}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EventConfigPage() {
  const session = useAdminSession();
  const canEdit =
    session?.role === "editor" || session?.role === "super_admin";
  const [lines, setLines] = useState<Lines>(empty);
  const [msg, setMsg] = useState("");
  const [previewLocale, setPreviewLocale] = useState<InviteLocale>("en");
  const [showSampleWishes, setShowSampleWishes] = useState(true);

  useEffect(() => {
    void adminJson<{ lines?: Partial<Lines> }>("/api/admin/event-config")
      .then((r) =>
        setLines({
          en: { ...empty.en, ...r.lines?.en },
          id: { ...empty.id, ...r.lines?.id },
        }),
      )
      .catch(() => setMsg("Could not load event config."));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await adminJson("/api/admin/event-config", {
        method: "PATCH",
        body: JSON.stringify({ lines }),
      });
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  function field(
    lang: "en" | "id",
    key: keyof Lines["en"],
    label: string,
  ) {
    return (
      <label className="block">
        <span className="text-xs text-stone-500">{label}</span>
        {key === "notes" ? (
          <textarea
            disabled={!canEdit}
            value={lines[lang][key]}
            onChange={(e) =>
              setLines({
                ...lines,
                [lang]: { ...lines[lang], [key]: e.target.value },
              })
            }
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 min-h-[80px] text-sm disabled:bg-stone-50"
          />
        ) : (
          <input
            disabled={!canEdit}
            value={lines[lang][key]}
            onChange={(e) =>
              setLines({
                ...lines,
                [lang]: { ...lines[lang], [key]: e.target.value },
              })
            }
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-50"
          />
        )}
      </label>
    );
  }

  const previewGuestName = previewLocale === "id" ? "Rina" : "Jamie";

  return (
    <div className="max-w-6xl space-y-10">
      <div>
        <h1 className="font-serif text-3xl text-stone-900">Event details</h1>
        <p className="text-stone-600 text-sm mt-1">
          Shown to guests after they accept. Separate English and Indonesian
          copy. Unsaved edits appear in the preview below.
        </p>
      </div>

      <form onSubmit={save} className="space-y-10">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="font-medium text-stone-800">English</h2>
            {field("en", "heading", "Heading")}
            {field("en", "date", "Date")}
            {field("en", "time", "Time")}
            {field("en", "venue", "Venue")}
            {field("en", "notes", "Notes")}
          </div>
          <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="font-medium text-stone-800">Indonesian</h2>
            {field("id", "heading", "Heading")}
            {field("id", "date", "Date")}
            {field("id", "time", "Time")}
            {field("id", "venue", "Venue")}
            {field("id", "notes", "Notes")}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-medium text-stone-800">Guest thank-you preview</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-stone-500 uppercase tracking-wide">
                Language
              </span>
              <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
                <button
                  type="button"
                  onClick={() => setPreviewLocale("en")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    previewLocale === "en"
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLocale("id")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    previewLocale === "id"
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  Indonesian
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSampleWishes}
                  onChange={(e) => setShowSampleWishes(e.target.checked)}
                  className="rounded border-stone-300"
                />
                Show sample wishes
              </label>
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Uses a demo guest name ({previewGuestName}) — real guests see their
            own name from the invitation.
          </p>
          <GuestThankYouPreview
            locale={previewLocale}
            lines={lines[previewLocale]}
            guestName={previewGuestName}
            showSampleWishes={showSampleWishes}
          />
        </div>

        {canEdit ? (
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-rose-800 text-white font-medium"
          >
            Save
          </button>
        ) : (
          <p className="text-sm text-stone-500">View only.</p>
        )}
        {msg ? <p className="text-sm text-stone-600">{msg}</p> : null}
      </form>
    </div>
  );
}
