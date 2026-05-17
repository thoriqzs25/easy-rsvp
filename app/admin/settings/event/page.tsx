"use client";

import { useEffect, useState } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";

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

export default function EventConfigPage() {
  const session = useAdminSession();
  const canEdit =
    session?.role === "editor" || session?.role === "super_admin";
  const [lines, setLines] = useState<Lines>(empty);
  const [msg, setMsg] = useState("");

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

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-stone-900">Event details</h1>
        <p className="text-stone-600 text-sm mt-1">
          Shown to guests after they accept. Separate English and Indonesian
          copy.
        </p>
      </div>

      <form onSubmit={save} className="space-y-8">
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
