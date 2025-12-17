import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import type { Participant } from "@/app/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/groups/[id] - получить группу по ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Проверяем доступ к группе
    const group = db
      .prepare(`
        SELECT g.id, g.name, g.created_at as createdAt, g.created_by as createdBy
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `)
      .get(id, userId, userId) as
      | {
          id: string;
          name: string;
          createdAt: string;
          createdBy: string;
        }
      | undefined;

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
      .all(id) as Participant[];

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        participants,
        createdAt: group.createdAt,
        createdBy: group.createdBy,
      },
    });
  } catch (error) {
    console.error("Get group error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении группы" },
      { status: 500 }
    );
  }
}

// PUT /api/groups/[id] - обновить группу
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    // Проверяем, что пользователь является создателем группы
    const group = db
      .prepare(`SELECT created_by FROM groups WHERE id = ?`)
      .get(id) as { created_by: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    if (group.created_by !== userId) {
      return NextResponse.json(
        { error: "Нет доступа для редактирования группы" },
        { status: 403 }
      );
    }

    if (name) {
      db.prepare(`UPDATE groups SET name = ? WHERE id = ?`).run(name, id);
    }

    // Получаем обновленную группу
    const updatedGroup = db
      .prepare(
        `SELECT id, name, created_at as createdAt, created_by as createdBy FROM groups WHERE id = ?`
      )
      .get(id) as { id: string; name: string; createdAt: string; createdBy: string };

    const participants = db
      .prepare(`
        SELECT u.id, u.name, NULL as avatar
        FROM group_members gm
        INNER JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY u.name
      `)
      .all(id) as Participant[];

    return NextResponse.json({
      group: {
        id: updatedGroup.id,
        name: updatedGroup.name,
        participants,
        createdAt: updatedGroup.createdAt,
        createdBy: updatedGroup.createdBy,
      },
    });
  } catch (error) {
    console.error("Update group error:", error);
    return NextResponse.json(
      { error: "Ошибка при обновлении группы" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id] - удалить группу
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id } = await params;

    // Проверяем, что пользователь является создателем группы
    const group = db
      .prepare(`SELECT created_by FROM groups WHERE id = ?`)
      .get(id) as { created_by: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    if (group.created_by !== userId) {
      return NextResponse.json(
        { error: "Нет доступа для удаления группы" },
        { status: 403 }
      );
    }

    // Удаляем группу (каскадное удаление обработается БД)
    db.prepare(`DELETE FROM groups WHERE id = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete group error:", error);
    return NextResponse.json(
      { error: "Ошибка при удалении группы" },
      { status: 500 }
    );
  }
}

