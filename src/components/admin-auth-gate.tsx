"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";

const ADMIN_KEY_STORAGE = "fletcher-admin-key";

export function useAdminAuth() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) {
      // 키 유효성 확인
      fetch("/api/admin/sessions", { headers: { "x-admin-key": stored } })
        .then((res) => {
          if (res.ok) {
            setAdminKey(stored);
            setIsAuthed(true);
          } else {
            localStorage.removeItem(ADMIN_KEY_STORAGE);
          }
        })
        .catch(() => {})
        .finally(() => setIsChecking(false));
    } else {
      setIsChecking(false);
    }
  }, []);

  const login = (key: string) => {
    setAdminKey(key);
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
    setIsAuthed(true);
  };

  return { adminKey, isAuthed, isChecking, login };
}

export function AdminAuthGate({
  children,
  isAuthed,
  isChecking,
  onLogin,
}: {
  children: React.ReactNode;
  isAuthed: boolean;
  isChecking: boolean;
  onLogin: (key: string) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [authError, setAuthError] = useState(false);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-spin w-6 h-6 border-2 border-stone-700 border-t-amber-500 rounded-full" />
      </div>
    );
  }

  if (!isAuthed) {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!keyInput.trim()) return;

      const res = await fetch("/api/admin/sessions", {
        headers: { "x-admin-key": keyInput.trim() },
      });

      if (res.ok) {
        onLogin(keyInput.trim());
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-6 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-stone-800 text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-amber-50">Fletcher Admin</h1>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin Key"
              autoFocus
              className="w-full rounded-xl border border-stone-700 bg-stone-900/80
                px-4 py-3 text-center text-stone-100
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600
                placeholder:text-stone-600"
            />
            {authError && <p className="text-xs text-red-400">인증에 실패했습니다</p>}
            <button
              type="submit"
              disabled={!keyInput.trim()}
              className="w-full rounded-xl bg-amber-600 px-4 py-3 text-white font-semibold
                hover:bg-amber-500 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              접속
            </button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
