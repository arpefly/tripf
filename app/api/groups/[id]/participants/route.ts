import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import type { Participant } from "@/app/lib/types";
import { emitGroupEvent } from "@/app/lib/eventBus";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/groups/[id]/participants - получить всех участников группы
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Проверяем доступ к группе
    const group = db
      .prepare(`
        SELECT g.id
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `)
      .get(groupId, userId, userId);

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // Получаем участников
    const participants = db
      .prepare(`
        SELECT u.id, u.name, NULL as avatar
        FROM group_members gm
        INNER JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY u.name
      `)
      .all(groupId) as Participant[];

    return NextResponse.json({ participants });
  } catch (error) {
    console.error("Get participants error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении участников" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/participants - добавить участника в группу
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json();
    const { userId: targetUserId } = body;

    // Проверяем доступ к группе
    const group = db
      .prepare(`
        SELECT g.id, g.created_by
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `)
      .get(groupId, userId, userId) as { id: string; created_by: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId обязателен для добавления участника" },
        { status: 400 }
      );
    }

    // Проверяем, существует ли пользователь
    const targetUser = db
      .prepare(`SELECT id FROM users WHERE id = ?`)
      .get(targetUserId) as { id: string } | undefined;

    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Проверяем, не добавлен ли уже участник в группу
    const existing = db
      .prepare(
        `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .get(groupId, targetUserId);

    if (existing) {
      return NextResponse.json(
        { error: "Участник уже добавлен в группу" },
        { status: 409 }
      );
    }

    // Добавляем участника в группу
    db.prepare(
      `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`
    ).run(groupId, targetUserId);

    // Получаем добавленного участника
    const participant = db
      .prepare(`SELECT id, name FROM users WHERE id = ?`)
      .get(targetUserId) as Participant;

    emitGroupEvent(groupId, { type: "participant:added", participantId: participant.id });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error: unknown) {
    console.error("Add participant error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при добавлении участника" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/participants - удалить участника из группы
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get("participantId");

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId обязателен" },
        { status: 400 }
      );
    }

    // Проверяем доступ к группе
    const group = db
      .prepare(`
        SELECT g.id, g.created_by
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `)
      .get(groupId, userId, userId) as { id: string; created_by: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const participantUser = db
      .prepare(`SELECT id FROM users WHERE id = ?`)
      .get(participantId) as { id: string } | undefined;

    if (!participantUser) {
      return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
    }

    // Проверяем, что участник в группе
    const participantInGroup = db
      .prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`)
      .get(groupId, participantId);

    if (!participantInGroup) {
      return NextResponse.json(
        { error: "Участник не найден в группе" },
        { status: 404 }
      );
    }

    const isGroupOwner = participantId === group.created_by;

    if (isGroupOwner) {
      if (userId !== group.created_by) {
        return NextResponse.json(
          { error: "Только создатель может удалить себя из группы" },
          { status: 403 }
        );
      }

      const participantCount = db
        .prepare(`SELECT COUNT(*) as count FROM group_members WHERE group_id = ?`)
        .get(groupId) as { count: number };

      if (participantCount.count > 1) {
        return NextResponse.json(
          { error: "Создатель не может покинуть группу, пока в ней есть другие участники" },
          { status: 400 }
        );
      }

      db.prepare(`DELETE FROM groups WHERE id = ?`).run(groupId);

      emitGroupEvent(groupId, { type: "group:deleted" });

      return NextResponse.json({ success: true, groupDeleted: true });
    }

    // Удаляем участника из группы
    db.prepare(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`).run(
      groupId,
      participantId
    );

    emitGroupEvent(groupId, { type: "participant:removed", participantId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove participant error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении участника" },
      { status: 500 }
    );
  }
}

