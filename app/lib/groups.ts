import db from "./db";
import { getCurrentUserId } from "./auth";
import type { Group, Participant, Expense } from "./types";

export async function getGroupsForUser(): Promise<Group[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

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

  const groupsWithParticipants: Group[] = groups.map((group) => {
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
  });

  return groupsWithParticipants;
}

export async function getGroupById(id: string): Promise<Group | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

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
    return null;
  }

  const participants = db
    .prepare(`
      SELECT u.id, u.name, NULL as avatar
      FROM group_members gm
      INNER JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY u.name
    `)
    .all(id) as Participant[];

  return {
    id: group.id,
    name: group.name,
    participants,
    createdAt: group.createdAt,
    createdBy: group.createdBy,
  };
}

export async function getExpensesForGroup(groupId: string): Promise<Expense[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

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
    return [];
  }

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

  const expensesWithSplits: Expense[] = expenses.map((expense) => {
    const splits = db
      .prepare(`
        SELECT user_id as participantId, amount, percentage, shares
        FROM expense_splits
        WHERE expense_id = ?
      `)
      .all(expense.id) as Expense["splits"];

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

  return expensesWithSplits;
}

export async function getExpenseById(
  groupId: string,
  expenseId: string
): Promise<Expense | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const group = db
    .prepare(`
      SELECT g.id
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
    `)
    .get(groupId, userId, userId);

  if (!group) {
    return null;
  }

  const expense = db
    .prepare(`
      SELECT id, group_id as groupId, description, amount, paid_by_user_id as paidBy, 
             split_type as splitType, date
      FROM expenses
      WHERE group_id = ? AND id = ?
    `)
    .get(groupId, expenseId) as
    | {
        id: string;
        groupId: string;
        description: string;
        amount: number;
        paidBy: string;
        splitType: string;
        date: string;
      }
    | undefined;

  if (!expense) {
    return null;
  }

  const splits = db
    .prepare(`
      SELECT user_id as participantId, amount, percentage, shares
      FROM expense_splits
      WHERE expense_id = ?
    `)
    .all(expenseId) as Expense["splits"];

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
}

