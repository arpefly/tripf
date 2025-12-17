"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/app/components/AuthGuard";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!name.trim()) {
      setError("Название группы обязательно");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Ошибка при создании группы");
        setIsSubmitting(false);
        return;
      }

      const data = await response.json();
      router.push(`/groups/${data.group.id}`);
      router.refresh();
    } catch (error: unknown) {
      console.error("Error creating group:", error);
      setError("Ошибка при создании группы");
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/");
  };

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-6">
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
            >
              ← Назад к группам
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Создать группу
            </h1>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Название группы
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Например: Кавказ 2025 😍"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Создание..." : "Создать группу"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

