import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import type { Expense, ExpenseSplit } from "@/app/lib/types";
import { emitGroupEvent } from "@/app/lib/eventBus";

interface RouteParams {
  params: Promise<{ id: string; expenseId: string }>;
}

// PUT /api/groups/[id]/expenses/[expenseId] - обновить расход
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId, expenseId } = await params;
    const body = await request.json();
    const { description, amount, paidBy, splitType, splits, date } = body;

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

    // Проверяем, что расход существует
    const expense = db
      .prepare(`SELECT id FROM expenses WHERE id = ? AND group_id = ?`)
      .get(expenseId, groupId);

    if (!expense) {
      return NextResponse.json({ error: "Расход не найден" }, { status: 404 });
    }

    // Базовая валидация
    if (
      !description ||
      typeof amount !== "number" ||
      !paidBy ||
      !splitType ||
      !Array.isArray(splits) ||
      splits.length === 0
    ) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      );
    }

    // Проверяем, что payer является участником группы
    const participantInGroup = db
      .prepare(
        `
        SELECT 1 FROM group_members
        WHERE group_id = ? AND user_id = ?
      `
      )
      .get(groupId, paidBy);

    if (!participantInGroup) {
      return NextResponse.json(
        { error: "Участник не найден в группе" },
        { status: 400 }
      );
    }

    const expenseDate = date || new Date().toISOString();

    // Обновляем расход и его разбивку
    const updateExpense = db.transaction(() => {
      db.prepare(
        `UPDATE expenses 
         SET description = ?, amount = ?, paid_by_user_id = ?, split_type = ?, date = ?
         WHERE id = ?`
      ).run(description, amount, paidBy, splitType, expenseDate, expenseId);

      db.prepare(`DELETE FROM expense_splits WHERE expense_id = ?`).run(
        expenseId
      );

      const insertSplit = db.prepare(`
        INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const split of splits) {
        const participantExists = db
          .prepare(
            `
            SELECT 1 FROM group_members
            WHERE group_id = ? AND user_id = ?
          `
          )
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

    updateExpense();

    // Получаем обновленный расход
    const updatedExpense = db
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

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/expenses`);

    emitGroupEvent(groupId, { type: "expense:updated", expenseId });

    return NextResponse.json({
      expense: {
        id: updatedExpense.id,
        groupId: updatedExpense.groupId,
        description: updatedExpense.description,
        amount: updatedExpense.amount,
        paidBy: updatedExpense.paidBy,
        splitType: updatedExpense.splitType as Expense["splitType"],
        splits: expenseSplits,
        date: updatedExpense.date,
      },
    });
  } catch (error: unknown) {
    console.error("Update expense error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при обновлении расхода" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/expenses/[expenseId] - удалить расход
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId, expenseId } = await params;

    // Проверяем доступ к группе
    const group = db
      .prepare(`
        SELECT g.id, g.created_by as createdBy
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `)
      .get(groupId, userId, userId) as { id: string; createdBy: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // Проверяем, что расход существует
    const expense = db
      .prepare(
        `SELECT id, paid_by_user_id as paidBy FROM expenses WHERE id = ? AND group_id = ?`
      )
      .get(expenseId, groupId) as { id: string; paidBy: string } | undefined;

    if (!expense) {
      return NextResponse.json({ error: "Расход не найден" }, { status: 404 });
    }

    // Право на удаление: создатель группы или автор расхода (payer)
    const canDelete =
      group.createdBy === userId || (expense?.paidBy && expense.paidBy === userId);

    if (!canDelete) {
      return NextResponse.json(
        { error: "Нет прав на удаление расхода" },
        { status: 403 }
      );
    }

    // Удаляем расход
    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(expenseId);

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/expenses`);

    emitGroupEvent(groupId, { type: "expense:deleted", expenseId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete expense error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при удалении расхода" },
      { status: 500 }
    );
  }
}

