"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { AdminSessionProvider, type AdminSession } from "@/components/AdminSessionContext";
import { clientAuth } from "@/lib/firebase-client";
import { adminJson } from "@/lib/admin-fetch";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [me, setMe] = useState<AdminSession | null>(null);

  const isPublic =
    path === "/admin/login" || path === "/admin/bootstrap";

  useEffect(() => {
    const auth = clientAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (user === undefined || isPublic) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    adminJson<{ name: string; email: string; role: AdminSession["role"]; uid: string }>(
      "/api/admin/me",
    )
      .then((r) =>
        setMe({ name: r.name, email: r.email, role: r.role }),
      )
      .catch(() => setMe(null));
  }, [user, isPublic, router]);

  useEffect(() => {
    if (user === undefined) return;
    if (user && path === "/admin/login") router.replace("/admin");
  }, [user, path, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (user === undefined || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-500">Checking session…</p>
      </div>
    );
  }

  return (
    <AdminSessionProvider value={me}>
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
            <nav className="flex flex-wrap gap-4 text-sm font-medium text-stone-700">
              <Link href="/admin" className="hover:text-rose-800">
                Dashboard
              </Link>
              <Link href="/admin/guests" className="hover:text-rose-800">
                Guests
              </Link>
              <Link href="/admin/invitations" className="hover:text-rose-800">
                Invitations
              </Link>
              <Link
                href="/admin/settings/event"
                className="hover:text-rose-800"
              >
                Event details
              </Link>
              {me?.role === "super_admin" ? (
                <Link href="/admin/users" className="hover:text-rose-800">
                  Admins
                </Link>
              ) : null}
            </nav>
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <span>{me?.name || user.email}</span>
              <button
                type="button"
                className="text-rose-800 hover:underline"
                onClick={() => {
                  void signOut(clientAuth()).then(() =>
                    router.replace("/admin/login"),
                  );
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          {children}
        </main>
      </div>
    </AdminSessionProvider>
  );
}
