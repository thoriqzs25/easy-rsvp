"use client";

import { createContext, useContext } from "react";
import type { AdminRole } from "@/lib/types";

export type AdminSession = {
  name: string;
  email: string;
  role: AdminRole;
};

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({
  value,
  children,
}: {
  value: AdminSession | null;
  children: React.ReactNode;
}) {
  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  return useContext(AdminSessionContext);
}
