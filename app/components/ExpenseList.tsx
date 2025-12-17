import Link from "next/link";
import type { Expense, Participant } from "@/app/lib/types";

interface ExpenseListProps {
  expenses: Expense[];
  participants: Participant[];
  currentUserId?: string | null;
  groupCreatorId?: string;
  onDelete?: (expenseId: string) => void;
  deletingExpenseId?: string | null;
  feedback?: { type: "error" | "success"; message: string } | null;
}

export default function ExpenseList({
  expenses,
  participants,
  currentUserId,
  groupCreatorId,
  onDelete,
  deletingExpenseId,
  feedback,
}: ExpenseListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Расходы
      </h3>
      {feedback && (
        <div
          className={`mb-3 text-sm ${
            feedback.type === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-green-600 dark:text-green-400"
          }`}
        >
          {feedback.message}
        </div>
      )}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            Пока нет расходов
          </p>
        ) : (
          expenses.map((expense) => {
            const paidBy = participants.find((p) => p.id === expense.paidBy);
            const canDelete =
              currentUserId &&
              (currentUserId === expense.paidBy || currentUserId === groupCreatorId);
            return (
              <div
                key={expense.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {expense.description}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Оплатил: {paidBy?.name || "Неизвестно"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {expense.amount.toLocaleString("ru-RU")} ₽
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(expense.date)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Разделено между:{" "}
                    {expense.splits
                      .map((split) => {
                        const participant = participants.find(
                          (p) => p.id === split.participantId
                        );
                        return `${participant?.name || "Неизвестно"} (${split.amount.toLocaleString(
                          "ru-RU"
                        )} ₽)`;
                      })
                      .join(", ")}
                  </p>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/groups/${expense.groupId}/expenses/${expense.id}/edit`}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Редактировать
                    </Link>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(expense.id)}
                        disabled={deletingExpenseId === expense.id}
                        className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                      >
                        {deletingExpenseId === expense.id ? "Удаляем..." : "Удалить"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

