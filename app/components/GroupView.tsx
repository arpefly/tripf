"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { optimizeSettlements, getTotalExpenses } from "@/app/lib/calculations";
import ParticipantList from "@/app/components/ParticipantList";
import ExpenseList from "@/app/components/ExpenseList";
import SettlementList from "@/app/components/SettlementList";
import GroupInvitePanel from "@/app/components/GroupInvitePanel";
import type { Group, Expense, GroupInvite, Settlement, SettlementPayment } from "@/app/lib/types";

interface GroupViewProps {
  initialGroup: Group;
  initialExpenses: Expense[];
  initialInvites?: GroupInvite[];
  currentUserId?: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function GroupView({
  initialGroup,
  initialExpenses,
  initialInvites,
  currentUserId,
}: GroupViewProps) {
  const router = useRouter();
  const [currentUserIdState, setCurrentUserId] = useState<string | null>(
    currentUserId ?? null
  );
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [participantFeedback, setParticipantFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [expenseFeedback, setExpenseFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<{
    from: string;
    to: string;
    amount: string;
    note: string;
  }>({ from: "", to: "", amount: "", note: "" });
  const resolvedCurrentUserId = currentUserIdState || currentUserId || null;

  useEffect(() => {
    if (currentUserIdState || currentUserId) {
      return;
    }

    let isMounted = true;
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (isMounted) {
          setCurrentUserId(data.user?.id || null);
        }
      } catch {
        if (isMounted) {
          setCurrentUserId(null);
        }
      }
    };
    loadUser();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentUserIdState]);

  // Получаем участников
  const { data: groupData, mutate: mutateGroup } = useSWR<{ group: Group }>(
    `/api/groups/${initialGroup.id}`,
    fetcher,
    {
      fallbackData: { group: initialGroup },
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const group = groupData?.group || initialGroup;

  // Получаем расходы
  const { data: expensesData, mutate: mutateExpenses } = useSWR<{ expenses: Expense[] }>(
    `/api/groups/${group.id}/expenses`,
    fetcher,
    {
      fallbackData: { expenses: initialExpenses },
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const expenses = expensesData?.expenses || initialExpenses;

  // Получаем платежи (отметки переводов)
  const { data: paymentsData, mutate: mutatePayments } = useSWR<{
    payments: SettlementPayment[];
  }>(`/api/groups/${group.id}/payments`, fetcher, {
    fallbackData: { payments: [] },
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const payments = paymentsData?.payments ?? [];

  useEffect(() => {
    if (!group?.id) {
      return;
    }

    const eventSource = new EventSource(`/api/groups/${group.id}/events`);

    eventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === "group:deleted") {
          router.push("/");
          router.refresh();
          return;
        }
      } catch {
        // надо бы что то ловить с парсинга
      }

      await Promise.all([mutateGroup(), mutateExpenses(), mutatePayments()]);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [group?.id, mutateExpenses, mutateGroup, mutatePayments, router]);

  // Пересчитываем рекомендованные расчёты на клиенте
  const settlements = optimizeSettlements(expenses, group.participants, payments);
  const total = getTotalExpenses(expenses);
  const isCreator =
    Boolean(resolvedCurrentUserId) &&
    Boolean(group.createdBy) &&
    resolvedCurrentUserId === group.createdBy;

  const handlePrefillPayment = (settlement: Settlement) => {
    setPaymentFeedback(null);
    setPaymentDraft({
      from: settlement.from,
      to: settlement.to,
      amount: String(settlement.amount),
      note: "",
    });
    if (typeof document !== "undefined") {
      document.getElementById("payment-form")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedCurrentUserId) {
      return;
    }

    setPaymentFeedback(null);
    setCreatingPayment(true);
    try {
      const response = await fetch(`/api/groups/${group.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: paymentDraft.from,
          to: paymentDraft.to,
          amount: Number(paymentDraft.amount),
          note: paymentDraft.note?.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPaymentFeedback({
          type: "error",
          message: data.error || "Не удалось создать платёж",
        });
        return;
      }

      await mutatePayments();
      setPaymentFeedback({ type: "success", message: "Платёж добавлен" });
      setPaymentDraft({ from: "", to: "", amount: "", note: "" });
    } catch {
      setPaymentFeedback({ type: "error", message: "Не удалось создать платёж" });
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!resolvedCurrentUserId) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Отменить платёж? Это удалит отметку оплаты.")
    ) {
      return;
    }

    setPaymentFeedback(null);
    setDeletingPaymentId(paymentId);
    try {
      const response = await fetch(`/api/groups/${group.id}/payments/${paymentId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPaymentFeedback({
          type: "error",
          message: data.error || "Не удалось отменить платёж",
        });
        return;
      }

      await mutatePayments();
      setPaymentFeedback({ type: "success", message: "Платёж отменён" });
    } catch {
      setPaymentFeedback({ type: "error", message: "Не удалось отменить платёж" });
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!resolvedCurrentUserId) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Удалить расход? Это действие необратимо.")
    ) {
      return;
    }

    setExpenseFeedback(null);
    setDeletingExpenseId(expenseId);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/expenses/${expenseId}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setExpenseFeedback({
          type: "error",
          message: data.error || "Не удалось удалить расход",
        });
        return;
      }

      await mutateExpenses();
      setExpenseFeedback({ type: "success", message: "Расход удалён" });
    } catch {
      setExpenseFeedback({
        type: "error",
        message: "Не удалось удалить расход",
      });
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!isCreator) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Удалить участника из группы? Это действие необратимо.")
    ) {
      return;
    }

    setParticipantFeedback(null);
    setRemovingParticipantId(participantId);

    try {
      const response = await fetch(
        `/api/groups/${group.id}/participants?participantId=${participantId}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setParticipantFeedback({
          type: "error",
          message: data.error || "Не удалось удалить участника",
        });
        return;
      }

      if (data.groupDeleted) {
        router.push("/");
        router.refresh();
        return;
      }

      await mutateGroup();
      setParticipantFeedback({ type: "success", message: "Участник удалён" });
    } catch {
      setParticipantFeedback({
        type: "error",
        message: "Не удалось удалить участника",
      });
    } finally {
      setRemovingParticipantId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!isCreator) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Удалить всю группу и связанные данные? Это действие невозможно отменить.")
    ) {
      return;
    }

    setGroupError("");
    setDeletingGroup(true);
    try {
      const response = await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGroupError(data.error || "Не удалось удалить группу");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setGroupError("Не удалось удалить группу");
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Назад к группам
          </Link>
          <div className="flex justify-between items-start mt-4 gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {group.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Всего расходов: {total.toLocaleString("ru-RU")} ₽
              </p>
              {groupError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{groupError}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/groups/${group.id}/expenses/new`}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                + Добавить расход
              </Link>
              {isCreator && (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={deletingGroup}
                  className="px-6 py-3 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-medium disabled:opacity-60"
                >
                  {deletingGroup ? "Удаляем..." : "Удалить группу"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Участники
              </h3>
            </div>
          </div>
          {participantFeedback && (
            <div
              className={`mb-3 text-sm ${
                participantFeedback.type === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {participantFeedback.message}
            </div>
          )}
          <ParticipantList
            participants={group.participants}
            onRemove={isCreator ? handleRemoveParticipant : undefined}
            removingParticipantId={removingParticipantId}
          />
        </div>

        <div className="mb-6">
          <GroupInvitePanel
            groupId={group.id}
            groupName={group.name}
            createdBy={group.createdBy}
        currentUserId={currentUserIdState || currentUserId}
        initialInvites={initialInvites}
          />
        </div>

        <ExpenseList
          expenses={expenses}
          participants={group.participants}
        currentUserId={currentUserIdState || currentUserId}
          groupCreatorId={group.createdBy}
          onDelete={handleDeleteExpense}
          deletingExpenseId={deletingExpenseId}
          feedback={expenseFeedback}
        />

        <SettlementList
          settlements={settlements}
          participants={group.participants}
          onMarkPaid={handlePrefillPayment}
        />

        <div id="payment-form" className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Платежи
          </h3>

          {paymentFeedback && (
            <div
              className={`mb-3 text-sm ${
                paymentFeedback.type === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {paymentFeedback.message}
            </div>
          )}

          <form
            onSubmit={handleCreatePayment}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Кто платит
                </label>
                <select
                  value={paymentDraft.from}
                  onChange={(e) =>
                    setPaymentDraft((p) => ({ ...p, from: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">—</option>
                  {group.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Кто получает
                </label>
                <select
                  value={paymentDraft.to}
                  onChange={(e) => setPaymentDraft((p) => ({ ...p, to: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">—</option>
                  {group.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Сумма
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentDraft.amount}
                  onChange={(e) =>
                    setPaymentDraft((p) => ({ ...p, amount: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Комментарий (необязательно)
                </label>
                <input
                  type="text"
                  value={paymentDraft.note}
                  onChange={(e) =>
                    setPaymentDraft((p) => ({ ...p, note: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Например, СБП"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="submit"
                disabled={creatingPayment}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-60"
              >
                {creatingPayment ? "Сохраняем..." : "Добавить платёж"}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {payments.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 bg-white dark:bg-gray-800 rounded-lg">
                Платежей пока нет
              </p>
            ) : (
              payments.map((payment) => {
                const fromParticipant = group.participants.find(
                  (p) => p.id === payment.from
                );
                const toParticipant = group.participants.find((p) => p.id === payment.to);
                const canDeletePayment =
                  Boolean(resolvedCurrentUserId) &&
                  (payment.createdBy === resolvedCurrentUserId || isCreator);

                return (
                  <div
                    key={payment.id}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {fromParticipant?.name || "Неизвестно"} →{" "}
                          {toParticipant?.name || "Неизвестно"}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(payment.createdAt).toLocaleString("ru-RU")}
                          {payment.note ? ` · ${payment.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {payment.amount.toLocaleString("ru-RU")} ₽
                        </p>
                        {canDeletePayment && (
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment.id)}
                            disabled={deletingPaymentId === payment.id}
                            className="px-4 py-2 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm font-medium disabled:opacity-60"
                          >
                            {deletingPaymentId === payment.id ? "Отменяем..." : "Отменить"}
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
      </div>
    </main>
  );
}

