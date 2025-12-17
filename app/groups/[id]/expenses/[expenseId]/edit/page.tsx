import { notFound } from "next/navigation";
import AuthGuard from "@/app/components/AuthGuard";
import { getGroupById, getExpenseById } from "@/app/lib/groups";
import EditExpenseClient from "./EditExpenseClient";

interface EditExpensePageProps {
  params: Promise<{ id: string; expenseId: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const { id, expenseId } = await params;

  const group = await getGroupById(id);
  if (!group) {
    notFound();
  }

  const expense = await getExpenseById(id, expenseId);
  if (!expense) {
    notFound();
  }

  return (
    <AuthGuard>
      <EditExpenseClient group={group} expense={expense} />
    </AuthGuard>
  );
}



