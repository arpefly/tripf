"use client";

import { useEffect, useState } from "react";
import type { GroupInvite } from "@/app/lib/types";

interface GroupInvitePanelProps {
  groupId: string;
  groupName: string;
  createdBy?: string;
  currentUserId?: string | null;
  initialInvites?: GroupInvite[];
}

export default function GroupInvitePanel({
  groupId,
  groupName,
  createdBy,
  currentUserId,
  initialInvites,
}: GroupInvitePanelProps) {
  const [invites, setInvites] = useState<GroupInvite[]>(initialInvites ?? []);
  const [hasLoadedInvites, setHasLoadedInvites] = useState(
    Boolean(initialInvites)
  );
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("72"); // Default 3 days
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isExpanded || hasLoadedInvites) {
      return;
    }

    let isMounted = true;
    const loadInvites = async () => {
      setLoadingInvites(true);
      try {
        const response = await fetch(`/api/groups/${groupId}/invites`);
        const data = await response.json();

        if (isMounted && response.ok) {
          setInvites(data.invites || []);
          setHasLoadedInvites(true);
        }
      } catch {
        // ignore network errors; user can retry by toggling panel
      } finally {
        if (isMounted) {
          setLoadingInvites(false);
        }
      }
    };

    loadInvites();
    return () => {
      isMounted = false;
    };
  }, [groupId, hasLoadedInvites, isExpanded]);

  const handleCopy = async (text: string, successMessage: string) => {
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setError("Не удалось скопировать");
    }
  };

  const buildInviteLink = (token: string) => {
    if (typeof window === "undefined") {
      return token;
    }
    return `${window.location.origin}/invite/${token}`;
  };

  const handleCreateInvite = async () => {
    if (!currentUserId || currentUserId !== createdBy) {
      setError("Только создатель группы может создавать приглашения");
      return;
    }

    setCreating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/groups/${groupId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: Number(expiresInHours) }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Не удалось создать приглашение");
        return;
      }

      setInvites((prev) => [data.invite, ...prev]);
      setHasLoadedInvites(true);
      setMessage("Новое приглашение создано");
    } catch {
      setError("Не удалось создать приглашение");
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) {
      return "Без срока действия";
    }
    return new Date(value).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  const isCreator = currentUserId && createdBy && currentUserId === createdBy;

  const handleDeleteInvite = async (inviteId: string) => {
    if (!isCreator) {
      return;
    }
    if (typeof window !== "undefined" && !window.confirm("Удалить приглашение?")) {
      return;
    }
    setMessage("");
    setError("");
    setDeletingInviteId(inviteId);
    try {
      const response = await fetch(
        `/api/groups/${groupId}/invites?inviteId=${inviteId}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не удалось удалить приглашение");
        return;
      }
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      setMessage("Приглашение удалено");
    } catch {
      setError("Не удалось удалить приглашение");
    } finally {
      setDeletingInviteId(null);
    }
  };

  // If user is not creator and there are no invites, show nothing
  if (!isCreator && invites.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isCreator ? `Пригласить в «${groupName}»` : 'Коды приглашения'}
            </h3>
            {invites.length > 0 && (
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                    {invites.length}
                </span>
            )}
        </div>
        <button 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
            <svg 
                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700/50">
            <div className="flex flex-col gap-4">
                {isCreator && (
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Срок действия
                            </label>
                            <select
                                value={expiresInHours}
                                onChange={(e) => setExpiresInHours(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                            >
                                <option value="1">1 час</option>
                                <option value="6">6 часов</option>
                                <option value="24">1 день</option>
                                <option value="72">3 дня</option>
                                <option value="168">7 дней</option>
                                <option value="336">14 дней</option>
                                <option value="-1">Без срока</option>
                            </select>                       
                        <button
                            onClick={handleCreateInvite}
                            disabled={creating}
                            className="w-full md:w-auto px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-60 h-[38px]"
                        >
                            {creating ? "Создание..." : "Создать"}
                        </button>
                    </div>
                )}

                {(message || error) && (
                    <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                        error
                        ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                        : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                    }`}
                    >
                    {error || message}
                    </div>
                )}

                <div className="space-y-3">
                    {loadingInvites && !hasLoadedInvites ? (
                      <div className="animate-pulse h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    ) : invites.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          Активных приглашений пока нет.
                          {isCreator && " Создайте новое, чтобы пригласить участников."}
                      </div>
                    ) : (
                    invites.map((invite) => (
                        <div
                        key={invite.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 shadow-sm"
                        >
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                            <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">
                                Код для входа
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-widest">
                                {invite.code}
                            </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() =>
                                handleCopy(invite.code, "Код приглашения скопирован")
                                }
                                className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Копировать код
                            </button>
                            <button
                                onClick={() =>
                                handleCopy(
                                    buildInviteLink(invite.token),
                                    "Ссылка скопирована"
                                )
                                }
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                                Копировать ссылку
                            </button>
                            {isCreator && (
                              <button
                                onClick={() => handleDeleteInvite(invite.id)}
                                disabled={deletingInviteId === invite.id}
                                className="px-3 py-1.5 border border-red-200 dark:border-red-700 rounded-md text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
                              >
                                {deletingInviteId === invite.id ? "Удаляем..." : "Удалить"}
                              </button>
                            )}
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>
                                Истекает: {formatDate(invite.expiresAt)}
                            </span>
                        </div>
                        </div>
                    ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
