"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus, Trash2, Copy, ExternalLink, ChevronLeft, Save, AlertCircle,
} from "lucide-react";
import type { InterviewConfig } from "@/lib/interview-config";
import { DEFAULT_PERSONA, DEFAULT_CURRICULUM, DEFAULT_FIRST_MESSAGE } from "@/lib/interview-config";

const ADMIN_KEY_STORAGE = "fletcher-admin-key";

function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
}

export default function InterviewsAdminPage() {
  const [interviews, setInterviews] = useState<InterviewConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<InterviewConfig> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchInterviews = () => {
    setIsLoading(true);
    fetch("/api/admin/interviews", { headers: { "x-admin-key": getAdminKey() } })
      .then((res) => res.json())
      .then((data) => setInterviews(data.interviews ?? []))
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleSave = () => {
    if (!editing) return;
    setIsSaving(true);
    fetch("/api/admin/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": getAdminKey() },
      body: JSON.stringify(editing),
    })
      .then((res) => res.json())
      .then(() => {
        setEditing(null);
        fetchInterviews();
      })
      .catch((e) => console.error(e))
      .finally(() => setIsSaving(false));
  };

  const handleDelete = (id: string) => {
    fetch("/api/admin/interviews", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-key": getAdminKey() },
      body: JSON.stringify({ id }),
    })
      .then(() => {
        setDeleteConfirm(null);
        fetchInterviews();
      })
      .catch((e) => console.error(e));
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/i/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const startNew = () => {
    setEditing({
      title: "",
      slug: "",
      description: "",
      persona: DEFAULT_PERSONA,
      curriculum: DEFAULT_CURRICULUM,
      firstMessage: DEFAULT_FIRST_MESSAGE,
      timeLimitMinutes: 60,
      warningMinutes: [30, 50, 55, 59],
      active: true,
    });
  };

  // 편집 뷰
  if (editing) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-semibold text-amber-50">
                {editing.id ? "인터뷰 수정" : "새 인터뷰"}
              </h2>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || !editing.title?.trim() || !editing.slug?.trim()}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium
                hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-400">제목</label>
              <input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="레벨1 백엔드 학습 평가"
                className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100
                  focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-400">슬러그 (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600">/i/</span>
                <input
                  value={editing.slug ?? ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value.replace(/[^a-zA-Z0-9-]/g, "") })}
                  placeholder="level1-backend"
                  className="flex-1 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                    focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">설명 (크루에게 표시)</label>
            <input
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="레벨1에서 배운 내용을 증명하세요"
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-400">제한시간 (분)</label>
              <input
                type="number"
                value={editing.timeLimitMinutes ?? 60}
                onChange={(e) => setEditing({ ...editing, timeLimitMinutes: parseInt(e.target.value) || 60 })}
                className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100
                  focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-400">경고 시점 (분, 쉼표 구분)</label>
              <input
                value={(editing.warningMinutes ?? []).join(", ")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    warningMinutes: e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
                  })
                }
                placeholder="30, 50, 55, 59"
                className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                  focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">마감 기한 (비워두면 무기한)</label>
            <input
              type="datetime-local"
              value={editing.deadline ? new Date(new Date(editing.deadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
              onChange={(e) => setEditing({ ...editing, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100
                focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {/* Persona */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">페르소나 (AI 시스템 프롬프트)</label>
            <textarea
              value={editing.persona ?? ""}
              onChange={(e) => setEditing({ ...editing, persona: e.target.value })}
              rows={12}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600 resize-y"
            />
          </div>

          {/* Curriculum */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">커리큘럼 (학습 범위)</label>
            <textarea
              value={editing.curriculum ?? ""}
              onChange={(e) => setEditing({ ...editing, curriculum: e.target.value })}
              rows={8}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600 resize-y"
            />
          </div>

          {/* First message */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">
              첫 메시지 템플릿
              <span className="text-stone-600 ml-2">{"{nickname}"} {"{curriculum_formatted}"} 사용 가능</span>
            </label>
            <textarea
              value={editing.firstMessage ?? ""}
              onChange={(e) => setEditing({ ...editing, firstMessage: e.target.value })}
              rows={6}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600 resize-y"
            />
          </div>
        </div>
      </div>
    );
  }

  // 목록 뷰
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-amber-600/30">
              <Image src="/fletcher.png" alt="F" width={32} height={32} className="object-cover object-top" />
            </div>
            <div>
              <h1 className="font-semibold text-amber-50">인터뷰 관리</h1>
              <p className="text-xs text-stone-500">프롬프트 · 커리큘럼 · 링크</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-xs text-stone-500 hover:text-stone-300">세션 관리</a>
            <a href="/admin/profiles" className="text-xs text-stone-500 hover:text-stone-300">크루 프로필</a>
            <a href="/admin/stats" className="text-xs text-stone-500 hover:text-stone-300">통계</a>
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              새 인터뷰
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-stone-600">아직 인터뷰가 없습니다</p>
            <button onClick={startNew} className="text-sm text-amber-500 hover:text-amber-400">
              첫 인터뷰 만들기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((iv) => (
              <div
                key={iv.id}
                className="rounded-xl border border-stone-800 bg-stone-900/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-200">{iv.title}</span>
                        {iv.deadline && new Date(iv.deadline).getTime() < Date.now() ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/40 text-red-400">마감됨</span>
                        ) : iv.active ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/40 text-green-400">활성</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-500">비활성</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        /i/{iv.slug} · {iv.timeLimitMinutes}분 · {iv.curriculum.split("\n").filter(Boolean).length}개 항목
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyLink(iv.slug)}
                      title="링크 복사"
                      className="p-2 rounded-md text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors"
                    >
                      {copiedSlug === iv.slug ? (
                        <span className="text-xs text-green-400">복사됨</span>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <a
                      href={`/i/${iv.slug}`}
                      target="_blank"
                      title="미리보기"
                      className="p-2 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => setEditing(iv)}
                      className="px-3 py-1.5 rounded-md text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(iv.id)}
                      className="p-2 rounded-md text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {deleteConfirm === iv.id && (
                  <div className="flex items-center justify-between mt-3 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      삭제하시겠습니까?
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-stone-400 px-2 py-1">취소</button>
                      <button onClick={() => handleDelete(iv.id)} className="text-xs text-red-400 px-2 py-1">삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
