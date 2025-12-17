import type { Participant } from "@/app/lib/types";

interface ParticipantListProps {
  participants: Participant[];
  onRemove?: (participantId: string) => void;
  removingParticipantId?: string | null;
}

export default function ParticipantList({
  participants,
  onRemove,
  removingParticipantId,
}: ParticipantListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {participants.map((participant) => (
        <div
          key={participant.id}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-800 dark:text-blue-200"
        >
          <span>{participant.name}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(participant.id)}
              disabled={removingParticipantId === participant.id}
              className="text-xs px-2 py-0.5 rounded-full border border-red-200 dark:border-red-600 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
            >
              {removingParticipantId === participant.id ? "Удаляем..." : "Удалить"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

