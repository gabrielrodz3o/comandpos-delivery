import { useAuthStore } from "@store/useAuthStore";

export function currentScope(): string | null {
  const s = useAuthStore.getState();
  return s.token && s.user?.use_id
    ? JSON.stringify([s.apiBaseUrl, s.user.use_id, s.locationId])
    : null;
}
export const sessionKey = (scope: string | null, ...parts: unknown[]) => [
  "delivery",
  scope,
  ...parts,
];
export const ordersKey = (scope = currentScope()) =>
  sessionKey(scope, "orders");
