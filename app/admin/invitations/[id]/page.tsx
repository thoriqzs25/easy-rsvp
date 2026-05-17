"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";
import { addDays, toDatetimeLocalValue } from "@/lib/datetime-local";
import type { InviteLocale } from "@/lib/types";

type Inv = {
  id: string;
  token: string;
  guestName: string;
  guestPhone: string | null;
  locale: InviteLocale;
  status: string;
  effectiveStatus: string;
  wishes: string;
  expiresAt: string | null;
  respondedAt: string | null;
  sharePath: string;
};

export default function InvitationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const session = useAdminSession();
  const canEdit =
    session?.role === "editor" || session?.role === "super_admin";
  const [inv, setInv] = useState<Inv | null>(null);
  const [expiresPick, setExpiresPick] = useState(
    toDatetimeLocalValue(addDays(new Date(), 7)),
  );
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [locale, setLocale] = useState<InviteLocale>("en");
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await adminJson<Inv>(`/api/admin/invitations/${id}`);
    setInv(r);
    setGuestName(r.guestName);
    setGuestPhone(r.guestPhone ?? "");
    setLocale(r.locale);
    if (r.expiresAt) {
      setExpiresPick(toDatetimeLocalValue(new Date(r.expiresAt)));
    }
  }

  useEffect(() => {
    void load().catch(() => setInv(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(
    body:
      | { action: "renew"; expiresAt: string }
      | { action: "reopen"; expiresAt: string }
      | { action: "revoke" }
      | {
          action: "update";
          guestName?: string;
          guestPhone?: string | null;
          locale?: InviteLocale;
        },
  ) {
    setMsg("");
    try {
      await adminJson(`/api/admin/invitations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMsg("Saved.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!inv) {
    return <p className="text-stone-500">Loading…</p>;
  }

  const full =
    typeof window !== "undefined"
      ? `${window.location.origin}${inv.sharePath}`
      : inv.sharePath;

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <Link
          href="/admin/invitations"
          className="text-sm text-rose-800 hover:underline"
        >
          ← Invitations
        </Link>
        <h1 className="font-serif text-3xl text-stone-900 mt-2">
          {inv.guestName}
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Status: <strong className="text-stone-800">{inv.status}</strong>
          {inv.effectiveStatus !== inv.status ? (
            <>
              {" "}
              · effective:{" "}
              <strong className="text-stone-800">{inv.effectiveStatus}</strong>
            </>
          ) : null}
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
        <p className="text-xs uppercase text-stone-500">Share link</p>
        <div className="flex gap-2 flex-wrap">
          <input
            readOnly
            value={full}
            className="flex-1 min-w-0 rounded border border-stone-200 px-2 py-1 text-sm"
          />
          <button
            type="button"
            className="text-sm px-2 py-1 rounded bg-stone-800 text-white"
            onClick={() => navigator.clipboard.writeText(full)}
          >
            Copy
          </button>
        </div>
      </div>

      {inv.wishes ? (
        <div>
          <h2 className="font-medium text-stone-800 mb-2">Wishes</h2>
          <p className="text-stone-700 whitespace-pre-wrap font-serif border border-stone-100 rounded-lg p-3 bg-stone-50/50">
            {inv.wishes}
          </p>
        </div>
      ) : null}

      {canEdit ? (
        <div className="space-y-6 rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-lg text-stone-900">Edit guest &amp; locale</h2>
          <div className="grid gap-3">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as InviteLocale)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="en">English page</option>
              <option value="id">Indonesian page</option>
            </select>
            <button
              type="button"
              className="w-fit px-4 py-2 rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
              onClick={() =>
                patch({
                  action: "update",
                  guestName: guestName.trim(),
                  guestPhone: guestPhone.trim() || null,
                  locale,
                })
              }
            >
              Save guest fields
            </button>
          </div>

          <div className="border-t border-stone-100 pt-6 space-y-3">
            <h3 className="font-medium text-stone-800">Renew / reopen</h3>
            <p className="text-sm text-stone-600">
              Sets status to pending, clears response &amp; wishes, and sets a
              new expiry.
            </p>
            <input
              type="datetime-local"
              value={expiresPick}
              onChange={(e) => setExpiresPick(e.target.value)}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {["expired", "declined", "revoked"].includes(inv.status) ||
              (inv.status === "pending" &&
                inv.expiresAt &&
                new Date(inv.expiresAt) <= new Date()) ? (
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-rose-800 text-white text-sm"
                  onClick={() =>
                    patch({
                      action: "renew",
                      expiresAt: new Date(expiresPick).toISOString(),
                    })
                  }
                >
                  Renew invitation
                </button>
              ) : null}
              {inv.status === "accepted" ? (
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-amber-700 text-white text-sm"
                  onClick={() =>
                    patch({
                      action: "reopen",
                      expiresAt: new Date(expiresPick).toISOString(),
                    })
                  }
                >
                  Reopen to pending
                </button>
              ) : null}
            </div>
          </div>

          <div className="border-t border-stone-100 pt-6">
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-red-300 text-red-800 text-sm hover:bg-red-50"
              onClick={() => {
                if (
                  !confirm(
                    "Revoke this invitation? The guest link will stop working.",
                  )
                )
                  return;
                void patch({ action: "revoke" });
              }}
            >
              Revoke invitation
            </button>
          </div>

          {msg ? (
            <p className="text-sm text-stone-600 bg-stone-50 px-2 py-1 rounded">
              {msg}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-stone-400">
        <button type="button" className="underline" onClick={() => router.refresh()}>
          Refresh
        </button>
      </p>
    </div>
  );
}
