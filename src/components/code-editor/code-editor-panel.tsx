"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import type { Monaco } from "@monaco-editor/react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-sm text-stone-500">
      에디터 로딩 중...
    </div>
  ),
});

interface CodeEditorPanelProps {
  starterCode?: Record<string, string>;
  onCodeChange?: (code: string, language: string) => void;
}

const LANGUAGE_OPTIONS = [
  { value: "java", label: "Java" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "sql", label: "SQL" },
] as const;

function registerJavaCompletions(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider("java", {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const snippets = [
        // Classes & methods
        { label: "class", insertText: "public class ${1:ClassName} {\n\t$0\n}", detail: "클래스 선언" },
        { label: "main", insertText: "public static void main(String[] args) {\n\t$0\n}", detail: "메인 메서드" },
        { label: "method", insertText: "public ${1:void} ${2:methodName}(${3}) {\n\t$0\n}", detail: "메서드 선언" },
        { label: "private method", insertText: "private ${1:void} ${2:methodName}(${3}) {\n\t$0\n}", detail: "private 메서드" },
        { label: "constructor", insertText: "public ${1:ClassName}(${2}) {\n\t$0\n}", detail: "생성자" },
        { label: "interface", insertText: "public interface ${1:Name} {\n\t$0\n}", detail: "인터페이스" },
        { label: "enum", insertText: "public enum ${1:Name} {\n\t$0\n}", detail: "enum 선언" },
        { label: "record", insertText: "public record ${1:Name}(${2}) {\n}", detail: "레코드 (Java 16+)" },

        // Control flow
        { label: "if", insertText: "if (${1:condition}) {\n\t$0\n}", detail: "if 문" },
        { label: "ifelse", insertText: "if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}", detail: "if-else 문" },
        { label: "for", insertText: "for (int ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t$0\n}", detail: "for 루프" },
        { label: "foreach", insertText: "for (${1:Type} ${2:item} : ${3:collection}) {\n\t$0\n}", detail: "향상된 for 루프" },
        { label: "while", insertText: "while (${1:condition}) {\n\t$0\n}", detail: "while 루프" },
        { label: "trycatch", insertText: "try {\n\t$1\n} catch (${2:Exception} ${3:e}) {\n\t$0\n}", detail: "try-catch" },
        { label: "trywith", insertText: "try (${1:Resource} ${2:r} = ${3:new Resource()}) {\n\t$0\n}", detail: "try-with-resources" },

        // Collections
        { label: "List.of", insertText: "List.of(${1})", detail: "불변 리스트" },
        { label: "new ArrayList", insertText: "new ArrayList<>(${1})", detail: "ArrayList 생성" },
        { label: "new HashMap", insertText: "new HashMap<>(${1})", detail: "HashMap 생성" },
        { label: "Collections.unmodifiable", insertText: "Collections.unmodifiableList(${1})", detail: "불변 컬렉션 변환" },

        // Stream
        { label: "stream", insertText: "${1:list}.stream()\n\t.${0}", detail: "스트림 시작" },
        { label: "stream filter", insertText: ".filter(${1:item} -> ${2:condition})", detail: "스트림 필터" },
        { label: "stream map", insertText: ".map(${1:item} -> ${2:transform})", detail: "스트림 맵" },
        { label: "stream collect", insertText: ".collect(Collectors.toList())", detail: "스트림 수집" },
        { label: "stream toList", insertText: ".toList()", detail: "스트림 → 리스트 (Java 16+)" },
        { label: "stream reduce", insertText: ".reduce(${1:identity}, (${2:a}, ${3:b}) -> ${0})", detail: "스트림 리듀스" },
        { label: "stream forEach", insertText: ".forEach(${1:item} -> ${0})", detail: "스트림 forEach" },
        { label: "stream count", insertText: ".count()", detail: "스트림 카운트" },
        { label: "stream groupingBy", insertText: ".collect(Collectors.groupingBy(${1:classifier}))", detail: "그룹핑" },

        // Optional
        { label: "Optional.of", insertText: "Optional.of(${1})", detail: "Optional 생성" },
        { label: "Optional.empty", insertText: "Optional.empty()", detail: "빈 Optional" },
        { label: "Optional.ofNullable", insertText: "Optional.ofNullable(${1})", detail: "Optional (nullable)" },
        { label: ".orElse", insertText: ".orElse(${1:default})", detail: "Optional orElse" },
        { label: ".orElseThrow", insertText: ".orElseThrow(() -> new ${1:IllegalArgumentException}(${2}))", detail: "Optional orElseThrow" },

        // JUnit 5 & AssertJ
        { label: "@Test", insertText: "@Test\nvoid ${1:testName}() {\n\t$0\n}", detail: "JUnit 테스트 메서드" },
        { label: "@DisplayName", insertText: "@DisplayName(\"${1}\")", detail: "테스트 이름" },
        { label: "@ParameterizedTest", insertText: "@ParameterizedTest\n@${1:ValueSource}(${2})\nvoid ${3:testName}(${4}) {\n\t$0\n}", detail: "파라미터 테스트" },
        { label: "@BeforeEach", insertText: "@BeforeEach\nvoid setUp() {\n\t$0\n}", detail: "테스트 셋업" },
        { label: "assertThat", insertText: "assertThat(${1:actual}).${0}", detail: "AssertJ 시작" },
        { label: ".isEqualTo", insertText: ".isEqualTo(${1:expected})", detail: "AssertJ 동등 비교" },
        { label: ".contains", insertText: ".contains(${1})", detail: "AssertJ 포함 확인" },
        { label: ".hasSize", insertText: ".hasSize(${1})", detail: "AssertJ 사이즈 확인" },
        { label: ".isTrue", insertText: ".isTrue()", detail: "AssertJ true 확인" },
        { label: ".isFalse", insertText: ".isFalse()", detail: "AssertJ false 확인" },
        { label: "assertThatThrownBy", insertText: "assertThatThrownBy(() -> ${1})\n\t.isInstanceOf(${2:IllegalArgumentException}.class);", detail: "예외 검증" },
        { label: "assertThatCode", insertText: "assertThatCode(() -> ${1})\n\t.doesNotThrowAnyException();", detail: "예외 미발생 검증" },

        // JDBC
        { label: "Connection", insertText: "Connection connection = DriverManager.getConnection(${1:url}, ${2:user}, ${3:password});", detail: "JDBC 연결" },
        { label: "PreparedStatement", insertText: "PreparedStatement pstmt = connection.prepareStatement(${1:sql});", detail: "PreparedStatement" },
        { label: "ResultSet", insertText: "ResultSet rs = pstmt.executeQuery();\nwhile (rs.next()) {\n\t$0\n}", detail: "ResultSet 순회" },

        // Common patterns
        { label: "sout", insertText: "System.out.println(${1});", detail: "출력" },
        { label: "override", insertText: "@Override\npublic ${1:void} ${2:method}(${3}) {\n\t$0\n}", detail: "@Override 메서드" },
        { label: "lambda", insertText: "(${1:params}) -> ${2:expression}", detail: "람다식" },
        { label: "throw new", insertText: "throw new ${1:IllegalArgumentException}(${2:message});", detail: "예외 발생" },
        { label: "validate", insertText: "if (${1:condition}) {\n\tthrow new IllegalArgumentException(${2:\"message\"});\n}", detail: "입력 검증 패턴" },
      ];

      return {
        suggestions: snippets.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.detail,
          range,
        })),
      };
    },
  });
}

