"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // URL이면 slug 추출, 아니면 slug로 간주
    let slug = trimmed;
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "i" && parts[1]) {
        slug = parts[1];
      }
    } catch {
      // URL이 아니면 그대로 slug로 사용
    }

    // slug 유효성 확인
    fetch(`/api/interview?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        setError(false);
        router.push(`/i/${slug}`);
      })
      .catch(() => setError(true));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <div className="relative w-48 h-56 rounded-2xl overflow-hidden fletcher-portrait">
            <Image src="/fletcher.png" alt="Fletcher" fill className="object-cover object-top" priority />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-amber-50">Fletcher</h1>
          <p className="text-stone-500 text-sm italic">
            &ldquo;이 세상에서 가장 해로운 말은, 잘했어.&rdquo;
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="인터뷰 링크를 입력하세요"
            autoFocus
            className="w-full rounded-xl border border-stone-700 bg-stone-900/80
              px-5 py-4 text-center text-sm text-stone-100
              focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600
              placeholder:text-stone-600 transition-all"
          />
          {error && (
            <p className="text-xs text-red-400 text-center">유효하지 않은 링크입니다</p>
          )}
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full rounded-xl bg-amber-600 px-5 py-4 text-white font-semibold text-base
              hover:bg-amber-500 active:scale-[0.98] transition-all
              disabled:opacity-20 disabled:cursor-not-allowed"
          >
            입장
          </button>
        </form>
      </div>
    </div>
  );
}
