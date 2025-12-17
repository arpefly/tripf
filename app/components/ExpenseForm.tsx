"use client";

import { useState } from "react";
import type { Participant, SplitType } from "@/app/lib/types";

export interface ExpenseFormValues {
  description: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: { participantId: string; amount: number }[];
  date?: string;
}

interface ExpenseFormProps {
  participants: Participant[];
  onSubmit: (expense: ExpenseFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialExpense?: ExpenseFormValues;
  submitLabel?: string;
}

const formatDateForInput = (isoDate?: string) => {
  if (!isoDate) {
    return "";
  }
  const date = new Date(isoDate);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function ExpenseForm({
  participants,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialExpense,
  submitLabel = "Добавить",
}: ExpenseFormProps) {
  const [description, setDescription] = useState(initialExpense?.description ?? "");
  const [amount, setAmount] = useState(
    initialExpense ? initialExpense.amount.toString() : ""
  );
  const [paidBy, setPaidBy] = useState(initialExpense?.paidBy ?? participants[0]?.id ?? "");
  const [splitType, setSplitType] = useState<SplitType>(
    initialExpense?.splitType ?? "equal"
  );
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    initialExpense?.splits?.map((split) => split.participantId) ??
      participants.map((p) => p.id)
  );
  const [dateValue, setDateValue] = useState(() =>
    formatDateForInput(initialExpense?.date ?? new Date().toISOString())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (!description || !amountNum || amountNum <= 0 || !paidBy) {
      return;
    }

    if (selectedParticipants.length === 0) {
      return;
    }

    let splits: { participantId: string; amount: number }[] = [];

    if (splitType === "equal") {
      const count = selectedParticipants.length;
      const amountInCents = Math.round(amountNum * 100);
      const baseAmountInCents = Math.floor(amountInCents / count);
      const remainderCents = amountInCents % count;

      splits = selectedParticipants.map((pid, index) => ({
        participantId: pid,
        amount: (baseAmountInCents + (index < remainderCents ? 1 : 0)) / 100,
      }));
    } else {
      // TODO додлеать остальные типы разделения
      const perPerson = amountNum / selectedParticipants.length;
      splits = selectedParticipants.map((pid) => ({
        participantId: pid,
        amount: Math.round((perPerson * 100) / 100),
      }));
    }

    onSubmit({
      description,
      amount: amountNum,
      paidBy,
      splitType,
      splits,
      date: dateValue ? new Date(dateValue).toISOString() : undefined,
    });
  };

  const toggleParticipant = (participantId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Дата
        </label>
        <input
          type="datetime-local"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Описание
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Сумма (₽)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Оплатил
        </label>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          required
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Способ разделения
        </label>
        <select
          value={splitType}
          onChange={(e) => setSplitType(e.target.value as SplitType)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="equal">Поровну</option>
          <option value="percentage">По процентам</option>
          <option value="amount">По сумме</option>
          <option value="shares">По долям</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Участники
        </label>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleParticipant(p.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedParticipants.includes(p.id)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

