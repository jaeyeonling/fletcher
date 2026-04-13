import Database from "better-sqlite3";
import path from "path";
import { mkdirSync } from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "fletcher.db");

mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// WAL 모드 — 동시 읽기 성능 극대화, 쓰기 직렬화
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

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

export default db;
