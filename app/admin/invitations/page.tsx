"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";

type Row = {
  id: string;
  guestName: string;
  status: string;
  expiresAt: string | null;
  locale: string;
};

export default function InvitationsListPage() {
  const session = useAdminSession();
  const canEdit =
    session?.role === "editor" || session?.role === "super_admin";
  const [status, setStatus] = useState<string>("all");
  const [name, setName] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status !== "all") qs.set("status", status);
      if (name.trim()) qs.set("name", name.trim());
      const r = await adminJson<{ items: Row[] }>(
        `/api/admin/invitations?${qs}`,
      );
      setItems(r.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- name applied only via Search
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Invitations</h1>
          <p className="text-stone-600 mt-1 text-sm">Unique links per guest.</p>
        </div>
        {canEdit ? (
          <Link
            href="/admin/invitations/new"
            className="inline-flex px-4 py-2 rounded-lg bg-rose-800 text-white font-medium text-sm hover:bg-rose-900"
          >
            New invitation
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Name search</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm"
            placeholder="Guest name"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
        >
          Search
        </button>
      </div>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Locale</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50/80">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {row.guestName}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{row.status}</td>
                  <td className="px-4 py-3 uppercase text-stone-500">
                    {row.locale}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {row.expiresAt
                      ? new Date(row.expiresAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/invitations/${row.id}`}
                      className="text-rose-800 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="p-6 text-center text-stone-500">No invitations found.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
