"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Send, Save, ChevronLeft, Loader2, Check, FileText, X, Eye, Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseJsonToProfiles, type ParsedProfile } from "@/lib/parse-profiles";

const ADMIN_KEY_STORAGE = "fletcher-admin-key";
function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}


export default function BulkProfilesPage() {
  const [step, setStep] = useState<"input" | "refine">("input");
  const [rawInput, setRawInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [profiles, setProfiles] = useState<ParsedProfile[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState<string[] | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    "x-admin-key": getAdminKey(),
  }), []);

  // 파일 읽기
  const readFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const textFiles = fileArray.filter((f) =>
      f.type.startsWith("text/") || f.name.endsWith(".txt") || f.name.endsWith(".csv") || f.name.endsWith(".md") || f.name.endsWith(".json")
    );

    if (textFiles.length === 0) return;

    Promise.all(
      textFiles.map((file) =>
        file.text().then((content) => ({ name: file.name, content }))
      )
    ).then((results) => {
      setUploadedFiles((prev) => [...prev, ...results]);
    });
  }, []);

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-amber-500");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-amber-500");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-amber-500");
    if (e.dataTransfer.files.length) {
      readFiles(e.dataTransfer.files);
    }
  }, [readFiles]);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 벌크 파싱 (클라이언트에서 직접 파싱 — 서버 전송 없음)
  const handleParse = () => {
    if (!hasContent) return;

    setIsParsing(true);
    setParseProgress("파싱 중...");

    try {
      const allProfiles: ParsedProfile[] = [];

      for (const file of uploadedFiles) {
        try {
          const data = JSON.parse(file.content);

          // 프로필 형태: {"nickname": ..., "summary": ...}
          if (data.nickname && typeof data.nickname === "string") {
            allProfiles.push({
              nickname: data.nickname,
              summary: data.summary ?? data.rawData ?? "",
            });
            continue;
          }

          // 배열 형태: [{"nickname": ...}, ...]
          if (Array.isArray(data) && data[0]?.nickname) {
            for (const item of data) {
              if (item.nickname) {
                allProfiles.push({
                  nickname: item.nickname,
                  summary: item.summary ?? item.rawData ?? "",
                });
              }
            }
            continue;
          }

          // 범용 JSON — 재귀적으로 사람 단위 추출
          const parsed = parseJsonToProfiles(data);
          if (parsed.length > 0) {
            for (const p of parsed) {
              const existing = allProfiles.find((e) => e.nickname === p.nickname);
              if (existing) {
                existing.summary += "\n\n---\n\n" + p.summary;
              } else {
                allProfiles.push(p);
              }
            }
            continue;
          }

          // 파싱 실패 — 파일명으로 프로필 생성
          allProfiles.push({
            nickname: file.name.replace(/\.[^.]+$/, ""),
            summary: file.content.slice(0, 5000),
          });
        } catch {
          // JSON 아닌 텍스트 파일
          allProfiles.push({
            nickname: file.name.replace(/\.[^.]+$/, ""),
            summary: file.content,
          });
        }
      }

      // 직접 입력 텍스트
      if (rawInput.trim()) {
        allProfiles.push({
          nickname: "(직접 입력)",
          summary: rawInput,
        });
      }

      if (allProfiles.length > 0) {
        setProfiles(allProfiles);

        const msg = `${allProfiles.length}명의 크루를 파싱했습니다:\n\n${allProfiles.slice(0, 20).map((p) => `- **${p.nickname}**`).join("\n")}${allProfiles.length > 20 ? `\n- ... 외 ${allProfiles.length - 20}명` : ""}\n\n좌측에서 클릭하여 내용을 확인/수정하세요.\n수정 완료 후 "전체 저장"을 눌러주세요.`;

        setChatMessages([{ role: "assistant", content: msg }]);
        setStep("refine");
      } else {
        setParseProgress("크루를 찾을 수 없습니다.");
      }
    } catch (e) {
      console.error(e);
      setParseProgress("파싱에 실패했습니다.");
    } finally {
      setIsParsing(false);
    }
  };

  // 대화로 다듬기
  const handleRefine = async () => {
    if (!chatInput.trim() || isRefining) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsRefining(true);

    try {
      const res = await fetch("/api/admin/profiles/bulk", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "refine", profiles, userMessage: userMsg }),
      });
      const data = await res.json();
      if (data.profiles) {
        const oldNames = new Set(profiles.map((p) => p.nickname));
        const newNames = new Set(data.profiles.map((p: ParsedProfile) => p.nickname));

        const added = data.profiles.filter((p: ParsedProfile) => !oldNames.has(p.nickname));
        const removed = profiles.filter((p) => !newNames.has(p.nickname));
        const modified = data.profiles.filter((p: ParsedProfile) => {
          const old = profiles.find((o) => o.nickname === p.nickname);
          return old && old.summary !== p.summary;
        });

        const changes: string[] = [];
        if (added.length) changes.push(`추가: ${added.map((p: ParsedProfile) => p.nickname).join(", ")}`);
        if (removed.length) changes.push(`삭제: ${removed.map((p: ParsedProfile) => p.nickname).join(", ")}`);
        if (modified.length) changes.push(`수정: ${modified.map((p: ParsedProfile) => p.nickname).join(", ")}`);

        let response = changes.length ? changes.join(" | ") : "변경 없음.";
        response += `\n\n현재 ${data.profiles.length}명. 추가 수정이 필요하면 말씀해주세요.`;

        setProfiles(data.profiles);
        setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
      }
    } catch (e) {
      console.error(e);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally {
      setIsRefining(false);
    }
  };

  // 중복 체크 후 저장
  const checkAndSave = async () => {
    try {
      const res = await fetch("/api/admin/profiles", { headers: { "x-admin-key": getAdminKey() } });
      const data = await res.json();
      const existingNames = new Set((data.profiles ?? []).map((p: { nickname: string }) => p.nickname));
      const duplicates = profiles.filter((p) => existingNames.has(p.nickname)).map((p) => p.nickname);

      if (duplicates.length > 0) {
        setOverwriteWarning(duplicates);
      } else {
        doSave();
      }
    } catch {
      doSave(); // 체크 실패하면 그냥 저장
    }
  };

  const doSave = async () => {
    setOverwriteWarning(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ bulk: true, profiles }),
      });
      const data = await res.json();
      if (data.count) {
        setSaved(true);
        setChatMessages((prev) => [...prev, {
          role: "assistant",
          content: `${data.count}명의 프로필을 저장했습니다.`,
        }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const hasContent = rawInput.trim() || uploadedFiles.length > 0;

  // Step 1: 벌크 입력
  if (step === "input") {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/admin/profiles" className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800">
                <ChevronLeft className="h-5 w-5" />
              </a>
              <h2 className="font-semibold text-amber-50">벌크 프로필 추가</h2>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-stone-400">
              크루들의 학습 데이터를 한번에 추가하세요. 텍스트 입력 또는 파일 업로드.
            </p>
          </div>

          {/* 파일 드롭존 */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-stone-700 rounded-xl p-8 text-center cursor-pointer
              hover:border-stone-600 transition-colors"
          >
            <Upload className="h-8 w-8 text-stone-600 mx-auto mb-3" />
            <p className="text-sm text-stone-400">파일을 드래그하거나 클릭하여 업로드</p>
            <p className="text-xs text-stone-600 mt-1">.txt, .csv, .md, .json 지원 · 여러 파일 가능</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.csv,.md,.json,text/*"
              onChange={(e) => e.target.files && readFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* 업로드된 파일 목록 */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">{uploadedFiles.length}개 파일 ({(uploadedFiles.reduce((acc, f) => acc + f.content.length, 0) / 1024).toFixed(0)}KB)</p>
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-300">
                    <FileText className="h-3.5 w-3.5 text-amber-500" />
                    {f.name}
                    <span className="text-stone-600">({(f.content.length / 1024).toFixed(0)}KB)</span>
                    <button onClick={() => removeFile(i)} className="text-stone-600 hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 또는 직접 입력 */}
          <div className="relative">
            <div className="absolute -top-3 left-3 bg-[var(--background)] px-2 text-xs text-stone-600">
              또는 직접 입력
            </div>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={12}
              placeholder={`네오 - 자동차 경주, 블랙잭 완료. OOP 잘함. JDBC 약함.\n브리 - 사다리 타기, 체스 완료. 함수형 프로그래밍 이해 부족.\n...`}
              className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-sm text-stone-100 font-mono
                focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-700 resize-y"
            />
          </div>

          <button
            onClick={handleParse}
            disabled={!hasContent || isParsing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-4 text-white font-semibold
              hover:bg-amber-500 disabled:opacity-30 transition-all"
          >
            {isParsing ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> {parseProgress || "AI가 파싱하는 중..."}</>
            ) : (
              <><Upload className="h-5 w-5" /> AI로 파싱하기</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: 다듬기 + 저장
  return (
    <div className="h-screen bg-[var(--background)] flex flex-col">
      <header className="border-b border-stone-800 bg-stone-900/80 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep("input")} className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-semibold text-amber-50">프로필 다듬기</h2>
              <p className="text-xs text-stone-500">{profiles.length}명</p>
            </div>
          </div>
          <button
            onClick={checkAndSave}
            disabled={isSaving || saved || profiles.length === 0}
            className="flex items-center gap-1.5 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium
              hover:bg-amber-500 disabled:opacity-30 transition-colors"
          >
            {saved ? <><Check className="h-4 w-4" /> 저장 완료</> : isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> 저장 중...</> : <><Save className="h-4 w-4" /> 전체 저장 ({profiles.length}명)</>}
          </button>
        </div>
      </header>

      {/* 덮어쓰기 경고 */}
      {overwriteWarning && (
        <div className="bg-amber-950/40 border-b border-amber-800 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm text-amber-300">
              <span className="font-medium">{overwriteWarning.length}명</span>의 기존 프로필이 덮어씌워집니다:
              <span className="text-amber-400 ml-1">
                {overwriteWarning.slice(0, 5).join(", ")}{overwriteWarning.length > 5 ? ` 외 ${overwriteWarning.length - 5}명` : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOverwriteWarning(null)}
                className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-md"
              >
                취소
              </button>
              <button
                onClick={doSave}
                className="text-xs text-amber-400 bg-amber-950/50 hover:bg-amber-900/50 px-3 py-1.5 rounded-md font-medium"
              >
                덮어쓰기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 크루 목록 */}
        <div className="w-72 border-r border-stone-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-stone-800 text-xs text-stone-500">
            {profiles.length}명 · 클릭하여 상세 확인
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {profiles.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`w-full text-left rounded-lg p-2.5 transition-colors ${
                  selectedIndex === i
                    ? "bg-amber-900/30 border border-amber-700/50"
                    : "hover:bg-stone-800/60 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-xs font-semibold text-amber-400 flex-shrink-0">
                    {p.nickname.charAt(0)}
                  </div>
                  <span className="text-sm text-stone-200 truncate">{p.nickname}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우측: 상세 보기 + 수정 / 대화 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedIndex !== null && profiles[selectedIndex] ? (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800">
                <h3 className="text-sm font-medium text-amber-50">{profiles[selectedIndex].nickname}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 px-2 py-1 rounded border border-stone-700"
                  >
                    {previewMode ? <><Pencil className="h-3 w-3" /> 편집</> : <><Eye className="h-3 w-3" /> 미리보기</>}
                  </button>
                  <button
                    onClick={() => {
                      setProfiles((prev) => prev.filter((_, i) => i !== selectedIndex));
                      setSelectedIndex(null);
                    }}
                    className="text-xs text-stone-600 hover:text-red-400 px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {previewMode ? (
                <div className="flex-1 overflow-y-auto px-4 py-3 prose-chat">
                  <ReactMarkdown>{profiles[selectedIndex].summary}</ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={profiles[selectedIndex].summary}
                  onChange={(e) => {
                    const updated = [...profiles];
                    updated[selectedIndex] = { ...updated[selectedIndex], summary: e.target.value };
                    setProfiles(updated);
                  }}
                  className="flex-1 bg-transparent px-4 py-3 text-sm text-stone-300 font-mono resize-none
                    focus:outline-none leading-relaxed"
                />
              )}
            </div>
          ) : (
            // 대화 기반 수정
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-amber-600 text-white rounded-tr-md" : "bg-stone-800 text-stone-200"
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isRefining && (
                  <div className="flex justify-start">
                    <div className="bg-stone-800 rounded-2xl px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-stone-800 p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleRefine(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="AI에게 수정 요청 (예: 네오의 약점에 DB 설계 추가해줘)"
                    disabled={isRefining}
                    className="flex-1 rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-3 text-sm text-stone-100
                      focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-stone-600 disabled:opacity-50"
                  />
                  <button type="submit" disabled={!chatInput.trim() || isRefining} className="rounded-xl bg-amber-600 px-4 py-3 text-white hover:bg-amber-500 disabled:opacity-20 transition-all">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
