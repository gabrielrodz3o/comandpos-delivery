import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Tipos de mutación que pueden encolarse cuando no hay señal. */
export type QueuedKind = 'changeStatus' | 'markDelivered' | 'setAvailability';

export interface QueueItem {
  id: string;
  kind: QueuedKind;
  payload: Record<string, any>; // argumentos crudos para la llamada al reintentar
  accountId?: number;           // para dedupe / mostrar en UI
  label: string;                // texto humano ("Entregada · Juan")
  createdAt: number;
  attempts: number;
}

interface SyncState {
  items: QueueItem[];
  online: boolean;     // conectividad inferida (true optimista)
  flushing: boolean;   // hay un flush en curso
  enqueue: (item: Omit<QueueItem, 'id' | 'createdAt' | 'attempts'>) => void;
  remove: (id: string) => void;
  bumpAttempt: (id: string) => void;
  setOnline: (online: boolean) => void;
  setFlushing: (flushing: boolean) => void;
  clear: () => void;
}

let seq = 0;
const newId = () => `${Date.now()}-${seq++}`;

export const useSyncQueue = create<SyncState>()(
  persist(
    (set) => ({
      items: [],
      online: true,
      flushing: false,

      enqueue: (item) =>
        set((s) => {
          // Dedupe: una sola acción pendiente por (kind + accountId). La última gana.
          const items = s.items.filter(
            (q) => !(q.kind === item.kind && q.accountId === item.accountId),
          );
          items.push({ ...item, id: newId(), createdAt: Date.now(), attempts: 0 });
          return { items, online: false };
        }),

      remove: (id) => set((s) => ({ items: s.items.filter((q) => q.id !== id) })),
      bumpAttempt: (id) =>
        set((s) => ({ items: s.items.map((q) => (q.id === id ? { ...q, attempts: q.attempts + 1 } : q)) })),
      setOnline: (online) => set({ online }),
      setFlushing: (flushing) => set({ flushing }),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'comandpos-delivery-syncqueue',
      storage: createJSONStorage(() => AsyncStorage),
      // No persistimos flags volátiles (online/flushing): al reabrir son optimistas.
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
