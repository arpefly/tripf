import { NextRequest, NextResponse } from "next/server";
import db from "@/app/lib/db";
import { getCurrentUserId } from "@/app/lib/auth";
import { emitGroupEvent, subscribeToGroup } from "@/app/lib/eventBus";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const group = db
    .prepare(`
      SELECT g.id
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = ? AND (g.created_by = ? OR gm.user_id = ?)
    `)
    .get(groupId, userId, userId);

  if (!group) {
    return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;
  let onAbort: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const encoder = new TextEncoder();

      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      // Первичное событие, чтобы клиент знал, что соединение установлено
      send({ type: "connected" });

      const unsubscribe = subscribeToGroup(groupId, send);
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (onAbort) {
          request.signal.removeEventListener("abort", onAbort);
        }
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      };

      onAbort = () => cleanup && cleanup();
      request.signal.addEventListener("abort", onAbort);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export function emitGroupUpdate(groupId: string, payload: unknown) {
  emitGroupEvent(groupId, payload);
}
