"use client";

import { AdminAuthGate, useAdminAuth } from "@/components/admin-auth-gate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthed, isChecking, login } = useAdminAuth();

  return (
    <AdminAuthGate
      isAuthed={isAuthed}
      isChecking={isChecking}
      onLogin={login}
    >
      {children}
    </AdminAuthGate>
  );
}
