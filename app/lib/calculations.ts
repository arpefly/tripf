import type { Expense, Balance, Settlement, Participant, SettlementPayment } from "./types";

interface NetBalance {
  participantId: string;
  netAmount: number;
}

export function computeNetBalances(
  expenses: Expense[],
  participants: Participant[],
  payments: SettlementPayment[] = []
): Map<string, number> {
  const netBalances = new Map<string, number>();

  participants.forEach((p) => {
    netBalances.set(p.id, 0);
  });

  // Базовый вклад из расходов
  expenses.forEach((expense) => {
    const paidBy = expense.paidBy;
    const currentPaid = netBalances.get(paidBy) || 0;
    netBalances.set(paidBy, currentPaid + expense.amount);

    expense.splits.forEach((split) => {
      const currentOwed = netBalances.get(split.participantId) || 0;
      netBalances.set(split.participantId, currentOwed - split.amount);
    });
  });

  // Применяем платежи: перевод уменьшает долг from и уменьшает кредит to
  payments.forEach((payment) => {
    const from = payment.from;
    const to = payment.to;
    if (!netBalances.has(from) || !netBalances.has(to)) {
      return;
    }
    const amount = payment.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    netBalances.set(from, (netBalances.get(from) || 0) + amount);
    netBalances.set(to, (netBalances.get(to) || 0) - amount);
  });

  return netBalances;
}

export function calculateBalances(
  expenses: Expense[],
  participants: Participant[]
): Balance[] {
  const netBalances = computeNetBalances(expenses, participants);

  // Конвертация балансов в пары (кто должен кому)
  const balances: Balance[] = [];
  const netBalancesArray: NetBalance[] = Array.from(netBalances.entries())
    .map(([participantId, netAmount]) => ({
      participantId,
      netAmount: Math.round(netAmount * 100) / 100,
    }))
    .filter((nb) => Math.abs(nb.netAmount) > 0.01);

  // Находим кто получает кто платит
  const creditors = netBalancesArray.filter((nb) => nb.netAmount > 0);
  const debtors = netBalancesArray.filter((nb) => nb.netAmount < 0);

  // Создаём таблицу расчётоы
  debtors.forEach((debtor) => {
    creditors.forEach((creditor) => {
      const amount = Math.min(Math.abs(debtor.netAmount), creditor.netAmount);
      if (amount > 0.001) {
        balances.push({
          from: debtor.participantId,
          to: creditor.participantId,
          amount: Math.round(amount * 100) / 100,
        });

        debtor.netAmount += amount;
        creditor.netAmount -= amount;
      }
    });
  });

  return balances;
}

export function optimizeSettlements(
  expenses: Expense[],
  participants: Participant[],
  payments: SettlementPayment[] = []
): Settlement[] {
  // Считаем netBalances с учётом платежей
  const netBalances = computeNetBalances(expenses, participants, payments);

  const creditors: NetBalance[] = [];
  const debtors: NetBalance[] = [];

  netBalances.forEach((netAmount, participantId) => {
    const rounded = Math.round(netAmount * 100) / 100;
    if (Math.abs(rounded) > 0.01) {
      if (rounded > 0) {
        creditors.push({ participantId, netAmount: rounded });
      } else {
        debtors.push({ participantId, netAmount: Math.abs(rounded) });
      }
    }
  });

  creditors.sort((a, b) => b.netAmount - a.netAmount);
  debtors.sort((a, b) => b.netAmount - a.netAmount);

  const settlements: Settlement[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    const settlementAmount = Math.min(creditor.netAmount, debtor.netAmount);

    if (settlementAmount > 0.01) {
      settlements.push({
        from: debtor.participantId,
        to: creditor.participantId,
        amount: Math.round(settlementAmount * 100) / 100,
      });

      creditor.netAmount -= settlementAmount;
      debtor.netAmount -= settlementAmount;

      if (creditor.netAmount < 0.01) {
        creditorIndex++;
      }
      if (debtor.netAmount < 0.01) {
        debtorIndex++;
      }
    } else {
      break;
    }
  }

  return settlements;
}

export function getTotalExpenses(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function getParticipantTotalPaid(
  expenses: Expense[],
  participantId: string
): number {
  return expenses
    .filter((e) => e.paidBy === participantId)
    .reduce((sum, expense) => sum + expense.amount, 0);
}

export function getParticipantTotalOwed(
  expenses: Expense[],
  participantId: string
): number {
  return expenses.reduce((sum, expense) => {
    const split = expense.splits.find((s) => s.participantId === participantId);
    return sum + (split?.amount || 0);
  }, 0);
}

