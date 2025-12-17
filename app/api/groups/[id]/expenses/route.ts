import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { randomUUID } from "crypto";
import type { Expense, ExpenseSplit } from "@/app/lib/types";
import { emitGroupEvent } from "@/app/lib/eventBus";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/groups/[id]/expenses - получить все расходы группы
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

    // Получаем расходы
    const expenses = db
      .prepare(`
        SELECT id, group_id as groupId, description, amount, paid_by_user_id as paidBy, 
               split_type as splitType, date
        FROM expenses
        WHERE group_id = ?
        ORDER BY date DESC
      `)
      .all(groupId) as Array<{
      id: string;
      groupId: string;
      description: string;
      amount: number;
      paidBy: string;
      splitType: string;
      date: string;
    }>;

    // Для каждого расхода получаем разбивку
    const expensesWithSplits: Expense[] = expenses.map((expense) => {
      const splits = db
        .prepare(`
          SELECT user_id as participantId, amount, percentage, shares
          FROM expense_splits
          WHERE expense_id = ?
        `)
        .all(expense.id) as ExpenseSplit[];

      return {
        id: expense.id,
        groupId: expense.groupId,
        description: expense.description,
        amount: expense.amount,
        paidBy: expense.paidBy,
        splitType: expense.splitType as Expense["splitType"],
        splits,
        date: expense.date,
      };
    });

    return NextResponse.json({ expenses: expensesWithSplits });
  } catch (error) {
    console.error("Get expenses error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении расходов" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/expenses - создать новый расход
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const body = await request.json();
    const { description, amount, paidBy, splitType, splits } = body;

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

    // Валидация
    if (!description || !amount || !paidBy || !splitType || !splits) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    // Проверяем, что paidBy является участником группы
    const participantInGroup = db
      .prepare(`
        SELECT 1 FROM group_members
        WHERE group_id = ? AND user_id = ?
      `)
      .get(groupId, paidBy);

    if (!participantInGroup) {
      return NextResponse.json(
        { error: "Участник не найден в группе" },
        { status: 400 }
      );
    }

    const expenseId = randomUUID();
    const expenseDate = new Date().toISOString();

    // Создаем транзакцию для атомарности
    const insertExpense = db.transaction(() => {
      // Создаем расход
      db.prepare(
        `INSERT INTO expenses (id, group_id, description, amount, paid_by_user_id, split_type, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(expenseId, groupId, description, amount, paidBy, splitType, expenseDate);

      // Создаем разбивку
      const insertSplit = db.prepare(`
        INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const split of splits) {
        // Проверяем, что участник в группе
        const participantExists = db
          .prepare(`
            SELECT 1 FROM group_members
            WHERE group_id = ? AND user_id = ?
          `)
          .get(groupId, split.participantId);

        if (!participantExists) {
          throw new Error(`Участник ${split.participantId} не найден в группе`);
        }

        insertSplit.run(
          expenseId,
          split.participantId,
          split.amount,
          split.percentage || null,
          split.shares || null
        );
      }
    });

    insertExpense();

    // Получаем созданный расход
    const expense = db
      .prepare(`
        SELECT id, group_id as groupId, description, amount, paid_by_user_id as paidBy, 
               split_type as splitType, date
        FROM expenses
        WHERE id = ?
      `)
      .get(expenseId) as {
      id: string;
      groupId: string;
      description: string;
      amount: number;
      paidBy: string;
      splitType: string;
      date: string;
    };

    const expenseSplits = db
      .prepare(`
        SELECT user_id as participantId, amount, percentage, shares
        FROM expense_splits
        WHERE expense_id = ?
      `)
      .all(expenseId) as ExpenseSplit[];

    emitGroupEvent(groupId, { type: "expense:created", expenseId });

    return NextResponse.json(
      {
        expense: {
          id: expense.id,
          groupId: expense.groupId,
          description: expense.description,
          amount: expense.amount,
          paidBy: expense.paidBy,
          splitType: expense.splitType as Expense["splitType"],
          splits: expenseSplits,
          date: expense.date,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Create expense error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при создании расхода" },
      { status: 500 }
    );
  }
}

