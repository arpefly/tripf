export type SplitType = "equal" | "percentage" | "amount" | "shares";

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
}

export interface ExpenseSplit {
  participantId: string;
  amount: number;
  percentage?: number;
  shares?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: ExpenseSplit[];
  date: string;
}

export interface Group {
  id: string;
  name: string;
  participants: Participant[];
  createdAt: string;
  createdBy?: string;
}

export interface Balance {
  from: string;
  to: string;
  amount: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementPayment {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: number;
  note?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  token: string;
  code: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  usedBy?: string | null;
  usedAt?: string | null;
}

