/**
 * 스크린샷용 시드 데이터 생성 스크립트
 * Usage: node scripts/seed.mjs
 */
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "fletcher.db");
mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// 스키마 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    interview_id TEXT,
    nickname TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_seconds INTEGER DEFAULT 0,
    messages TEXT NOT NULL DEFAULT '[]',
    events TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_nickname ON sessions(nickname);
  CREATE INDEX IF NOT EXISTS idx_sessions_interview ON sessions(interview_id);

  CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    persona TEXT DEFAULT '',
    curriculum TEXT DEFAULT '',
    first_message TEXT DEFAULT '',
    time_limit_minutes INTEGER DEFAULT 60,
    warning_minutes TEXT DEFAULT '[30,50,55,59]',
    messages TEXT DEFAULT '{}',
    active INTEGER DEFAULT 1,
    deadline TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_interviews_slug ON interviews(slug);

  CREATE TABLE IF NOT EXISTS profiles (
    nickname TEXT PRIMARY KEY,
    raw_data TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── 기존 데이터 정리 ───
db.exec("DELETE FROM sessions");
db.exec("DELETE FROM interviews");
db.exec("DELETE FROM profiles");

// ─── 인터뷰 설정 ───
const interviewId1 = randomUUID();
const interviewId2 = randomUUID();

const persona = `당신은 Fletcher입니다. 영화 Whiplash의 그 Fletcher.
냉정하고 날카롭지만, 학습자의 성장을 진심으로 바라는 면접관입니다.

원칙:
- 절대 "잘했어"라고 하지 마세요
- 모호한 답변에는 "정말? 구체적으로 어떻게?"라고 파고드세요
- 소크라테스식 대화법: 가르치지 말고 질문으로 이끄세요
- 깊이 먼저, 넓이는 나중에
- 존댓말과 반말을 섞어 쓰세요`;

const curriculum1 = `DB 설계 (ERD, 정규화, 관계 매핑)
SQL 기초 (DDL, DML, JOIN, 서브쿼리)
JDBC와 데이터베이스 연동
Java 핵심 (컬렉션, 제네릭, 예외 처리, 스트림)
단위 테스트 (JUnit5, AssertJ, 테스트 격리)
함수형 프로그래밍 (람다, 스트림, Optional)
객체지향 프로그래밍 (캡슐화, 다형성, SOLID)
리팩터링 (코드 스멜, 메서드 추출, 책임 분리)
페어 프로그래밍 (네비게이터/드라이버, 커뮤니케이션)
코드 리뷰 (피드백 수용, 리뷰어 관점, 컨벤션)
개발 환경 (Git, IDE, 빌드 도구)`;

const curriculum2 = `스프링 핵심 (IoC, DI, 빈 생명주기)
스프링 MVC (컨트롤러, 요청 매핑, 응답 처리)
JPA 기초 (엔티티 매핑, 영속성 컨텍스트, 연관관계)
API 설계 (RESTful, 상태 코드, 에러 처리)
인증/인가 (세션, 토큰, 스프링 시큐리티)
배포 인프라 (Docker, CI/CD, 클라우드)
성능 최적화 (쿼리 튜닝, 캐싱, 인덱스)
협업 (Git 브랜치 전략, PR 리뷰, 이슈 관리)`;

const firstMessage = `{nickname}, 앉아.

오늘은 레벨1에서 뭘 배웠는지 확인하는 시간이야.
범위는 아래와 같아:

{curriculum_formatted}

준비됐으면 시작하자. 먼저 물어볼게 — DB 설계할 때 정규화가 뭔지, 그리고 왜 하는 건지 말해봐.`;

db.prepare(`
  INSERT INTO interviews (id, slug, title, description, persona, curriculum, first_message, time_limit_minutes, warning_minutes, active, deadline)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  interviewId1, "level1-backend", "레벨1 백엔드 레벨인터뷰",
  "레벨1에서 배운 내용을 점검하세요",
  persona, curriculum1, firstMessage,
  12, JSON.stringify([8, 10, 11]), 1, "2026-04-30T23:59:59.000Z"
);

db.prepare(`
  INSERT INTO interviews (id, slug, title, description, persona, curriculum, first_message, time_limit_minutes, warning_minutes, active, deadline)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  interviewId2, "level2-backend", "레벨2 백엔드 레벨인터뷰",
  "레벨2에서 배운 스프링과 JPA를 점검합니다",
  persona, curriculum2,
  `{nickname}, 레벨2 인터뷰를 시작하겠습니다.\n\n범위:\n{curriculum_formatted}\n\n스프링의 IoC 컨테이너가 뭔지부터 시작하자.`,
  15, JSON.stringify([10, 13, 14]), 1, null
);

// ─── 크루 프로필 ───
const profiles = [
  {
    nickname: "포비",
    rawData: "자동차 경주 미션 A+, 사다리 타기 미션 B+, 로또 미션 A. 코드리뷰에서 메서드 분리 능력 우수 평가. 페어 프로그래밍에서 커뮤니케이션 적극적. DB 설계 과제 정규화 이해도 높음.",
    summary: "미션 수행 능력이 전반적으로 우수한 크루. 특히 메서드 분리와 책임 할당에 강점. 자동차 경주에서 MVC 패턴을 자발적으로 적용. DB 정규화 개념을 잘 이해하고 있으며, 코드리뷰 피드백 수용 태도가 좋음. 페어 프로그래밍 시 네비게이터 역할에서 설계 방향 제시를 잘함.",
  },
  {
    nickname: "네오",
    rawData: "자동차 경주 미션 B, 사다리 타기 미션 A, 로또 미션 A+. 함수형 프로그래밍 이해도 높음. 스트림 API 활용 능숙. 테스트 커버리지 95% 이상 유지. 가끔 과도한 추상화 경향.",
    summary: "함수형 프로그래밍과 테스트에 강한 크루. 스트림 API를 능숙하게 활용하며, 테스트 커버리지를 95% 이상으로 유지하는 습관이 있음. 사다리 타기 미션에서 불변 객체 패턴을 적극 활용. 다만 때때로 과도한 추상화로 코드 복잡도가 올라가는 경향이 있어 리뷰에서 지적받은 적 있음.",
  },
  {
    nickname: "브리",
    rawData: "자동차 경주 미션 B+, 사다리 타기 미션 B, 로또 미션 B+. SQL JOIN 이해 부족. JDBC 연동에서 트랜잭션 처리 미흡. 코드리뷰 피드백 반영 속도 빠름. Git 사용 능숙.",
    summary: "꾸준한 성장세를 보이는 크루. 미션 점수는 중상위권이며, 코드리뷰 피드백을 빠르게 반영하는 장점이 있음. Git 활용이 능숙하고 커밋 메시지가 명확함. 다만 SQL JOIN과 JDBC 트랜잭션 처리에 대한 이해가 부족하여 DB 관련 과제에서 어려움을 겪었음.",
  },
  {
    nickname: "제이",
    rawData: "자동차 경주 미션 A, 사다리 타기 미션 A+, 로또 미션 A. 객체지향 설계 능력 뛰어남. SOLID 원칙 적용 우수. 코드리뷰어로서 날카로운 피드백. 리팩터링 적극적.",
    summary: "객체지향 설계의 강자. SOLID 원칙을 자연스럽게 적용하며, 리팩터링을 즐기는 크루. 사다리 타기 미션에서 전략 패턴을 활용한 설계가 리뷰어에게 좋은 평가를 받음. 코드리뷰어로 활동할 때 구체적이고 건설적인 피드백을 제공함.",
  },
  {
    nickname: "루키",
    rawData: "자동차 경주 미션 C+, 사다리 타기 미션 B-, 로또 미션 B. 비전공자 출신. 성장 속도 빠름. 초기 Java 문법 미숙했으나 빠르게 개선. 테스트 작성 습관 형성 중.",
    summary: "비전공자 출신으로 빠른 성장세를 보이는 크루. 초기에는 Java 문법이 미숙했으나 미션을 거듭하며 눈에 띄게 성장. 로또 미션부터 테스트 작성 습관이 잡히기 시작. 아직 객체지향 설계에 대한 깊은 이해는 부족하지만, 학습 의지가 강함.",
  },
  {
    nickname: "에단",
    rawData: "자동차 경주 미션 A, 사다리 타기 미션 B+, 로또 미션 A+. 예외 처리 설계 뛰어남. 커스텀 예외 활용 우수. 방어적 프로그래밍 성향. DB 과제 ERD 설계 최고 평가.",
    summary: "안정적인 코드를 작성하는 크루. 예외 처리 설계가 뛰어나며 커스텀 예외를 적절히 활용. 방어적 프로그래밍 스타일로 엣지 케이스 처리가 꼼꼼함. DB 과제에서 ERD 설계가 가장 높은 평가를 받았으며, 정규화와 반정규화의 트레이드오프를 이해하고 있음.",
  },
  {
    nickname: "하루",
    rawData: "자동차 경주 미션 B+, 사다리 타기 미션 A, 로또 미션 B. 페어 프로그래밍에서 드라이버 역할 선호. 코드 작성 속도 빠름. 리팩터링보다 기능 구현에 집중하는 경향. 함수형 스타일 선호.",
    summary: "구현 속도가 빠르고 함수형 스타일을 선호하는 크루. 페어 프로그래밍에서 드라이버 역할을 맡을 때 높은 생산성을 보임. 사다리 타기 미션에서 람다와 스트림을 활용한 깔끔한 코드로 높은 평가. 다만 기능 구현에 집중하다 리팩터링이 부족한 경우가 있어 코드 품질 개선이 필요.",
  },
  {
    nickname: "소이",
    rawData: "자동차 경주 미션 A+, 사다리 타기 미션 A, 로또 미션 A+. 테스트 코드 품질 최상위. BDD 스타일 테스트 작성. 코드리뷰에서 테스트 관련 피드백 활발. JUnit5 활용 능숙.",
    summary: "테스트 장인 크루. BDD 스타일로 테스트를 작성하며, JUnit5의 고급 기능(ParameterizedTest, Nested 등)을 능숙하게 활용. 코드리뷰에서 테스트 커버리지와 테스트 품질에 대한 피드백을 활발히 제공. 전체적으로 미션 수행 능력이 상위권.",
  },
  {
    nickname: "민트",
    rawData: "자동차 경주 미션 B, 사다리 타기 미션 B+, 로또 미션 A-. 제네릭 이해도 높음. 컬렉션 프레임워크 활용 우수. SQL 서브쿼리 작성 능력 부족. 페어 프로그래밍에서 설계 논의 적극적.",
    summary: "Java 컬렉션과 제네릭에 강한 크루. 제네릭 와일드카드를 적절히 활용하며, 컬렉션 프레임워크의 특성을 잘 이해하고 있음. 미션 점수가 꾸준히 상승세. 페어 프로그래밍에서 설계 논의에 적극적으로 참여. SQL 서브쿼리 작성에 어려움이 있어 추가 학습 필요.",
  },
  {
    nickname: "레오",
    rawData: "자동차 경주 미션 A, 사다리 타기 미션 A, 로또 미션 A. 전반적으로 균형 잡힌 실력. 코드리뷰 수용 태도 모범적. 팀 프로젝트 리더 경험. 개발 환경 세팅 능숙. IntelliJ 단축키 마스터.",
    summary: "균형 잡힌 실력을 가진 모범적인 크루. 모든 미션에서 A 이상을 유지하며, 코드리뷰 피드백을 가장 성실하게 반영. 팀 프로젝트에서 리더 역할을 맡아 일정 관리와 태스크 분배를 주도. 개발 환경에 대한 이해가 깊어 팀원들의 환경 설정을 도움.",
  },
  {
    nickname: "아론",
    rawData: "자동차 경주 미션 B-, 사다리 타기 미션 B, 로또 미션 B+. JDBC 프로그래밍 과제에서 PreparedStatement 활용 미흡. 예외 처리가 단순. 성실하지만 이해 깊이가 부족한 편.",
    summary: "성실하게 과제를 수행하지만 개념 이해의 깊이가 부족한 크루. JDBC 과제에서 PreparedStatement 대신 Statement를 사용하여 SQL Injection 위험을 지적받음. 예외 처리가 단순하여 커스텀 예외 활용이 필요. 미션 점수는 중위권이나 꾸준히 노력하는 모습.",
  },
  {
    nickname: "유진",
    rawData: "자동차 경주 미션 A+, 사다리 타기 미션 A+, 로또 미션 A+. 전 미션 최고 평가. OOP 설계 능력 탁월. 디자인 패턴 자발적 학습. 코드리뷰에서 아키텍처 수준 피드백 제공.",
    summary: "레벨1 최상위 크루. 모든 미션에서 최고 평가를 받았으며, 객체지향 설계 능력이 탁월함. 디자인 패턴을 자발적으로 학습하여 미션에 적용. 코드리뷰에서 단순 코드 수준이 아닌 아키텍처 관점의 피드백을 제공할 정도로 깊은 이해를 보유.",
  },
];

const insertProfile = db.prepare(
  "INSERT OR REPLACE INTO profiles (nickname, raw_data, summary, updated_at) VALUES (?, ?, ?, ?)"
);
for (const p of profiles) {
  insertProfile.run(p.nickname, p.rawData, p.summary, new Date().toISOString());
}

// ─── 세션 데이터 ───
const baseDate = new Date("2026-04-13T00:00:00.000Z");

function makeDate(daysAgo, hour, minute) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function makeSessionId(date) {
  const d = new Date(date);
  const dateStr = d.toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${dateStr}-${rand}`;
}

// 현실적인 대화 생성 함수
function makeConversation(nickname, topics, messageCount, modes) {
  const messages = [];
  const conversations = {
    "DB 설계": [
      { q: "정규화요? 데이터 중복을 줄이고 무결성을 보장하기 위해 테이블을 분리하는 과정입니다.", a: "그래서 1NF, 2NF, 3NF 차이가 뭔데?" },
      { q: "1NF는 원자값, 2NF는 부분 함수 종속 제거, 3NF는 이행 함수 종속 제거입니다.", a: "이행 함수 종속이 뭔지 예를 들어봐." },
      { q: "예를 들어 학생 테이블에서 학과번호가 학번에 종속되고, 학과명이 학과번호에 종속되면... 학과명이 학번에 이행적으로 종속됩니다.", a: "그걸 분리 안 하면 실제로 어떤 문제가 생기는데?" },
    ],
    "SQL": [
      { q: "JOIN은 두 테이블을 연결하는 건데요, INNER JOIN은 양쪽 다 있는 것만 가져옵니다.", a: "LEFT JOIN은? 그리고 실무에서 INNER보다 LEFT를 더 쓰는 경우는 언제야?" },
      { q: "LEFT JOIN은 왼쪽 테이블 전체를 가져오고 오른쪽에 없으면 NULL이요. 주문이 없는 고객도 보고 싶을 때 씁니다.", a: "서브쿼리 대신 JOIN을 써야 하는 경우와 그 반대는?" },
    ],
    "JDBC": [
      { q: "JDBC는 Java에서 DB에 접근하기 위한 API입니다. Connection, Statement, ResultSet을 사용합니다.", a: "PreparedStatement랑 Statement 차이가 뭐야? 왜 PreparedStatement를 써야 해?" },
      { q: "PreparedStatement는 쿼리를 미리 컴파일하고 파라미터를 바인딩합니다. SQL Injection을 방지할 수 있습니다.", a: "try-with-resources로 자원 관리는 어떻게 해?" },
    ],
    "Java 핵심": [
      { q: "컬렉션은 데이터를 저장하고 관리하는 프레임워크입니다. List, Set, Map이 대표적이에요.", a: "ArrayList와 LinkedList는 언제 각각 쓰는 게 좋아? 시간 복잡도 기준으로 말해봐." },
      { q: "ArrayList는 인덱스 접근이 O(1)이고 LinkedList는 O(n)입니다. 삽입 삭제는 LinkedList가 O(1)이고...", a: "잠깐. LinkedList 삽입이 항상 O(1)이야? 중간 삽입은?" },
    ],
    "테스트": [
      { q: "단위 테스트는 메서드 단위로 동작을 검증합니다. JUnit5의 @Test 어노테이션을 사용합니다.", a: "테스트 격리가 왜 중요한지 실제로 겪은 문제가 있어?" },
      { q: "로또 미션에서 테스트 순서에 따라 실패하는 경우가 있었습니다. static 변수 때문이었어요.", a: "그걸 어떻게 해결했어? 그리고 @BeforeEach는 언제 쓰는 게 맞아?" },
    ],
    "함수형 프로그래밍": [
      { q: "스트림은 컬렉션 데이터를 함수형으로 처리하는 API입니다. filter, map, collect 등을 체이닝합니다.", a: "스트림에서 중간 연산과 최종 연산 차이를 설명해봐. 지연 평가는 뭐야?" },
      { q: "중간 연산은 lazy하게 동작하고 최종 연산이 호출될 때 실행됩니다. filter와 map은 중간, collect는 최종입니다.", a: "Optional은 왜 쓰는 건데? null 체크랑 뭐가 다른 거야?" },
    ],
    "객체지향": [
      { q: "캡슐화는 객체의 내부 상태를 숨기고 메서드를 통해서만 접근하게 하는 것입니다.", a: "getter/setter 다 열어놓으면 캡슐화가 아닌 거 아냐? 자동차 경주에서 어떻게 했어?" },
      { q: "Car 객체에서 position을 private으로 하고 move() 메서드만 공개했습니다. getter는 출력용으로만...", a: "근데 getter로 값을 꺼내서 외부에서 비교하면 그것도 캡슐화 위반 아닌가?" },
    ],
    "리팩터링": [
      { q: "코드 스멜은 잘못된 건 아니지만 개선이 필요한 코드 패턴입니다. 긴 메서드, 중복 코드 같은 것들요.", a: "로또 미션에서 실제로 어떤 리팩터링을 했어? 구체적으로." },
      { q: "당첨 번호 매칭 로직이 50줄이었는데 메서드 추출로 5개로 나눴습니다.", a: "메서드를 나누는 기준이 뭐였어? 라인 수? 아니면 다른 기준?" },
    ],
    "페어 프로그래밍": [
      { q: "네비게이터는 전체 방향을 제시하고, 드라이버는 실제 코드를 작성합니다.", a: "페어하면서 의견 충돌이 있었을 때 어떻게 해결했어?" },
    ],
    "코드 리뷰": [
      { q: "코드리뷰에서 네이밍이랑 메서드 분리에 대한 피드백을 많이 받았습니다.", a: "피드백 중에 납득이 안 됐던 건? 그리고 그걸 어떻게 처리했어?" },
    ],
    "개발 환경": [
      { q: "Git은 버전 관리 도구고요, IntelliJ에서 주로 개발합니다. Gradle로 빌드합니다.", a: "Git에서 rebase와 merge 차이는? 언제 어떤 걸 써야 해?" },
    ],
  };

  let time = new Date(baseDate);
  time.setHours(10, 0, 0, 0);

  // 첫 메시지 (Fletcher)
  const firstMsg = `${nickname}, 앉아.\n\n오늘은 레벨1에서 뭘 배웠는지 확인하는 시간이야.\n준비됐으면 시작하자. 먼저 — DB 설계할 때 정규화가 뭔지, 그리고 왜 하는 건지 말해봐.`;
  messages.push({
    role: "assistant",
    content: firstMsg,
    timestamp: time.toISOString(),
  });

  let modeIdx = 0;
  for (let i = 0; i < Math.min(messageCount, topics.length * 3); i++) {
    const topicIdx = Math.floor(i / 3);
    const topic = topics[topicIdx % topics.length];
    const convs = conversations[topic];
    if (!convs) continue;
    const conv = convs[i % convs.length];

    // 사용자 응답
    time = new Date(time.getTime() + (8000 + Math.random() * 25000));
    const mode = modes[modeIdx % modes.length];
    messages.push({
      role: "user",
      content: conv.q,
      timestamp: time.toISOString(),
      responseTimeMs: 5000 + Math.floor(Math.random() * 20000),
      mode,
    });

    // Fletcher 응답
    time = new Date(time.getTime() + 2000 + Math.random() * 3000);
    messages.push({
      role: "assistant",
      content: conv.a,
      timestamp: time.toISOString(),
    });

    if (i % 4 === 3) modeIdx++;
  }

  return messages;
}

// 세션들 생성
const sessionsData = [
  // ── 완료된 세션들 ──
  {
    nickname: "포비",
    daysAgo: 0, hour: 9, minute: 30,
    duration: 682, completed: true,
    topics: ["DB 설계", "SQL", "Java 핵심", "객체지향", "테스트", "리팩터링"],
    msgCount: 18, modes: ["chat", "chat", "chat", "voice", "chat"],
    summary: {
      topicsDiscussed: ["DB 설계", "SQL", "Java 핵심", "객체지향", "테스트", "리팩터링"],
      deepDives: ["정규화 3단계와 실무 트레이드오프", "ArrayList vs LinkedList 시간 복잡도 분석", "캡슐화와 getter 남용 문제"],
      couldExploreMore: ["SQL 서브쿼리 활용", "스트림 API 성능 특성"],
      notMentioned: ["JDBC", "함수형 프로그래밍", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "정규화랑 객체지향은 제대로 알고 있더라. 근데 JDBC랑 함수형은 아예 안 나왔어. 다음엔 그쪽도 준비해 와."
    }
  },
  {
    nickname: "네오",
    daysAgo: 0, hour: 10, minute: 15,
    duration: 723, completed: true,
    topics: ["함수형 프로그래밍", "테스트", "Java 핵심", "리팩터링", "객체지향"],
    msgCount: 22, modes: ["chat", "voice", "chat", "code", "chat"],
    summary: {
      topicsDiscussed: ["함수형 프로그래밍", "테스트", "Java 핵심", "리팩터링", "객체지향"],
      deepDives: ["스트림 지연 평가와 중간/최종 연산", "BDD 스타일 테스트 작성법", "메서드 추출 리팩터링 기준"],
      couldExploreMore: ["Optional 활용 패턴", "SOLID 원칙 적용"],
      notMentioned: ["DB 설계", "SQL", "JDBC", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "함수형이랑 테스트는 확실히 강하더라. 근데 DB 쪽은 한마디도 못 했잖아. 균형이 필요해."
    }
  },
  {
    nickname: "제이",
    daysAgo: 0, hour: 14, minute: 0,
    duration: 710, completed: true,
    topics: ["객체지향", "리팩터링", "테스트", "DB 설계", "코드 리뷰", "Java 핵심"],
    msgCount: 20, modes: ["chat", "chat", "code", "chat", "voice"],
    summary: {
      topicsDiscussed: ["객체지향", "리팩터링", "테스트", "DB 설계", "코드 리뷰", "Java 핵심"],
      deepDives: ["SOLID 원칙과 전략 패턴 적용", "코드 스멜 식별과 메서드 추출", "코드리뷰에서의 피드백 전략"],
      couldExploreMore: ["DB 정규화 실무 적용", "Java 제네릭"],
      notMentioned: ["SQL", "JDBC", "함수형 프로그래밍", "페어 프로그래밍", "개발 환경"],
      closingMessage: "OOP 설계 감각은 확실해. 전략 패턴 적용한 거 괜찮더라. 근데 SQL이랑 JDBC는 왜 빠졌어?"
    }
  },
  {
    nickname: "소이",
    daysAgo: 1, hour: 9, minute: 0,
    duration: 695, completed: true,
    topics: ["테스트", "Java 핵심", "함수형 프로그래밍", "리팩터링", "객체지향", "DB 설계"],
    msgCount: 24, modes: ["chat", "chat", "chat", "voice", "code", "chat"],
    summary: {
      topicsDiscussed: ["테스트", "Java 핵심", "함수형 프로그래밍", "리팩터링", "객체지향", "DB 설계"],
      deepDives: ["JUnit5 ParameterizedTest와 Nested 활용", "테스트 격리와 @BeforeEach 전략", "스트림 collect와 Collectors"],
      couldExploreMore: ["DB 정규화 단계별 차이", "리팩터링 자동화 도구"],
      notMentioned: ["SQL", "JDBC", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "테스트 코드 수준은 인정한다. ParameterizedTest 활용까지 하는 건 드물어. 근데 SQL은 좀 약하더라."
    }
  },
  {
    nickname: "에단",
    daysAgo: 1, hour: 10, minute: 45,
    duration: 660, completed: true,
    topics: ["DB 설계", "SQL", "JDBC", "Java 핵심", "테스트"],
    msgCount: 16, modes: ["chat", "chat", "voice", "chat"],
    summary: {
      topicsDiscussed: ["DB 설계", "SQL", "JDBC", "Java 핵심", "테스트"],
      deepDives: ["ERD 설계와 정규화/반정규화 트레이드오프", "PreparedStatement와 SQL Injection 방지", "커스텀 예외 설계 전략"],
      couldExploreMore: ["테스트 격리 전략", "컬렉션 프레임워크 활용"],
      notMentioned: ["함수형 프로그래밍", "객체지향", "리팩터링", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "DB 쪽은 확실하더라. ERD 설계 감각이 좋아. 근데 OOP랑 리팩터링은 한마디도 없었어."
    }
  },
  {
    nickname: "레오",
    daysAgo: 1, hour: 14, minute: 30,
    duration: 718, completed: true,
    topics: ["객체지향", "Java 핵심", "테스트", "DB 설계", "SQL", "리팩터링", "개발 환경"],
    msgCount: 21, modes: ["chat", "voice", "chat", "chat", "code"],
    summary: {
      topicsDiscussed: ["객체지향", "Java 핵심", "테스트", "DB 설계", "SQL", "리팩터링", "개발 환경"],
      deepDives: ["캡슐화와 일급 컬렉션", "Git rebase vs merge 전략", "정규화와 JOIN 활용"],
      couldExploreMore: ["SOLID 원칙 심화", "함수형 프로그래밍"],
      notMentioned: ["JDBC", "함수형 프로그래밍", "페어 프로그래밍", "코드 리뷰"],
      closingMessage: "골고루 알고 있긴 한데, 깊이가 좀 아쉬워. 넓게 아는 것도 좋지만 하나를 파는 연습도 해."
    }
  },
  {
    nickname: "유진",
    daysAgo: 2, hour: 9, minute: 15,
    duration: 740, completed: true,
    topics: ["객체지향", "리팩터링", "Java 핵심", "함수형 프로그래밍", "테스트", "DB 설계", "SQL", "JDBC"],
    msgCount: 26, modes: ["chat", "code", "chat", "voice", "chat", "code"],
    summary: {
      topicsDiscussed: ["객체지향", "리팩터링", "Java 핵심", "함수형 프로그래밍", "테스트", "DB 설계", "SQL", "JDBC"],
      deepDives: ["디자인 패턴 적용과 과도한 추상화 경계", "스트림 성능과 병렬 스트림 주의점", "JDBC 트랜잭션 관리와 커넥션 풀"],
      couldExploreMore: ["코드리뷰 프로세스", "페어 프로그래밍 경험"],
      notMentioned: ["페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "전반적으로 깊이가 있더라. 특히 디자인 패턴을 적용할 때 '왜'를 아는 게 좋아. 근데 협업 쪽은 좀 더 경험해봐."
    }
  },
  {
    nickname: "하루",
    daysAgo: 2, hour: 11, minute: 0,
    duration: 635, completed: true,
    topics: ["함수형 프로그래밍", "Java 핵심", "리팩터링", "테스트"],
    msgCount: 15, modes: ["voice", "voice", "chat", "chat"],
    summary: {
      topicsDiscussed: ["함수형 프로그래밍", "Java 핵심", "리팩터링", "테스트"],
      deepDives: ["람다와 스트림 체이닝 패턴", "Optional 활용과 orElseThrow"],
      couldExploreMore: ["리팩터링 전후 비교", "테스트 설계 전략"],
      notMentioned: ["DB 설계", "SQL", "JDBC", "객체지향", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "함수형은 손에 익었더라. 근데 대화 범위가 너무 좁았어. 다음엔 DB랑 OOP도 준비해 와."
    }
  },
  {
    nickname: "민트",
    daysAgo: 2, hour: 14, minute: 15,
    duration: 688, completed: true,
    topics: ["Java 핵심", "DB 설계", "테스트", "객체지향", "함수형 프로그래밍"],
    msgCount: 19, modes: ["chat", "chat", "voice", "chat", "code"],
    summary: {
      topicsDiscussed: ["Java 핵심", "DB 설계", "테스트", "객체지향", "함수형 프로그래밍"],
      deepDives: ["제네릭 와일드카드와 타입 바운드", "컬렉션 프레임워크 내부 구조"],
      couldExploreMore: ["DB 정규화 실무 적용", "캡슐화 실천"],
      notMentioned: ["SQL", "JDBC", "리팩터링", "페어 프로그래밍", "코드 리뷰", "개발 환경"],
      closingMessage: "제네릭은 꽤 잘 알더라. 컬렉션 내부 구조까지 아는 건 좋아. SQL은 좀 더 파야 해."
    }
  },
  // ── 진행 중 세션들 ──
  {
    nickname: "브리",
    daysAgo: 0, hour: 15, minute: 30,
    duration: 340, completed: false,
    topics: ["DB 설계", "SQL", "JDBC"],
    msgCount: 8, modes: ["chat", "chat", "voice"],
    summary: null,
  },
  {
    nickname: "루키",
    daysAgo: 0, hour: 16, minute: 0,
    duration: 210, completed: false,
    topics: ["DB 설계", "Java 핵심"],
    msgCount: 6, modes: ["chat", "chat"],
    summary: null,
  },
  {
    nickname: "아론",
    daysAgo: 0, hour: 11, minute: 30,
    duration: 490, completed: false,
    topics: ["DB 설계", "SQL", "JDBC", "테스트"],
    msgCount: 12, modes: ["chat", "voice", "chat"],
    summary: null,
  },
];

const insertSession = db.prepare(`
  INSERT INTO sessions (id, interview_id, nickname, started_at, completed_at, duration_seconds, messages, events, summary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const s of sessionsData) {
  const startedAt = makeDate(s.daysAgo, s.hour, s.minute);
  const sessionId = makeSessionId(startedAt);

  const messages = makeConversation(s.nickname, s.topics, s.msgCount, s.modes);

  // 이벤트 생성 (모드 전환)
  const events = [];
  let prevMode = "chat";
  for (const msg of messages) {
    if (msg.mode && msg.mode !== prevMode) {
      events.push({
        type: "mode_change",
        timestamp: msg.timestamp,
        data: { from: prevMode, to: msg.mode },
      });
      prevMode = msg.mode;
    }
  }

  const completedAt = s.completed
    ? new Date(new Date(startedAt).getTime() + s.duration * 1000).toISOString()
    : null;

  insertSession.run(
    sessionId,
    interviewId1,
    s.nickname,
    startedAt,
    completedAt,
    s.duration,
    JSON.stringify(messages),
    JSON.stringify(events),
    s.summary ? JSON.stringify(s.summary) : null
  );
}

console.log("Seed data inserted successfully!");
console.log(`  - 2 interviews`);
console.log(`  - ${profiles.length} profiles`);
console.log(`  - ${sessionsData.length} sessions (${sessionsData.filter(s => s.completed).length} completed, ${sessionsData.filter(s => !s.completed).length} in progress)`);

db.close();
