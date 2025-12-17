"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ExpenseForm, { type ExpenseFormValues } from "@/app/components/ExpenseForm";
import type { Group } from "@/app/lib/types";
import AuthGuard from "@/app/components/AuthGuard";

export default function NewExpensePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchGroup() {
      try {
        const response = await fetch(`/api/groups/${groupId}`);
        if (!response.ok) {
          setError("Группа не найдена");
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        setGroup(data.group);
      } catch (error: unknown) {
        console.error("Error fetching group:", error);
        setError("Ошибка при загрузке группы");
      } finally {
        setIsLoading(false);
      }
    }
    fetchGroup();
  }, [groupId]);

  const handleSubmit = async (expenseData: ExpenseFormValues) => {
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Ошибка при создании расхода");
        setIsSubmitting(false);
        return;
      }

      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch (error: unknown) {
      console.error("Error creating expense:", error);
      setError("Ошибка при создании расхода");
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/groups/${groupId}`);
  };

  if (isLoading) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
            </div>
          </div>
        </main>
      </AuthGuard>
    );
  }

  if (error && !group) {
    return (
      <AuthGuard>
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-8">
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block"
            >
              ← Назад к группам
            </Link>
          </div>
        </main>
      </AuthGuard>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-6">
            <Link
              href={`/groups/${groupId}`}
              className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
            >
              ← Назад к группе
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Новый расход
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
            />
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

