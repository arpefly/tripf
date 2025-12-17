import { notFound, redirect } from "next/navigation";
import { getGroupById, getExpensesForGroup } from "@/app/lib/groups";
import { getCurrentUser } from "@/app/lib/auth";
import { getActiveInvitesForGroup } from "@/app/lib/invites";
import GroupView from "@/app/components/GroupView";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { id } = await params;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const group = await getGroupById(id);

  if (!group) {
    notFound();
  }

  const expenses = await getExpensesForGroup(id);
  const invites = getActiveInvitesForGroup(id);

  return (
    <GroupView
      initialGroup={group}
      initialExpenses={expenses}
      initialInvites={invites}
      currentUserId={currentUser.id}
    />
  );
}
