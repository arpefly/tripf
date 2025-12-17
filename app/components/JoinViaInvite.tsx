"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JoinViaInviteProps {
  token: string;
  groupId: string;
  groupName: string;
}

export default function JoinViaInvite({
  token,
  groupId,
  groupName,
}: JoinViaInviteProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Не удалось присоединиться к группе");
        return;
      }

      router.push(`/groups/${groupId}`);
      router.refresh();
    } catch {
      setError("Не удалось присоединиться к группе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <button
        onClick={handleJoin}
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-60"
      >
        {loading ? "Присоединяем..." : `Вступить в «${groupName}»`}
      </button>
    </div>
  );
}

