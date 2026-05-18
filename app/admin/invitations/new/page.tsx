"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";
import type { InviteLocale } from "@/lib/types";
import {
  defaultInvitationExpiresAt,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";

export default function NewInvitationPage() {
  const router = useRouter();
  const session = useAdminSession();
  const canEdit =
    session?.role === "editor" || session?.role === "super_admin";

  useEffect(() => {
    if (session && !canEdit) router.replace("/admin/invitations");
  }, [session, canEdit, router]);

  const defaultExp = defaultInvitationExpiresAt();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [locale, setLocale] = useState<InviteLocale>("en");
  const [includesPlusOne, setIncludesPlusOne] = useState(true);
  const [expiresAt, setExpiresAt] = useState(toDatetimeLocalValue(defaultExp));
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [err, setErr] = useState("");

  if (session && !canEdit) {
    return <p className="text-stone-500 text-sm">Redirecting…</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const iso = new Date(expiresAt).toISOString();
      const r = await adminJson<{ id: string; sharePath: string }>(
        "/api/admin/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim() || null,
            locale,
            includesPlusOne,
            expiresAt: iso,
          }),
        },
      );
      setSharePath(r.sharePath);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (sharePath) {
    const full =
      typeof window !== "undefined"
        ? `${window.location.origin}${sharePath}`
        : sharePath;
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="font-serif text-2xl text-stone-900">
          Invitation created
        </h1>
        <p className="text-stone-600 text-sm">Share this link with your guest:</p>
        <div className="flex gap-2 flex-wrap">
          <input
            readOnly
            value={full}
            className="flex-1 min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm"
            onClick={() => navigator.clipboard.writeText(full)}
          >
            Copy
          </button>
        </div>
        <button
          type="button"
          className="text-rose-800 text-sm underline"
          onClick={() => router.push("/admin/invitations")}
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <h1 className="font-serif text-3xl text-stone-900">New invitation</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1">
            Guest name <span className="text-red-600">*</span>
          </label>
          <input
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">Phone</label>
          <input
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">
            Invitation page language
          </label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as InviteLocale)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          >
            <option value="en">English</option>
            <option value="id">Indonesian</option>
          </select>
        </div>
        <div>
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-3">
            <input
              type="checkbox"
              checked={includesPlusOne}
              onChange={(e) => setIncludesPlusOne(e.target.checked)}
              className="mt-1 rounded border-stone-400"
            />
            <span>
              <span className="block text-sm font-medium text-stone-800">
                Guest may bring a plus-one (+1)
              </span>
              <span className="block text-xs text-stone-500 mt-1">
                Turn off for single-seat invitations. Guests can ask for a +1 from
                their RSVP page when this is off.
              </span>
            </span>
          </label>
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1">
            Expires at (default: 7 days from today at 00:00 local — adjustable)
          </label>
          <input
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-rose-800 text-white font-medium"
        >
          Create &amp; get link
        </button>
      </form>
    </div>
  );
}
