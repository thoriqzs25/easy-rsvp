"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminJson } from "@/lib/admin-fetch";
import Fuse from "fuse.js";
import { defaultInvitationExpiresAt, toDatetimeLocalValue } from "@/lib/datetime-local";

type Guest = {
  id: string;
  token: string | null;
  guestName: string;
  guestPhone: string | null;
  locale: string;
  status: string;
  priority: number;
  allowPlusOne: boolean;
  expiresAt: string | null;
  respondedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const STATUS_ORDER = ["accepted", "pending", "expired", "declined", "revoked", "draft"];

const STATUS_BADGE: Record<string, string> = {
  accepted: "bg-emerald-100 text-emerald-900",
  pending: "bg-sky-100 text-sky-900",
  expired: "bg-stone-200 text-stone-800",
  declined: "bg-rose-100 text-rose-900",
  revoked: "bg-stone-300 text-stone-800",
  draft: "bg-amber-100 text-amber-900",
};

// Deterministic distinct color from an ID (consistent across re-renders)
const COLOR_PALETTE = [
  "#e11d48", "#059669", "#2563eb", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#4f46e5", "#be123c",
  "#0d9488", "#ca8a04", "#9333ea", "#dc2626", "#16a34a",
  "#2563eb", "#ea580c", "#0891b2", "#84cc16", "#e11d48",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[idx];
}

export default function GuestsPage() {
  const session = useAdminSession();
  const canEdit = session?.role === "editor" || session?.role === "super_admin";

  const [items, setItems] = useState<Guest[]>([]);
  const [rawItems, setRawItems] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"priority" | "name" | "status" | "createdAt">("priority");
  const [filterName, setFilterName] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showRenew, setShowRenew] = useState<{ id: string; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const fuseRef = useRef<Fuse<Guest> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const sortByRef = useRef(sortBy);
  sortByRef.current = sortBy;
  const rawItemsRef = useRef(rawItems);
  rawItemsRef.current = rawItems;

  // Expiry defaults to +7 days at local midnight
  const [expiryInput, setExpiryInput] = useState(toDatetimeLocalValue(defaultInvitationExpiresAt()));

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminJson<{ items: Guest[] }>("/api/admin/guests");
      setRawItems(r.items);
      setItems(r.items);
      setSelected(new Set());
    } catch {
      setErrorMsg("Could not load guests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Apply sort + filter on rawItems whenever deps change
  useEffect(() => {
    // keep fuse in sync with rawItems
    fuseRef.current = new Fuse(rawItems, { keys: ["guestName"], threshold: 0.35 });

    let result = [...rawItems];

    // Status filter
    if (filterStatuses.length > 0) {
      result = result.filter((g) => filterStatuses.includes(g.status));
    }

    // Name filter (fuzzy or substring)
    if (filterName.trim()) {
      if (fuseRef.current) {
        const hits = fuseRef.current.search(filterName.trim());
        result = hits.map((h) => h.item);
      } else {
        const q = filterName.trim().toLowerCase();
        result = result.filter((g) => g.guestName.toLowerCase().includes(q));
      }
    }

    // Sort
    if (sortBy === "name") {
      result.sort((a, b) => a.guestName.localeCompare(b.guestName));
    } else if (sortBy === "status") {
      result.sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        if (ai !== bi) return ai - bi;
        return a.guestName.localeCompare(b.guestName);
      });
    } else if (sortBy === "createdAt") {
      result.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (at !== bt) return at - bt;
        return a.guestName.localeCompare(b.guestName);
      });
    } else {
      // priority: missing goes to end
      result.sort((a, b) => {
        const ap = typeof a.priority === "number" ? a.priority : Infinity;
        const bp = typeof b.priority === "number" ? b.priority : Infinity;
        if (ap !== bp) return ap - bp;
        return a.guestName.localeCompare(b.guestName);
      });
    }

    setItems(result);
  }, [rawItems, sortBy, filterName, filterStatuses]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(items.map((i) => i.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleStatusFilter = (status: string) => {
    setFilterStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const clearFilters = () => {
    setFilterName("");
    setFilterStatuses([]);
    setSortBy("priority");
  };

  const onAddFriend = async () => {
    if (!canEdit) return;
    try {
      const r = await adminJson<Guest>("/api/admin/guests", {
        method: "POST",
        body: JSON.stringify({
          guestName: "New guest",
          guestPhone: null,
          locale: "id",
          allowPlusOne: true,
        }),
      });
      setRawItems((prev) => [...prev, r]);
    } catch {
      setErrorMsg("Failed to add friend");
    }
  };

  const updateGuest = async (id: string, patch: Partial<Guest>) => {
    if (!canEdit) return;
    try {
      await adminJson(`/api/admin/guests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          guestName: patch.guestName,
          guestPhone: patch.guestPhone,
          locale: patch.locale,
          allowPlusOne: patch.allowPlusOne,
        }),
      });
      // Update local state
      setRawItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      );
    } catch {
      setErrorMsg("Failed to update");
    }
  };

  const onDelete = async (id: string) => {
    if (!canEdit) return;
    try {
      await adminJson(`/api/admin/guests/${id}`, { method: "DELETE" });
      setRawItems((prev) => prev.filter((g) => g.id !== id));
      setShowDeleteConfirm(null);
    } catch {
      setErrorMsg("Failed to delete");
    }
  };

  const onGenerateSelected = async () => {
    if (!canEdit) return;
    const ids = items.filter((g) => selected.has(g.id)).map((g) => g.id);
    if (ids.length === 0) return;
    setGenerating(true);
    try {
      const r = await adminJson<{ items: { id: string; ok: boolean; error?: string }[] }>(
        "/api/admin/guests/generate",
        {
          method: "POST",
          body: JSON.stringify({ ids, expiresAt: expiryInput }),
        },
      );
      const errors = r.items.filter((i) => !i.ok);
      if (errors.length > 0) {
        setErrorMsg(
          `${errors.length} failed: ${errors
            .map((e) => `${e.error}`)
            .join(", ")}`,
        );
      }
      setShowGenerate(false);
      setSelected(new Set());
      await load();
    } catch {
      setErrorMsg("Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const onRenew = async () => {
    if (!canEdit || !showRenew) return;
    setRenewing(true);
    try {
      await adminJson(`/api/admin/guests/${showRenew.id}/renew`, {
        method: "POST",
        body: JSON.stringify({ expiresAt: expiryInput }),
      });
      setShowRenew(null);
      await load();
    } catch {
      setErrorMsg("Renew failed");
    } finally {
      setRenewing(false);
    }
  };

  // Pointer-based drag (mouse + touch, including iOS)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const createGhost = (row: Guest, rect: DOMRect) => {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.background = "#fff";
    el.style.border = "2px solid #9f1239";
    el.style.borderRadius = "8px";
    el.style.opacity = "0.95";
    el.style.pointerEvents = "none";
    el.style.zIndex = "9999";
    el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "10px";
    el.style.padding = "0 12px";
    el.style.fontSize = "14px";
    el.style.fontWeight = "500";
    el.style.color = "#1c1917";

    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "9999px";
    dot.style.background = colorFromId(row.id);
    dot.style.flexShrink = "0";

    const text = document.createElement("span");
    text.textContent = `${(row.priority ?? 0) + 1}. ${row.guestName}`;
    text.style.overflow = "hidden";
    text.style.textOverflow = "ellipsis";
    text.style.whiteSpace = "nowrap";

    el.appendChild(dot);
    el.appendChild(text);
    document.body.appendChild(el);
    return el;
  };

  const doReorder = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const current = rawItemsRef.current;
    const reordered = [...current];
    const fromIndex = reordered.findIndex((g) => g.id === draggedId);
    const toIndex = reordered.findIndex((g) => g.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Optimistically assign new priorities so the priority sort keeps this order
    const withPriority = reordered.map((g, i) => ({ ...g, priority: i }));
    setRawItems(withPriority);
    void adminJson("/api/admin/guests/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: reordered.map((g) => g.id) }),
    }).catch(() => {
      setErrorMsg("Reorder failed — try again");
    });
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (sortBy !== "priority") return;
    if (e.button !== 0 && e.button !== -1) return;
    const rowEl = rowRefs.current.get(id);
    if (!rowEl) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = rowEl.getBoundingClientRect();
    const guest = rawItemsRef.current.find((g) => g.id === id);
    if (guest) {
      ghostRef.current = createGhost(guest, rect);
    }

    setDragId(id);
    setDragOverId(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    e.preventDefault();

    if (ghostRef.current) {
      ghostRef.current.style.top = `${e.clientY - ghostRef.current.offsetHeight / 2}px`;
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const overRow = target?.closest("[data-id]") as HTMLElement | null;
    const overId = overRow?.getAttribute("data-id") ?? null;

    if (overId && overId !== dragId) {
      setDragOverId(overId);
    } else if (!overId) {
      setDragOverId(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragId) return;

    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }

    // Use the dragOverId we tracked during pointermove instead of elementFromPoint
    // (more reliable on iOS where the hit-test tree may lag)
    if (dragOverId && dragOverId !== dragId) {
      doReorder(dragId, dragOverId);
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setDragId(null);
    setDragOverId(null);
  };

  const selectedDrafts = useMemo(
    () => items.filter((g) => selected.has(g.id) && g.status === "draft"),
    [items, selected],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Guest list</h1>
          <p className="text-stone-600 mt-1 text-sm">
            Draft guests you can reorder, edit, and generate invitations for.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onAddFriend}
            className="inline-flex px-4 py-2 rounded-lg bg-rose-800 text-white font-medium text-sm hover:bg-rose-900"
          >
            Add friend
          </button>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setErrorMsg("")}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Search name</label>
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Fuzzy search…"
            className="rounded-lg border border-stone-300 px-2 py-2 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Filter status</label>
          <div className="flex flex-wrap gap-1">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatusFilter(s)}
                className={`px-2 py-1 rounded-full text-xs border capitalize ${
                  filterStatuses.includes(s)
                    ? "bg-stone-900 text-white border-stone-900"
                    : "border-stone-300 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {(filterName || filterStatuses.length > 0 || sortBy !== "priority") && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-rose-800 underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sort bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">Sort:</span>
        {(["priority", "name", "status", "createdAt"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSortBy(s)}
            className={`px-2 py-1 rounded border text-xs ${
              sortBy === s
                ? "bg-stone-900 text-white border-stone-900"
                : "border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            {s === "createdAt" ? "Time generated" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {canEdit && selected.size > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-600">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => setShowGenerate(true)}
            disabled={selectedDrafts.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate {selectedDrafts.length} invitation{selectedDrafts.length === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table
              ref={tableRef}
              className="w-full text-sm min-w-[820px]"
            >
            <thead className="bg-stone-50 text-left text-stone-600">
              <tr>
                <th className="px-2 py-3 w-8 text-center text-xs font-medium">#</th>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((g) => selected.has(g.id))}
                    onChange={(e) => selectAll(e.target.checked)}
                    className="rounded border-stone-400"
                  />
                </th>
                <th className="px-3 py-3 w-8" />
                <th className="px-3 py-3 min-w-[130px] font-medium">Name</th>
                <th className="px-3 py-3 min-w-[140px] font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Locale</th>
                <th className="px-3 py-3 font-medium">+1</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((row, idx) => {
                return (
                  <tr
                    key={row.id}
                    data-id={row.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.id, el);
                      else rowRefs.current.delete(row.id);
                    }}
                    className={`${
                      dragId && dragId !== row.id ? "bg-stone-100" : "hover:bg-stone-50/80"
                    } ${sortBy === "priority" ? "cursor-move" : ""} ${
                      dragId === row.id ? "opacity-30" : ""
                    } ${dragOverId === row.id ? "bg-emerald-50" : ""}`}
                  >
                    <td className="px-2 py-3 text-center text-xs text-stone-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="rounded border-stone-400"
                      />
                    </td>
                    <td
                      className="px-3 py-3 text-stone-400 select-none touch-none"
                      data-drag-handle
                      data-id={row.id}
                    >
                      {sortBy === "priority" ? (
                        <span
                          className="inline-block px-2 py-1 text-lg leading-none cursor-grab active:cursor-grabbing touch-none"
                          onPointerDown={(e) => handlePointerDown(e, row.id)}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={handlePointerUp}
                        >
                          ⋮⋮
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="px-3 py-3 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorFromId(row.id) }}
                        />
                        <input
                          value={row.guestName}
                          onChange={(e) =>
                            setRawItems((prev) =>
                              prev.map((g) =>
                                g.id === row.id ? { ...g, guestName: e.target.value } : g,
                              ),
                            )
                          }
                          onBlur={(e) => updateGuest(row.id, { guestName: e.target.value })}
                          disabled={!canEdit}
                          className="w-full min-w-0 bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-400 rounded px-1 py-0.5 text-stone-900 font-medium disabled:opacity-70"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 min-w-[140px]">
                      <input
                        value={row.guestPhone ?? ""}
                        onChange={(e) =>
                          setRawItems((prev) =>
                            prev.map((g) =>
                              g.id === row.id ? { ...g, guestPhone: e.target.value || null } : g,
                            ),
                          )
                        }
                        onBlur={(e) =>
                          updateGuest(row.id, {
                            guestPhone: e.target.value ? e.target.value.trim() : null,
                          })
                        }
                        disabled={!canEdit}
                        placeholder="Phone"
                        className="w-full min-w-0 bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-400 rounded px-1 py-0.5 text-stone-700 disabled:opacity-70"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={row.locale}
                        onChange={(e) => updateGuest(row.id, { locale: e.target.value })}
                        disabled={!canEdit}
                        className="bg-transparent border border-transparent hover:border-stone-200 focus:border-stone-400 rounded px-1 py-0.5 text-xs uppercase text-stone-600 disabled:opacity-70"
                      >
                        <option value="id">ID</option>
                        <option value="en">EN</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {canEdit ? (
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.allowPlusOne}
                            onChange={(e) =>
                              updateGuest(row.id, { allowPlusOne: e.target.checked })
                            }
                            className="rounded border-stone-400"
                          />
                          <span className="text-xs text-stone-500">Yes</span>
                        </label>
                      ) : (
                        <span className="text-xs text-stone-500">
                          {row.allowPlusOne ? "Yes" : "No"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          STATUS_BADGE[row.status] ?? "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {row.status === "draft" ? null : (
                          <Link
                            href={`/admin/invitations/${row.id}`}
                            className="text-rose-800 hover:underline text-xs"
                          >
                            Open
                          </Link>
                        )}
                        {canEdit && ["expired", "declined", "revoked"].includes(row.status) && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowRenew({ id: row.id, name: row.guestName })
                            }
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            Renew
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(row.id)}
                            className="text-xs text-stone-500 hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="p-6 text-center text-stone-500">
              No guests found.
              {filterName || filterStatuses.length > 0 ? " Try clearing filters." : ""}
            </p>
          )}
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-sm w-full shadow-lg space-y-4">
            <h3 className="font-serif text-xl text-stone-900">Generate invitations</h3>
            <p className="text-sm text-stone-600">
              {selectedDrafts.length} draft{selectedDrafts.length === 1 ? "" : "s"} selected.
              Missing phone numbers will cause errors.
            </p>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Expiry</label>
              <input
                type="datetime-local"
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowGenerate(false)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onGenerateSelected}
                disabled={generating}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-sm w-full shadow-lg space-y-4">
            <h3 className="font-serif text-xl text-stone-900">Renew invitation</h3>
            <p className="text-sm text-stone-600">
              Renew for <strong>{showRenew.name}</strong>
            </p>
            <div>
              <label className="block text-xs text-stone-500 mb-1">New expiry</label>
              <input
                type="datetime-local"
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRenew(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onRenew}
                disabled={renewing}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50"
              >
                {renewing ? "Renewing…" : "Renew"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-stone-200 p-6 max-w-sm w-full shadow-lg space-y-4">
            <h3 className="font-serif text-xl text-stone-900">Confirm</h3>
            <p className="text-sm text-stone-600">
              {(() => {
                const g = rawItems.find((x) => x.id === showDeleteConfirm);
                if (!g) return "";
                if (g.status === "draft") return "Delete this draft friend?";
                return "This will revoke the invitation. Continue?";
              })()}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
