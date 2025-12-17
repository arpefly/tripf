import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { randomUUID } from "crypto";
import type { Group, Participant } from "@/app/lib/types";

// GET /api/groups - получить все группы текущего пользователя
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    // Получаем группы, созданные пользователем или где он является участником
    const groups = db
      .prepare(`
        SELECT DISTINCT g.id, g.name, g.created_at as createdAt, g.created_by as createdBy
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.created_by = ? OR gm.user_id = ?
        ORDER BY g.created_at DESC
      `)
      .all(userId, userId) as Array<{
      id: string;
      name: string;
      createdAt: string;
      createdBy: string;
    }>;

    // Для каждой группы получаем участников
    const groupsWithParticipants: Group[] = await Promise.all(
      groups.map(async (group) => {
        const participants = db
          .prepare(`
            SELECT u.id, u.name, NULL as avatar
            FROM group_members gm
            INNER JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY u.name
          `)
          .all(group.id) as Participant[];

        return {
          id: group.id,
          name: group.name,
          participants,
          createdAt: group.createdAt,
          createdBy: group.createdBy,
        };
      })
    );

    return NextResponse.json({ groups: groupsWithParticipants });
  } catch (error) {
    console.error("Get groups error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении групп" },
      { status: 500 }
    );
  }
}

// POST /api/groups - создать новую группу
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const body = await request.json();
    const { name, participantIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Название группы обязательно" },
        { status: 400 }
      );
    }

    const groupId = randomUUID();

    // Создаем группу
    db.prepare(
      `INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)`
    ).run(groupId, name, userId);

    // Добавляем участников, если они указаны (ожидаем userId)
    if (participantIds && Array.isArray(participantIds) && participantIds.length > 0) {
      const insertMember = db.prepare(
        `INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`
      );

      const insertMany = db.transaction((ids: string[]) => {
        for (const participantId of ids) {
          insertMember.run(groupId, participantId);
        }
      });

      insertMany(participantIds);
    }

    // Добавляем создателя как участника
    db.prepare(
      `INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')`
    ).run(groupId, userId);

    // Получаем созданную группу с участниками
    const group = db
      .prepare(
        `SELECT id, name, created_at as createdAt, created_by as createdBy FROM groups WHERE id = ?`
      )
      .get(groupId) as {
        id: string;
        name: string;
        createdAt: string;
        createdBy: string;
      };

    const participants = db
      .prepare(`
        SELECT u.id, u.name, NULL as avatar
        FROM group_members gm
        INNER JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ?
        ORDER BY u.name
      `)
      .all(groupId) as Participant[];

    return NextResponse.json(
      {
        group: {
          id: group.id,
          name: group.name,
          participants,
          createdAt: group.createdAt,
          createdBy: group.createdBy,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Ошибка при создании группы" },
      { status: 500 }
    );
  }
}

