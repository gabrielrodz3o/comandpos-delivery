import { useQuery } from "@tanstack/react-query";
import { getIncidents } from "@services/delivery";
import { currentScope, sessionKey } from "@services/session";
import { useRiderOperations } from "./useRiderOperations";
export function useIncidents() {
  const operations = useRiderOperations();
  return useQuery({
    queryKey: sessionKey(currentScope(), "incidents"),
    queryFn: ({ signal }) => getIncidents(signal),
    enabled: !!operations.data?.capabilities?.incidents,
    refetchInterval: 30000,
  });
}
