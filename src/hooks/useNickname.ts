"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "fletcher-nickname";

export function useNickname() {
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setNicknameState(stored);
    setIsLoaded(true);
  }, []);

  const setNickname = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNicknameState(trimmed);
  }, []);

  const clearNickname = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setNicknameState(null);
  }, []);

  return { nickname, isLoaded, setNickname, clearNickname };
}
