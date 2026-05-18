"use client";

import { useState } from "react";
import Link from "next/link";

export default function BootstrapPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [passkey, setPasskey] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, passkey }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const parts = [j.error, j.detail].filter(Boolean);
        setMsg(parts.length ? parts.join(" — ") : "Request failed");
        return;
      }
      setOk(true);
      setMsg("Super admin created. Sign in with your email and password.");
    } catch {
      setMsg("Network error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-stone-900 mb-2">
          Bootstrap super admin
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Only works while no super admin exists, and passkey must match{" "}
          <code className="bg-stone-100 px-1">SUPER_ADMIN_BOOTSTRAP_PASSKEY</code>.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-600 mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1">
              Bootstrap passkey
            </label>
            <input
              type="password"
              required
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>
          {msg ? (
            <p
              className={`text-sm px-2 py-1 rounded whitespace-pre-wrap break-words ${
                ok ? "text-green-800 bg-green-50" : "text-red-600 bg-red-50"
              }`}
            >
              {msg}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-rose-800 text-white font-medium hover:bg-rose-900"
          >
            Create super admin
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/admin/login" className="text-rose-800 underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
