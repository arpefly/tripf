import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import db from "./db";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME = "tripf_session";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 дней

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

// Хеширование пароля
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Проверка пароля
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Создание сессии
export function createSession(userId: string): string {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION*1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(sessionId, userId, expiresAt);

  return sessionId;
}

// Получение сессии
export function getSession(sessionId: string): Session | null {
  const session = db
    .prepare(`SELECT id, user_id as userId, expires_at as expiresAt FROM sessions WHERE id = ? AND expires_at > datetime('now')`)
    .get(sessionId) as Session | undefined;

  return session || null;
}

// Удаление сессии
export function deleteSession(sessionId: string): void {
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

// Получение текущего пользователя из cookies
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const user = db
    .prepare(`SELECT id, email, name, created_at as createdAt FROM users WHERE id = ?`)
    .get(session.userId) as User | undefined;

  return user || null;
}

// Получение ID текущего пользователя
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

// Установка cookie сессии
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

// Удаление cookie сессии
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

