"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ExpenseForm, { type ExpenseFormValues } from "@/app/components/ExpenseForm";
import type { Group, Expense } from "@/app/lib/types";

interface EditExpenseClientProps {
  group: Group;
  expense: Expense;
}

export default function EditExpenseClient({ group, expense }: EditExpenseClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formValues: ExpenseFormValues) => {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/groups/${group.id}/expenses/${expense.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formValues),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Не удалось обновить расход");
        setIsSubmitting(false);
        return;
      }

      router.push(`/groups/${group.id}`);
      router.refresh();
    } catch {
      setError("Не удалось обновить расход");
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/groups/${group.id}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/groups/${group.id}`}
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Назад к группе
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Редактирование расхода
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{group.name}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <ExpenseForm
            participants={group.participants}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            submitLabel="Сохранить"
            initialExpense={{
              description: expense.description,
              amount: expense.amount,
              paidBy: expense.paidBy,
              splitType: expense.splitType,
              splits: expense.splits.map((split) => ({
                participantId: split.participantId,
                amount: split.amount,
              })),
              date: expense.date,
            }}
          />
        </div>
      </div>
    </main>
  );
}



