import { AppState } from "react-native";
import { queryClient } from "./queryClient";
import { currentScope, ordersKey, sessionKey } from "./session";
import { markDelivered, reportPresence } from "./delivery";
import { useSyncQueue, type QueueItem } from "@store/useSyncQueue";
import { useAuthStore } from "@store/useAuthStore";
import { showToast } from "@store/useToastStore";
import type { DeliveryOrder, MyOrdersResponse } from "@/types/delivery";

let flush: Promise<void> | null = null;
export function applyPending(
  orders: DeliveryOrder[],
  items: QueueItem[],
  owner: string | null,
): DeliveryOrder[] {
  return orders.map((o) => {
    const pending = items.find(
      (i) =>
        i.owner === owner &&
        i.kind === "markDelivered" &&
        i.accountId === o.id &&
        i.state === "pending",
    );
    return pending
      ? {
          ...o,
          status_tracker_id: 7,
          completed_at: new Date(pending.createdAt).toISOString(),
          activity_at: new Date(pending.createdAt).toISOString(),
          pending_sync: true,
        }
      : o;
  });
}
export function flushQueue(): Promise<void> {
  if (flush) return flush;
  const owner = currentScope();
  const token = useAuthStore.getState().token;
  if (!owner || !useSyncQueue.getState().hydrated) return Promise.resolve();
  if (
    !useSyncQueue
      .getState()
      .items.some((i) => i.owner === owner && i.state === "pending")
  )
    return Promise.resolve();
  flush = (async () => {
    useSyncQueue.getState().setFlushing(true);
    try {
      for (const item of [...useSyncQueue.getState().items]) {
        if (currentScope() !== owner || useAuthStore.getState().token !== token)
          break;
        if (item.owner !== owner) continue;
        // Preserve ordering: a rejected action needs attention before subsequent actions.
        if (item.state === "failed") break;
        try {
          const cfg = { deliveryScope: owner, skipErrorToast: true };
          if (item.kind === "markDelivered")
            await markDelivered(
              item.payload.accountId,
              item.payload.recipientName,
              cfg,
            );
          else if (item.kind === "presence")
            await reportPresence(item.payload.active, item.id, cfg);
          else
            throw {
              status: 400,
              message: "Acción no compatible. Revisa con caja.",
            };
          useSyncQueue.getState().remove(item.id);
          if (
            currentScope() !== owner ||
            useAuthStore.getState().token !== token
          )
            break;
          useSyncQueue.getState().setOnline(true);
        } catch (e: any) {
          if (
            currentScope() !== owner ||
            useAuthStore.getState().token !== token
          )
            break;
          if (!e?.status) {
            useSyncQueue.getState().setOnline(false);
            break;
          }
          useSyncQueue
            .getState()
            .fail(item.id, e.message || "Caja debe revisar este cambio.");
          break;
        }
      }
    } finally {
      useSyncQueue.getState().setFlushing(false);
      if (currentScope() === owner)
        await queryClient.invalidateQueries({ queryKey: sessionKey(owner) });
    }
  })().finally(() => {
    flush = null;
  });
  return flush;
}
async function enqueue(
  kind: QueueItem["kind"],
  payload: Record<string, any>,
  label: string,
  accountId?: number,
) {
  const owner = currentScope();
  if (!owner) throw new Error("Inicia sesión para continuar");
  if (!useSyncQueue.getState().hydrated)
    throw new Error("Espera a que termine de cargar la sincronización");
  const existing = useSyncQueue
    .getState()
    .items.find(
      (i) => i.owner === owner && i.kind === kind && i.accountId === accountId,
    );
  if (existing)
    throw new Error(
      "Ya hay una acción pendiente. Revísala en Cuenta antes de repetirla.",
    );
  const item: QueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    owner,
    kind,
    payload,
    label,
    accountId,
    createdAt: Date.now(),
    attempts: 0,
    state: "pending",
  };
  useSyncQueue.getState().enqueue(item);
  if (kind === "markDelivered")
    queryClient.setQueryData<MyOrdersResponse>(ordersKey(owner), (prev) =>
      prev ? { ...prev, data: applyPending(prev.data, [item], owner) } : prev,
    );
  await flushQueue();
  const pending = useSyncQueue.getState().items.find((i) => i.id === item.id);
  if (pending?.state === "failed") throw new Error(pending.error);
  if (pending)
    showToast({
      message: "Guardado en este dispositivo. Pendiente de sincronizar.",
      variant: "info",
    });
  return { queued: !!pending };
}
export const queueMarkDelivered = (
  order: DeliveryOrder,
  recipientName?: string,
) =>
  enqueue(
    "markDelivered",
    { accountId: order.id, recipientName },
    `Entrega #${order.id}`,
    order.id,
  );
export const queuePresence = (active: boolean) =>
  enqueue(
    "presence",
    { active },
    active ? "Aviso: estoy activo" : "Aviso: estoy inactivo",
    -1,
  );
export function startSyncManager() {
  void flushQueue();
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") void flushQueue();
  });
  const unsub = useSyncQueue.subscribe((s, p) => {
    if (s.hydrated && !p.hydrated) void flushQueue();
  });
  const timer = setInterval(() => {
    void flushQueue();
  }, 15000);
  return () => {
    sub.remove();
    unsub();
    clearInterval(timer);
  };
}
