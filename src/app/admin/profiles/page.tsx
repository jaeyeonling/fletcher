"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus, Trash2, ChevronLeft, Save, AlertCircle, Users, Loader2,
} from "lucide-react";

const ADMIN_KEY_STORAGE = "fletcher-admin-key";
function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
}

interface Profile {
  nickname: string;
  rawData: string;
  summary: string;
  updatedAt: string;
}

export default function ProfilesAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<{ nickname: string; rawData: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [newNickname, setNewNickname] = useState("");

  const fetchProfiles = () => {
    setIsLoading(true);
    fetch("/api/admin/profiles", { headers: { "x-admin-key": getAdminKey() } })
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles ?? []))
      .catch((e) => console.error(e))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleEdit = (profile: Profile) => {
    setEditing({ nickname: profile.nickname, rawData: profile.rawData });
    setSavedSummary(profile.summary);
  };

  const handleNew = () => {
    if (!newNickname.trim()) return;
    setEditing({ nickname: newNickname.trim(), rawData: "" });
    setSavedSummary(null);
    setNewNickname("");
  };

  const handleSave = () => {
    if (!editing) return;
    setIsSaving(true);
    setSavedSummary(null);
    fetch("/api/admin/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": getAdminKey() },
      body: JSON.stringify(editing),
    })
      .then((res) => res.json())
      .then((data) => {
        setSavedSummary(data.summary);
        fetchProfiles();
      })
      .catch((e) => console.error(e))
      .finally(() => setIsSaving(false));
  };

  const handleDelete = (nickname: string) => {
    fetch("/api/admin/profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-key": getAdminKey() },
      body: JSON.stringify({ nickname }),
    })
      .then(() => {
        setDeleteConfirm(null);
        setEditing(null);
        fetchProfiles();
      })
      .catch((e) => console.error(e));
  };

  const handleClearAll = () => {
    fetch("/api/admin/profiles/clear", {
      method: "DELETE",
      headers: { "x-admin-key": getAdminKey() },
    })
      .then((res) => res.json())
      .then(() => {
        setClearConfirm(false);
        fetchProfiles();
      })
      .catch((e) => console.error(e));
  };

  // 편집 뷰
  if (editing) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setEditing(null); setSavedSummary(null); }}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-semibold text-amber-50">{editing.nickname} 프로필</h2>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium
                hover:bg-amber-500 disabled:opacity-30 transition-colors"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "AI 정리 중..." : "저장 (AI 정리)"}
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-400">
              비정형 데이터 (자유롭게 입력)
            </label>
            <p className="text-[10px] text-stone-600">
              미션 결과, 코드리뷰 피드백, 코치 메모, 성적, 특이사항 등 — 형식 없이 때려 넣으세요. AI가 정리합니다.
            </p>
            <textarea
              value={editing.rawData}
              onChange={(e) => setEditing({ ...editing, rawData: e.target.value })}
              rows={16}
              placeholder={`예시:\n\n자동차 경주 미션 - 완료. MVC 패턴 적용함. 리뷰어 피드백: "도메인 로직이 컨트롤러에 섞여 있음"\n\n블랙잭 미션 - 완료. 상속으로 Dealer/Player 구현. 나중에 합성으로 리팩토링 시도. 테스트 잘 작성함.\n\nJDBC 이해가 약함. try-with-resources 왜 필요한지 설명 못함.\n\n페어 프로그래밍 적극적. 네비게이터 역할 잘함.`}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 font-mono
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-700 resize-y"
            />
          </div>

          {savedSummary && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-amber-400">AI가 정리한 요약</label>
              <div className="rounded-lg bg-stone-800/60 border border-stone-700 p-4 text-sm text-stone-300 whitespace-pre-wrap">
                {savedSummary}
              </div>
              <p className="text-[10px] text-stone-600">
                이 요약이 인터뷰 시 AI에게 전달됩니다. 원본 데이터도 함께 저장됩니다.
              </p>
            </div>
          )}
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
              <h1 className="font-semibold text-amber-50">크루 프로필</h1>
              <p className="text-xs text-stone-500">학습 정보 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-xs text-stone-500 hover:text-stone-300">세션 관리</a>
            <a href="/admin/interviews" className="text-xs text-stone-500 hover:text-stone-300">인터뷰 관리</a>
            <a href="/admin/stats" className="text-xs text-stone-500 hover:text-stone-300">통계</a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 새 프로필 추가 */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            placeholder="닉네임 입력"
            onKeyDown={(e) => e.key === "Enter" && handleNew()}
            className="flex-1 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100
              focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600"
          />
          <button
            onClick={handleNew}
            disabled={!newNickname.trim()}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium
              hover:bg-amber-500 disabled:opacity-20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
          <a
            href="/admin/profiles/bulk"
            className="flex items-center gap-1.5 bg-stone-800 text-stone-300 px-4 py-2 rounded-lg text-sm font-medium
              hover:bg-stone-700 transition-colors border border-stone-700"
          >
            벌크 추가
          </a>
          {profiles.length > 0 && (
            <button
              onClick={() => setClearConfirm(true)}
              className="flex items-center gap-1.5 text-stone-600 hover:text-red-400 px-3 py-2 rounded-lg text-sm
                hover:bg-stone-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              전체 삭제
            </button>
          )}
        </div>

        {clearConfirm && (
          <div className="flex items-center justify-between bg-red-950/30 border border-red-900 rounded-xl px-4 py-3 mb-6">
            <div className="text-sm text-red-400">
              <span className="font-medium">{profiles.length}명</span>의 프로필을 전부 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setClearConfirm(false)} className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-md">
                취소
              </button>
              <button onClick={handleClearAll} className="text-xs text-red-400 bg-red-950/50 hover:bg-red-900/50 px-3 py-1.5 rounded-md font-medium">
                전체 삭제
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-stone-700 border-t-amber-500 rounded-full" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Users className="h-8 w-8 text-stone-700 mx-auto" />
            <p className="text-stone-600">아직 등록된 크루 프로필이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div key={profile.nickname} className="rounded-xl border border-stone-800 bg-stone-900/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-sm font-semibold text-amber-400">
                      {profile.nickname.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-stone-200">{profile.nickname}</span>
                      <p className="text-xs text-stone-600 truncate max-w-md">
                        {profile.summary ? profile.summary.slice(0, 80) + "..." : "데이터 없음"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(profile)}
                      className="px-3 py-1.5 rounded-md text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(profile.nickname)}
                      className="p-2 rounded-md text-stone-600 hover:text-red-400 hover:bg-stone-800 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {deleteConfirm === profile.nickname && (
                  <div className="flex items-center justify-between mt-3 bg-red-950/30 border border-red-900 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      삭제하시겠습니까?
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-stone-400 px-2 py-1">취소</button>
                      <button onClick={() => handleDelete(profile.nickname)} className="text-xs text-red-400 px-2 py-1">삭제</button>
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
