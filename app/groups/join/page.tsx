import Link from "next/link";
import AuthGuard from "@/app/components/AuthGuard";
import JoinGroupForm from "@/app/components/JoinGroupForm";

export default function JoinGroupPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-xl">
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
          >
            ← Назад к группам
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Присоединиться к группе
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Введите одноразовый код, который вам отправили. После ввода вы сразу
            появитесь в списке участников.
          </p>

          <JoinGroupForm />
        </div>
      </main>
    </AuthGuard>
  );
}

