import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/app/lib/auth";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password и name обязательны" },
        { status: 400 }
      );
    }

    // Проверяем, существует ли пользователь
    const existingUser = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    // Создаем пользователя
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`
    ).run(userId, email, passwordHash, name);

    // Создаем сессию
    const sessionId = createSession(userId);
    await setSessionCookie(sessionId);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: userId,
          email,
          name,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при регистрации" },
      { status: 500 }
    );
  }
}
