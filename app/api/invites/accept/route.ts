import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { getInviteByCode, getInviteByToken } from "@/app/lib/invites";

function nowForStorage() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : undefined;
    const code =
      typeof body.code === "string" ? body.code.trim().toUpperCase() : undefined;

    if (!token && !code) {
      return NextResponse.json(
        { error: "Не указан код или ссылка приглашения" },
        { status: 400 }
      );
    }

    const invite = token ? getInviteByToken(token) : getInviteByCode(code!);

    if (!invite) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    if (invite.usedAt) {
      return NextResponse.json(
        { error: "Приглашение уже было использовано" },
        { status: 410 }
      );
    }

    if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: "Срок действия приглашения истек" },
        { status: 410 }
      );
    }

    const alreadyMember = db
      .prepare(
        `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .get(invite.groupId, userId);

    if (!alreadyMember) {
      db.prepare(
        `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`
      ).run(invite.groupId, userId);
    }

    const usedAt = nowForStorage();
    db.prepare(`UPDATE group_invites SET used_by = ?, used_at = ? WHERE id = ?`).run(
      userId,
      usedAt,
      invite.id
    );

    return NextResponse.json({
      success: true,
      groupId: invite.groupId,
      groupName: invite.groupName,
      alreadyMember: Boolean(alreadyMember),
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: "Не удалось присоединиться к группе" },
      { status: 500 }
    );
  }
}

