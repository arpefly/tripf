import type { Settlement, Participant } from "@/app/lib/types";

interface SettlementListProps {
  settlements: Settlement[];
  participants: Participant[];
  onMarkPaid?: (settlement: Settlement) => void;
}

export default function SettlementList({
  settlements,
  participants,
  onMarkPaid,
}: SettlementListProps) {
  if (settlements.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Расчеты
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-4 bg-white dark:bg-gray-800 rounded-lg">
          Все расчеты выполнены
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Рекомендуемые расчеты
      </h3>
      <div className="space-y-3">
        {settlements.map((settlement, index) => {
          const fromParticipant = participants.find((p) => p.id === settlement.from);
          const toParticipant = participants.find((p) => p.id === settlement.to);

          return (
            <div
              key={index}
              className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900 dark:to-green-900 rounded-lg p-4 shadow-sm border border-blue-200 dark:border-blue-700"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                    {fromParticipant?.name.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {fromParticipant?.name || "Неизвестно"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      должен заплатить
                    </p>
                  </div>
                </div>
                <div className="text-center px-4">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {settlement.amount.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-right">
                      {toParticipant?.name || "Неизвестно"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-right">
                      должен получить
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg">
                    {toParticipant?.name.charAt(0).toUpperCase() || "?"}
                  </div>
                </div>
                {onMarkPaid && (
                  <button
                    type="button"
                    onClick={() => onMarkPaid(settlement)}
                    className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Отметить оплату
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

