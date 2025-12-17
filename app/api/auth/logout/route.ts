import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, clearSessionCookie } from "@/app/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("tripf_session")?.value;

    if (sessionId) {
      deleteSession(sessionId);
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при выходе" },
      { status: 500 }
    );
  }
}

