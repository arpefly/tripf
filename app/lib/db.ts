import Database from "better-sqlite3";
import path from "path";
import { existsSync, mkdirSync } from "fs";

const dbPath = path.join(process.cwd(), "data", "tripf.db");
const dbDir = path.dirname(dbPath);
console.log(dbDir);

// Создаем директорию для БД (если её нет)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Инициализация схемы базы данных
export function initDatabase() {
  // Таблица пользователей
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Таблица сессий
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица групп
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица участников групп
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT ('member'),
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица приглашений в группы
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_invites (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      used_by TEXT,
      used_at TEXT,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Таблица расходов
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by_user_id TEXT NOT NULL,
      split_type TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица разбивки расходов
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      percentage REAL,
      shares REAL,
      PRIMARY KEY (expense_id, user_id),
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Таблица платежей по расчётам (фиксируем факт переводов между участниками)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settlement_payments (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Индексы для оптимизации запросов
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
    CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_user ON expenses(paid_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
    CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_invites_code ON group_invites(code);
    CREATE INDEX IF NOT EXISTS idx_group_invites_token ON group_invites(token);
    CREATE INDEX IF NOT EXISTS idx_settlement_payments_group_id ON settlement_payments(group_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_payments_from_user_id ON settlement_payments(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_payments_to_user_id ON settlement_payments(to_user_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_payments_created_at ON settlement_payments(created_at);
  `);
}

// Инициализируем БД при импорте
initDatabase();

export default db;

