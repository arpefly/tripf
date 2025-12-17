import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении пользователя" },
      { status: 500 }
    );
  }
}
