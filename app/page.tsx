import Link from "next/link";
import { redirect } from "next/navigation";
import GroupCard from "@/app/components/GroupCard";
import { getGroupsForUser, getExpensesForGroup } from "@/app/lib/groups";
import { getCurrentUser } from "@/app/lib/auth";

export default async function Home() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const groups = await getGroupsForUser();
  const groupsWithExpenses = await Promise.all(
    groups.map(async (group) => {
      const expenses = await getExpensesForGroup(group.id);
      return { group, expenses };
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        
        <div className="mb-6 flex flex-wrap gap-3 justify-end">
          <Link
            href="/groups/join"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Присоединиться по коду
          </Link>
          <Link
            href="/groups/new"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Создать группу
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              У вас пока нет групп
            </p>
            <Link
              href="/groups/new"
              className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Создать первую группу
            </Link>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Есть код приглашения?{" "}
              <Link
                href="/groups/join"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Присоединиться
              </Link>
            </p>
          </div>
        ) : (
          <div>
            {groupsWithExpenses.map(({ group, expenses }) => (
              <GroupCard key={group.id} group={group} expenses={expenses} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
