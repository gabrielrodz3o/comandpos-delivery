import { AppState } from 'react-native';
import type { AxiosRequestConfig } from 'axios';
import { queryClient, MY_ORDERS_KEY } from './queryClient';
import { changeStatus, markDelivered, setAvailability } from './delivery';
import { useSyncQueue, type QueueItem } from '@store/useSyncQueue';
import { showToast } from '@store/useToastStore';
import type { DeliveryOrder, MyOrdersResponse } from '@types/delivery';

/** Config que evita el toast de error del interceptor (lo maneja la cola). */
const SILENT: AxiosRequestConfig = { skipErrorToast: true };
const MAX_ATTEMPTS = 4;

/** Un rechazo sin `status` HTTP = nunca llegó al server (sin señal / timeout). */
const isNetworkError = (e: any) => !e || e.status === undefined || e.status === null;

const orderLabel = (o: DeliveryOrder) => o.delivery_contact_name || o.name || `#${o.id}`;

// ─────────────────────────── Optimistic cache ───────────────────────────

/** Parchea órdenes en el cache de React Query (UI instantánea, sin esperar al server). */
function patchOrders(predicate: (o: DeliveryOrder) => boolean, mut: (o: DeliveryOrder) => DeliveryOrder) {
  queryClient.setQueryData<MyOrdersResponse>(MY_ORDERS_KEY, (prev) => {
    if (!prev?.data) return prev;
    return { ...prev, data: prev.data.map((o) => (predicate(o) ? mut(o) : o)) };
  });
}

function patchMeta(mut: (meta: NonNullable<MyOrdersResponse['meta']>) => MyOrdersResponse['meta']) {
  queryClient.setQueryData<MyOrdersResponse>(MY_ORDERS_KEY, (prev) =>
    prev ? { ...prev, meta: mut(prev.meta ?? {}) } : prev,
  );
}

// ─────────────────────────── Replay de un item ───────────────────────────

function processItem(item: QueueItem): Promise<any> {
  const p = item.payload;
  switch (item.kind) {
    case 'changeStatus':
      return changeStatus(p.accountId, p.statusId, SILENT);
    case 'markDelivered':
      return markDelivered(p.accountId, p.locationId, p.userId, SILENT);
    case 'setAvailability':
      return setAvailability(p.accepting, SILENT);
  }
}

// ─────────────────────────── Flush de la cola ───────────────────────────

let flushing = false;

/** Procesa la cola en orden. Para al primer error de red; descarta tras N intentos por error del server. */
export async function flushQueue(): Promise<void> {
  const q = useSyncQueue.getState();
  if (!q.items.length) {
    q.setOnline(true);
    return;
  }
  if (flushing) return;
  flushing = true;
  q.setFlushing(true);
  try {
    for (const item of [...useSyncQueue.getState().items]) {
      try {
        await processItem(item);
        useSyncQueue.getState().remove(item.id);
        useSyncQueue.getState().setOnline(true);
      } catch (e: any) {
        if (isNetworkError(e)) {
          useSyncQueue.getState().setOnline(false);
          break; // seguimos sin señal: reintentamos en el próximo ciclo
        }
        // El server respondió error: reintentar unas veces y descartar.
        useSyncQueue.getState().bumpAttempt(item.id);
        const cur = useSyncQueue.getState().items.find((x) => x.id === item.id);
        if (!cur || cur.attempts >= MAX_ATTEMPTS) {
          useSyncQueue.getState().remove(item.id);
          showToast({ message: `No se pudo sincronizar: ${item.label}`, variant: 'error' });
        }
      }
    }
  } finally {
    flushing = false;
    useSyncQueue.getState().setFlushing(false);
    // Cuando la cola queda vacía, refrescamos la verdad del server.
    if (useSyncQueue.getState().items.length === 0) {
      queryClient.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    }
  }
}

// ─────────────── Intentar ahora / encolar si no hay señal ───────────────

async function attemptOrQueue(
  entry: Omit<QueueItem, 'id' | 'createdAt' | 'attempts'>,
  call: () => Promise<any>,
): Promise<{ queued: boolean }> {
  const { online, enqueue } = useSyncQueue.getState();

  // Ya sabemos que no hay señal → encolar directo (evita esperar 20s al timeout).
  if (!online) {
    enqueue(entry);
    showToast({ message: '📡 Sin señal — se enviará al reconectar', variant: 'info' });
    return { queued: true };
  }
  try {
    await call();
    useSyncQueue.getState().setOnline(true);
    return { queued: false };
  } catch (e: any) {
    if (isNetworkError(e)) {
      enqueue(entry); // marca online=false internamente
      showToast({ message: '📡 Sin señal — se enviará al reconectar', variant: 'info' });
      return { queued: true };
    }
    // Error real del server → revertimos el optimismo trayendo la verdad.
    queryClient.invalidateQueries({ queryKey: MY_ORDERS_KEY });
    showToast({ message: e?.message || 'No se pudo completar la acción', variant: 'error' });
    throw e;
  }
}

// ─────────────────────────── API pública ───────────────────────────

/** Cambia el estado de una orden (optimista + tolerante a falta de señal). */
export function queueChangeStatus(order: DeliveryOrder, statusId: number) {
  patchOrders((o) => o.id === order.id, (o) => ({ ...o, status_tracker_id: statusId }));
  return attemptOrQueue(
    {
      kind: 'changeStatus',
      accountId: order.id,
      label: `Estado · ${orderLabel(order)}`,
      payload: { accountId: order.id, statusId },
    },
    () => changeStatus(order.id, statusId, SILENT),
  );
}

/** Marca una orden como entregada (optimista + tolerante a falta de señal). */
export function queueMarkDelivered(order: DeliveryOrder, locationId: number, userId: number) {
  const hadCustody = ['pending', 'partial'].includes(order.rider_collection_status ?? '');
  patchOrders(
    (o) => o.id === order.id,
    (o) => ({
      ...o,
      status_tracker_id: 7,
      rider_collection_status: hadCustody ? 'collected' : o.rider_collection_status,
    }),
  );
  return attemptOrQueue(
    {
      kind: 'markDelivered',
      accountId: order.id,
      label: `Entregada · ${orderLabel(order)}`,
      payload: { accountId: order.id, locationId, userId },
    },
    () => markDelivered(order.id, locationId, userId, SILENT),
  );
}

/** Cambia disponibilidad del rider (optimista + tolerante a falta de señal). */
export function queueAvailability(accepting: boolean) {
  patchMeta((meta) => ({ ...meta, accepting_orders: accepting }));
  return attemptOrQueue(
    {
      kind: 'setAvailability',
      accountId: -1, // singleton: solo una disponibilidad pendiente a la vez
      label: accepting ? 'Disponible' : 'No disponible',
      payload: { accepting },
    },
    () => setAvailability(accepting, SILENT),
  );
}

// ─────────────────────────── Manager ───────────────────────────

/** Arranca los disparadores de flush: foreground, intervalo y un intento inicial. */
export function startSyncManager(): () => void {
  flushQueue();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') flushQueue();
  });
  const iv = setInterval(() => {
    if (useSyncQueue.getState().items.length) flushQueue();
  }, 15_000);
  return () => {
    sub.remove();
    clearInterval(iv);
  };
}
