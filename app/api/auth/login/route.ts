import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/app/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email и password обязательны" },
        { status: 400 }
      );
    }

    // Находим пользователя
    const user = db
      .prepare(`SELECT id, email, password_hash, name FROM users WHERE email = ?`)
      .get(email) as
      | { id: string; email: string; password_hash: string; name: string }
      | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Проверяем пароль
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    // Создаем сессию
    const sessionId = createSession(user.id);
    await setSessionCookie(sessionId);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при входе" },
      { status: 500 }
    );
  }
}

