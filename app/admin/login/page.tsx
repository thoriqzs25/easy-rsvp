"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase-client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(clientAuth(), email, password);
      router.replace("/admin");
    } catch {
      setErr("Sign-in failed. Check email and password.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-100">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-stone-900 mb-6 text-center">
          Admin sign in
        </h1>
        <form onSubmit={submit} className="space-y-4">
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
          {err ? (
            <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{err}</p>
          ) : null}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800"
          >
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">
          First deployment?{" "}
          <Link href="/admin/bootstrap" className="text-rose-800 underline">
            Create super admin
          </Link>
        </p>
      </div>
    </div>
  );
}
