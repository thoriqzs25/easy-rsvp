"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";
import type { AdminRole } from "@/lib/types";

type UserRow = {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: string | null;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [msg, setMsg] = useState("");

  async function load() {
    setErr("");
    try {
      const r = await adminJson<{ items: UserRow[] }>("/api/admin/users");
      setItems(r.items);
    } catch {
      setErr("Only super admins can view this page.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await adminJson("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, name, role }),
      });
      setMsg("User created.");
      setEmail("");
      setPassword("");
      setName("");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function changeRole(uid: string, next: AdminRole) {
    try {
      await adminJson(`/api/admin/users/${uid}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      await load();
    } catch {
      /* ignore */
    }
  }

  if (err) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{err}</p>
        <Link href="/admin" className="text-rose-800 underline">
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <h1 className="font-serif text-3xl text-stone-900">Admin users</h1>

      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((u) => (
              <tr key={u.uid}>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u.uid, e.target.value as AdminRole)
                    }
                    className="rounded border border-stone-300 px-2 py-1"
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
        <h2 className="font-medium text-stone-800">Invite admin</h2>
        <form onSubmit={createUser} className="grid gap-3 max-w-md">
          <input
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Temporary password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
            <option value="super_admin">super_admin</option>
          </select>
          <button
            type="submit"
            className="w-fit px-4 py-2 rounded-lg bg-stone-900 text-white text-sm"
          >
            Create
          </button>
        </form>
        {msg ? <p className="text-sm text-stone-600">{msg}</p> : null}
      </div>
    </div>
  );
}
