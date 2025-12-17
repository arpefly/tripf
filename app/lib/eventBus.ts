type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribeToGroup(groupId: string, listener: Listener): () => void {
  const groupListeners = listeners.get(groupId) ?? new Set<Listener>();
  groupListeners.add(listener);
  listeners.set(groupId, groupListeners);

  return () => {
    const current = listeners.get(groupId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(groupId);
    }
  };
}

export function emitGroupEvent(groupId: string, payload: unknown): void {
  const groupListeners = listeners.get(groupId);
  if (!groupListeners) {
    return;
  }

  for (const listener of groupListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error("emitGroupEvent listener error:", error);
    }
  }
}

