import { create } from 'zustand';

export type ToastVariant = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastInput {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const DEDUP_MS = 2_500;
const lastShownAt = new Map<string, number>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: ({ message, variant = 'error', duration = 3_500 }) => {
    const now = Date.now();
    const previous = lastShownAt.get(message);
    if (previous && now - previous < DEDUP_MS) return;
    lastShownAt.set(message, now);
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, variant, duration }] }));
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (input: ToastInput) => useToastStore.getState().show(input);
