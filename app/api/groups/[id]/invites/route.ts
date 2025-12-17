import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import {
  createGroupInvite,
  getActiveInvitesForGroup,
  DEFAULT_INVITE_TTL_HOURS,
} from "@/app/lib/invites";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function hasGroupAccess(groupId: string, userId: string) {
  const record = db
    .prepare(
      `
      SELECT g.id, g.created_by
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ?
        AND (g.created_by = ? OR gm.user_id = ?)
    `
    )
    .get(groupId, userId, userId) as { id: string; created_by: string } | undefined;

  return record;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    if (!hasGroupAccess(groupId, userId)) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const invites = getActiveInvitesForGroup(groupId);
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Get group invites error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении приглашений" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const group = hasGroupAccess(groupId, userId);
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }
    
    if (group.created_by !== userId) {
      return NextResponse.json(
        { error: "Только создатель группы может создавать приглашения" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let expiresInHours = Number(body?.expiresInHours ?? DEFAULT_INVITE_TTL_HOURS);
    if (Number.isNaN(expiresInHours) || expiresInHours <= 0) {
      expiresInHours = DEFAULT_INVITE_TTL_HOURS;
    }
    expiresInHours = Math.min(expiresInHours, 24 * 14);

    const invite = createGroupInvite(groupId, userId, expiresInHours);

    return NextResponse.json(
      { invite },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("Create group invite error:", error);
    return NextResponse.json(
      { error: "Ошибка при создании приглашения" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const group = hasGroupAccess(groupId, userId);
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    if (group.created_by !== userId) {
      return NextResponse.json(
        { error: "Только создатель группы может удалять приглашения" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId обязателен" },
        { status: 400 }
      );
    }

    const inviteExists = db
      .prepare(
        `SELECT id FROM group_invites WHERE id = ? AND group_id = ?`
      )
      .get(inviteId, groupId);

    if (!inviteExists) {
      return NextResponse.json(
        { error: "Приглашение не найдено" },
        { status: 404 }
      );
    }

    db.prepare(`DELETE FROM group_invites WHERE id = ?`).run(inviteId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete group invite error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении приглашения" },
      { status: 500 }
    );
  }
}

