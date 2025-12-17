"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JoinedGroup {
  id: string;
  name: string;
}

export default function JoinGroupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinedGroup, setJoinedGroup] = useState<JoinedGroup | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError("Введите код приглашения");
      return;
    }

    setLoading(true);
    setError("");
    setJoinedGroup(null);

    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Не удалось присоединиться к группе");
        return;
      }

      setJoinedGroup({ id: data.groupId, name: data.groupName });
      setCode("");
      router.refresh();
    } catch {
      setError("Не удалось присоединиться к группе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4"
    >
      <div>
        <label
          htmlFor="invite-code"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Код приглашения
        </label>
        <input
          id="invite-code"
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Например: ABC123"
          maxLength={12}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white uppercase tracking-[0.3em]"
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {joinedGroup && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex flex-col gap-2">
          <span>
            Вы присоединились к группе «{joinedGroup.name}». Добро пожаловать!
          </span>
          <button
            type="button"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 underline text-left"
            onClick={() => router.push(`/groups/${joinedGroup.id}`)}
          >
            Перейти к группе
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-60"
      >
        {loading ? "Присоединяем..." : "Присоединиться"}
      </button>
    </form>
  );
}

