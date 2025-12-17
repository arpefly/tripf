import Link from "next/link";
import type { Group } from "@/app/lib/types";
import { getTotalExpenses } from "@/app/lib/calculations";
import type { Expense } from "@/app/lib/types";

interface GroupCardProps {
  group: Group;
  expenses?: Expense[];
}

export default function GroupCard({ group, expenses = [] }: GroupCardProps) {
  const total = getTotalExpenses(expenses);

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 mb-4"
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {group.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {group.participants.length} участник
            {group.participants.length > 1 && group.participants.length < 5
              ? "а"
              : "ов"}
            {" • "}
            {expenses.length} расход
            {expenses.length > 1 && expenses.length < 5 ? "а" : "ов"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {total.toLocaleString("ru-RU")} ₽
          </p>
        </div>
      </div>
    </Link>
  );
}

