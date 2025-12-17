import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { emitGroupEvent } from "@/app/lib/eventBus";
import { computeNetBalances } from "@/app/lib/calculations";
import type { Expense, ExpenseSplit, Participant, SettlementPayment } from "@/app/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function hasGroupAccess(groupId: string, userId: string) {
  return db
    .prepare(
      `
      SELECT g.id, g.created_by as createdBy
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
    `
    )
    .get(groupId, userId, userId) as { id: string; createdBy: string } | undefined;
}

function getParticipants(groupId: string): Participant[] {
  return db
    .prepare(
      `
      SELECT u.id, u.name, NULL as avatar
      FROM group_members gm
      INNER JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY u.name
    `
    )
    .all(groupId) as Participant[];
}

function getExpenses(groupId: string): Expense[] {
  const expenses = db
    .prepare(
      `
      SELECT id, group_id as groupId, description, amount, paid_by_user_id as paidBy,
             split_type as splitType, date
      FROM expenses
      WHERE group_id = ?
      ORDER BY date DESC
    `
    )
    .all(groupId) as Array<{
    id: string;
    groupId: string;
    description: string;
    amount: number;
    paidBy: string;
    splitType: string;
    date: string;
  }>;

  return expenses.map((expense) => {
    const splits = db
      .prepare(
        `
        SELECT user_id as participantId, amount, percentage, shares
        FROM expense_splits
        WHERE expense_id = ?
      `
      )
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
}

function getPayments(groupId: string): SettlementPayment[] {
  const rows = db
    .prepare(
      `
      SELECT id,
             group_id as groupId,
             from_user_id as "from",
             to_user_id as "to",
             amount,
             note,
             created_by as createdBy,
             created_at as createdAt
      FROM settlement_payments
      WHERE group_id = ?
      ORDER BY created_at DESC
    `
    )
    .all(groupId) as SettlementPayment[];

  return rows;
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

    const payments = getPayments(groupId);
    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Get payments error:", error);
    return NextResponse.json(
      { error: "Ошибка при получении платежей" },
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
    if (!hasGroupAccess(groupId, userId)) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const from = String(body?.from ?? "");
    const to = String(body?.to ?? "");
    const amount = Number(body?.amount);
    const note =
      body?.note === undefined || body?.note === null ? null : String(body.note);

    if (!from || !to) {
      return NextResponse.json(
        { error: "Отправитель и получатель обязательны" },
        { status: 400 }
      );
    }

    if (from === to) {
      return NextResponse.json(
        { error: "Отправитель и получатель должны быть разными" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Сумма должна быть числом больше 0" },
        { status: 400 }
      );
    }

    const participantFrom = db
      .prepare(
        `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .get(groupId, from);
    const participantTo = db
      .prepare(
        `SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`
      )
      .get(groupId, to);

    if (!participantFrom || !participantTo) {
      return NextResponse.json(
        { error: "Участники должны быть в группе" },
        { status: 400 }
      );
    }

    // Ограничение на переплату: считаем текущие netBalances и не даём перевернуть баланс.
    const participants = getParticipants(groupId);
    const expenses = getExpenses(groupId);
    const existingPayments = getPayments(groupId);
    const netBalances = computeNetBalances(expenses, participants, existingPayments);

    const netFrom = netBalances.get(from) ?? 0;
    const netTo = netBalances.get(to) ?? 0;

    if (!(netFrom < -0.01)) {
      return NextResponse.json(
        { error: "Отправитель сейчас не должен денег" },
        { status: 400 }
      );
    }

    if (!(netTo > 0.01)) {
      return NextResponse.json(
        { error: "Получатель сейчас не должен получать деньги" },
        { status: 400 }
      );
    }

    const maxAmount = Math.min(Math.abs(netFrom), netTo);
    if (amount > maxAmount + 0.01) {
      return NextResponse.json(
        { error: `Сумма слишком большая. Максимум: ${maxAmount.toFixed(2)}` },
        { status: 400 }
      );
    }

    const paymentId = randomUUID();
    db.prepare(
      `
      INSERT INTO settlement_payments
        (id, group_id, from_user_id, to_user_id, amount, note, created_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(paymentId, groupId, from, to, amount, note, userId);

    const payment = db
      .prepare(
        `
        SELECT id,
               group_id as groupId,
               from_user_id as "from",
               to_user_id as "to",
               amount,
               note,
               created_by as createdBy,
               created_at as createdAt
        FROM settlement_payments
        WHERE id = ?
      `
      )
      .get(paymentId) as SettlementPayment;

    emitGroupEvent(groupId, { type: "payment:created", paymentId });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при создании платежа" },
      { status: 500 }
    );
  }
}







