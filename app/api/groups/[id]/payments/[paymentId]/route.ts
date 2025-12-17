import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { emitGroupEvent } from "@/app/lib/eventBus";

interface RouteParams {
  params: Promise<{ id: string; paymentId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { id: groupId, paymentId } = await params;

    // Проверяем доступ к группе + получаем владельца группы
    const group = db
      .prepare(
        `
        SELECT g.id, g.created_by as createdBy
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
      `
      )
      .get(groupId, userId, userId) as { id: string; createdBy: string } | undefined;

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const payment = db
      .prepare(
        `
        SELECT id, created_by as createdBy
        FROM settlement_payments
        WHERE id = ? AND group_id = ?
      `
      )
      .get(paymentId, groupId) as { id: string; createdBy: string } | undefined;

    if (!payment) {
      return NextResponse.json({ error: "Платёж не найден" }, { status: 404 });
    }

    const canDelete = payment.createdBy === userId || group.createdBy === userId;
    if (!canDelete) {
      return NextResponse.json(
        { error: "Нет прав на отмену платежа" },
        { status: 403 }
      );
    }

    db.prepare(`DELETE FROM settlement_payments WHERE id = ?`).run(paymentId);

    emitGroupEvent(groupId, { type: "payment:deleted", paymentId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete payment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка при удалении платежа" },
      { status: 500 }
    );
  }
}







