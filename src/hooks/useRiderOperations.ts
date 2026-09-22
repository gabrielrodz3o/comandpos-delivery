import { useQuery } from "@tanstack/react-query";
import { getFinances, getOperations } from "@services/delivery";
import { currentScope, sessionKey } from "@services/session";
import { useAuthStore } from "@store/useAuthStore";

export function useRiderOperations() {
  const { token, locationId } = useAuthStore();
  const scope = currentScope();
  return useQuery({
    queryKey: sessionKey(scope, "operations"),
    queryFn: ({ signal }) => getOperations(signal),
    enabled: !!token && !!locationId,
    refetchInterval: 30000,
  });
}
export function useRiderFinances() {
  const { token, locationId } = useAuthStore();
  const scope = currentScope();
  return useQuery({
    queryKey: sessionKey(scope, "finances"),
    queryFn: ({ signal }) => getFinances(signal),
    enabled: !!token && !!locationId,
    refetchInterval: 60000,
  });
}