export function CodeEditorPanel({ starterCode, onCodeChange }: CodeEditorPanelProps) {
  const availableLanguages = starterCode
    ? LANGUAGE_OPTIONS.filter((l) => l.value in starterCode)
    : LANGUAGE_OPTIONS;

  const defaultLang = (availableLanguages[0]?.value ?? "java") as string;
  const [language, setLanguage] = useState(defaultLang);
  const [code, setCode] = useState(starterCode?.[defaultLang] ?? "");
  const [output] = useState("");
  const registeredRef = useRef(false);

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const newCode = starterCode?.[newLang] ?? "";
    setCode(newCode);
    onCodeChange?.(newCode, newLang);
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value ?? "";
    setCode(newCode);
    onCodeChange?.(newCode, language);
  };

  const handleReset = () => {
    const resetCode = starterCode?.[language] ?? "";
    setCode(resetCode);
    onCodeChange?.(resetCode, language);
  };

  const handleEditorMount = (monaco: Monaco) => {
    if (registeredRef.current) return;
    registeredRef.current = true;
    registerJavaCompletions(monaco);
  };

  return (
    <div className="flex flex-col h-full border-l border-stone-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800 bg-stone-900">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="text-sm rounded-lg border border-stone-700 bg-stone-800 text-stone-200
              px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {(availableLanguages.length > 0 ? availableLanguages : LANGUAGE_OPTIONS).map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-300 px-2 py-1 rounded"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            초기화
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          beforeMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 12 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            snippetSuggestions: "top",
          }}
        />
      </div>

      {/* Output */}
      {output && (
        <div className="border-t border-stone-800 bg-black p-4 max-h-40 overflow-y-auto">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}
