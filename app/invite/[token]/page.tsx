import Link from "next/link";
import { notFound } from "next/navigation";
import { getInviteByToken } from "@/app/lib/invites";
import { getCurrentUser } from "@/app/lib/auth";
import JoinViaInvite from "@/app/components/JoinViaInvite";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = getInviteByToken(token);

  if (!invite) {
    notFound();
  }

  const inviteData = invite;

  const user = await getCurrentUser();
  const isExpired =
    !!inviteData.expiresAt && new Date(inviteData.expiresAt) <= new Date();
  const isUsed = Boolean(inviteData.usedAt);
  const canJoin = !isExpired && !isUsed;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div className="text-center mb-6">
          <p className="text-sm uppercase tracking-widest text-blue-500 font-semibold">
            Приглашение в группу
          </p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            «{inviteData.groupName}»
          </h1>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            Вас пригласили в группе «{inviteData.groupName}».
            Принимая приглашение, вы сможете видеть все траты и добавлять свои.
          </p>
          {inviteData.expiresAt && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ссылка действует до{" "}
              {new Date(inviteData.expiresAt).toLocaleString("ru-RU", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {isExpired && (
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg text-sm text-center">
            Срок действия этого приглашения истек. Попросите создателя группы отправить новый код.
          </div>
        )}

        {isUsed && !isExpired && (
          <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center">
            Это приглашение уже было использовано. Попросите создать новое.
          </div>
        )}

        {canJoin && (
          <div className="mt-6">
            {user ? (
              <JoinViaInvite
                token={token}
                groupId={inviteData.groupId}
                groupName={inviteData.groupName}
              />
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg text-sm text-center">
                  Войдите или зарегистрируйтесь, чтобы присоединиться к группе.
                </div>
                <Link
                  href={`/login?redirect=/invite/${token}`}
                  className="block w-full text-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Войти или зарегистрироваться
                </Link>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ← На главную
          </Link>
        </div>
      </div>
    </main>
  );
}

