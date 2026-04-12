# Contributing to Fletcher

Fletcher에 기여해주셔서 감사합니다.

## 개발 환경 설정

```bash
git clone https://github.com/jaeyeonling/fletcher.git
cd fletcher
npm install
cp .env.example .env
# .env 파일에 AWS 키와 ADMIN_KEY 설정
npm run dev
```

## 브랜치 전략

- `main` — 안정 버전
- `feat/*` — 기능 개발
- `fix/*` — 버그 수정

## 커밋 메시지

```
feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
docs: 문서
test: 테스트
chore: 설정, 의존성
```

## PR 가이드

1. 이슈를 먼저 확인하거나 생성합니다
2. `feat/` 또는 `fix/` 브랜치를 만듭니다
3. 변경 사항을 커밋합니다
4. `npm run build`가 에러 없이 통과하는지 확인합니다
5. `npm run lint`가 경고 없이 통과하는지 확인합니다
6. PR을 생성합니다

## 코드 스타일

- TypeScript strict
- 함수형 컴포넌트 + hooks
- Tailwind CSS (커스텀 CSS 최소화)
- 파일당 하나의 컴포넌트

## 프로젝트 구조

```
src/
├── app/                  Next.js App Router
│   ├── api/              API 라우트
│   ├── admin/            어드민 페이지
│   └── i/[slug]/         인터뷰 페이지
├── components/           UI 컴포넌트
│   ├── session/          세션 관련
│   └── code-editor/      코드 에디터
├── hooks/                커스텀 훅
└── lib/                  유틸리티
    ├── ai/               AI 관련 (프롬프트, 제공자)
    └── ...               기타 유틸
```
