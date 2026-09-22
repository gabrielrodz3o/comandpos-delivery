import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type QueuedKind = "markDelivered" | "presence";
export interface QueueItem {
  id: string;
  kind: QueuedKind;
  owner: string | null;
  payload: Record<string, any>;
  accountId?: number;
  label: string;
  createdAt: number;
  attempts: number;
  state: "pending" | "failed";
  error?: string;
}
interface SyncState {
  items: QueueItem[];
  online: boolean;
  flushing: boolean;
  hydrated: boolean;
  enqueue: (item: QueueItem) => void;
  remove: (id: string) => void;
  fail: (id: string, error: string) => void;
  retry: (owner: string) => void;
  setOnline: (online: boolean) => void;
  setFlushing: (flushing: boolean) => void;
  setHydrated: () => void;
}
export const useSyncQueue = create<SyncState>()(
  persist(
    (set) => ({
      items: [],
      online: true,
      flushing: false,
      hydrated: false,
      enqueue: (item) => set((s) => ({ items: [...s.items, item] })),
      remove: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      fail: (id, error) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, state: "failed", error, attempts: i.attempts + 1 }
              : i,
          ),
        })),
      retry: (owner) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.owner === owner && i.state === "failed"
              ? { ...i, state: "pending", error: undefined }
              : i,
          ),
        })),
      setOnline: (online) => set({ online }),
      setFlushing: (flushing) => set({ flushing }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "comandpos-delivery-syncqueue",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
      // Legacy operations have no verifiable owner. Preserve for support, never replay.
      migrate: (old: any) => ({
        items: (old?.items || []).map((i: any) => ({
          ...i,
          owner: null,
          state: "failed",
          error: "Acción antigua sin sesión verificable. Contacta a caja.",
        })),
      }),
      onRehydrateStorage: () => (s) => s?.setHydrated(),
    },
  ),
);
