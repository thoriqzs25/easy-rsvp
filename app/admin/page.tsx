"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";

type Stats = {
  total: number;
  byStatus: Record<string, number>;
  pendingPlusOneRequests: number;
};

type ActivityItem = {
  id: string;
  kind: string;
  guestName: string | null;
  createdAt: string | null;
  metadata: Record<string, unknown>;
};

const kindLabel: Record<string, string> = {
  invitation_created: "Invitation created",
  rsvp_accepted: "RSVP accepted",
  rsvp_declined: "RSVP declined",
  invitation_expired: "Expired",
  invitation_revoked: "Revoked",
  invitation_renewed: "Renewed",
  invitation_reopened: "Reopened",
  invitation_page_view: "Page view",
  event_config_updated: "Event details updated",
  plus_one_requested: "+1 requested",
  plus_one_approved: "+1 approved",
  plus_one_rejected: "+1 request declined",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [accessMode, setAccessMode] = useState<"exclude" | "only" | "all">(
    "exclude",
  );
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await adminJson<Stats>("/api/admin/stats");
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setErr("Could not load stats");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ limit: "10" });
    if (accessMode === "only") qs.set("accessOnly", "1");
    if (accessMode === "all") qs.set("includeAll", "1");
    (async () => {
      try {
        const a = await adminJson<{ items: ActivityItem[] }>(
          `/api/admin/activity?${qs}`,
        );
        if (!cancelled) setActivityItems(a.items);
      } catch {
        if (!cancelled) setActivityItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessMode]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl text-stone-900">Dashboard</h1>
        <p className="text-stone-600 mt-1">
          Track RSVPs and recent activity. Accepted count helps you judge capacity.
        </p>
      </div>

      {err ? <p className="text-red-600 text-sm">{err}</p> : null}

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(
              [
                ["total", "Total", stats.total],
                ["accepted", "Accepted", stats.byStatus.accepted],
                ["pending", "Pending", stats.byStatus.pending],
                ["declined", "Declined", stats.byStatus.declined],
                ["expired", "Expired", stats.byStatus.expired],
                ["revoked", "Revoked", stats.byStatus.revoked],
              ] as const
            ).map(([key, label, n]) => (
              <div
                key={key}
                className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  {label}
                </p>
                <p className="text-2xl font-serif text-stone-900 mt-1">{n}</p>
              </div>
            ))}
          </div>
          {(stats.pendingPlusOneRequests ?? 0) > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-amber-950">Pending +1 requests</p>
                <p className="text-sm text-amber-900/85 mt-0.5">
                  {stats.pendingPlusOneRequests} guest
                  {stats.pendingPlusOneRequests === 1 ? "" : "s"} asked to
                  bring a plus-one. Approve or decline from each invitation.
                </p>
              </div>
              <Link
                href="/admin/invitations?plusOnePending=1"
                className="inline-flex px-4 py-2 rounded-lg bg-amber-800 text-white text-sm font-medium hover:bg-amber-900"
              >
                Review invitations
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-stone-500">Loading stats…</p>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="font-serif text-xl text-stone-900">Recent activity</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setAccessMode("exclude")}
              className={`px-3 py-1 rounded-full border ${
                accessMode === "exclude"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "border-stone-300 text-stone-700"
              }`}
            >
              Main events
            </button>
            <button
              type="button"
              onClick={() => setAccessMode("only")}
              className={`px-3 py-1 rounded-full border ${
                accessMode === "only"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "border-stone-300 text-stone-700"
              }`}
            >
              Link views
            </button>
            <button
              type="button"
              onClick={() => setAccessMode("all")}
              className={`px-3 py-1 rounded-full border ${
                accessMode === "all"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "border-stone-300 text-stone-700"
              }`}
            >
              All
            </button>
          </div>
        </div>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
          {activityItems.map((item) => (
            <li key={item.id} className="px-4 py-3 flex flex-wrap gap-2 text-sm">
              <span className="text-stone-500 shrink-0 w-44">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : "—"}
              </span>
              <span className="font-medium text-stone-800">
                {kindLabel[item.kind] ?? item.kind}
              </span>
              {item.guestName ? (
                <span className="text-stone-600">{item.guestName}</span>
              ) : null}
              {item.kind === "invitation_page_view" &&
              item.metadata &&
              typeof item.metadata === "object" ? (
                <span className="text-stone-500 text-xs">
                  {String((item.metadata as { browser?: string }).browser ?? "")}{" "}
                  · {String((item.metadata as { os?: string }).os ?? "")}
                </span>
              ) : null}
            </li>
          ))}
          {activityItems.length === 0 ? (
            <li className="px-4 py-8 text-stone-500 text-center">No events yet.</li>
          ) : null}
        </ul>
        <p className="mt-3 text-sm text-stone-500">
          <Link href="/admin/invitations" className="text-rose-800 underline">
            Manage invitations
          </Link>
        </p>
      </div>
    </div>
  );
}
