import type { AxiosRequestConfig } from "axios";
import { api } from "./apiClient";
import { currentScope } from "./session";
import { useAuthStore } from "@store/useAuthStore";
import type {
  MyOrdersResponse,
  DeliveryOrder,
  RiderOperations,
  RiderFinances,
  INCIDENT_TYPES,
} from "@/types/delivery";

const base = "/api/restaurant/delivery";
const config = (cfg: AxiosRequestConfig = {}): AxiosRequestConfig => ({
  skipErrorToast: true,
  deliveryScope: currentScope() || "signed-out",
  ...cfg,
});
export const getMyOrders = async (
  hours = 48,
  signal?: AbortSignal,
): Promise<MyOrdersResponse> =>
  (
    await api.get(
      `${base}/my-orders`,
      config({
        signal,
        params: { hours, location_id: useAuthStore.getState().locationId },
      }),
    )
  ).data;
export const getOrder = async (
  id: number,
  signal?: AbortSignal,
): Promise<DeliveryOrder> =>
  (await api.get(`${base}/order`, config({ signal, params: { id } }))).data
    .data;
export const getHistory = async (
  params: {
    from: string;
    to: string;
    offset: number;
    search: string;
    status: string;
  },
  signal?: AbortSignal,
): Promise<{ data: DeliveryOrder[]; next_offset: number | null }> =>
  (
    await api.get(
      `${base}/history`,
      config({
        signal,
        params: { ...params, location_id: useAuthStore.getState().locationId },
      }),
    )
  ).data;
export const getOperations = async (
  signal?: AbortSignal,
): Promise<RiderOperations> =>
  (await api.get(`${base}/operations/status`, config({ signal }))).data.data;
export const getFinances = async (
  signal?: AbortSignal,
): Promise<RiderFinances> =>
  (
    await api.get(
      `${base}/my-finances`,
      config({
        signal,
        params: { location_id: useAuthStore.getState().locationId },
      }),
    )
  ).data.data;
export const pickupRoute = (
  opts: { routeId?: number; accountId?: number },
  cfg?: AxiosRequestConfig,
) =>
  api
    .post(
      `${base}/route/pickup`,
      { route_id: opts.routeId, account_id: opts.accountId },
      config(cfg),
    )
    .then((r) => r.data);
export const groupMine = (accountIds: number[]) =>
  api
    .post(`${base}/route/group-mine`, { account_ids: accountIds }, config())
    .then((r) => r.data);
export const optimizeRoute = (
  routeId: number,
  stops: { account_id: number; order: number }[],
  totals?: { total_distance_km?: number; total_duration_seconds?: number },
) =>
  api
    .post(
      `${base}/route/optimize`,
      { route_id: routeId, stops, ...totals },
      config(),
    )
    .then((r) => r.data);
export const markDelivered = (
  accountId: number,
  recipientName?: string,
  cfg?: AxiosRequestConfig,
) =>
  api
    .post(
      `${base}/complete`,
      { account_id: accountId, recipient_name: recipientName },
      config(cfg),
    )
    .then((r) => r.data);
export const reportPresence = (
  active: boolean,
  requestId: string,
  cfg?: AxiosRequestConfig,
) =>
  api
    .post(
      `${base}/operations/presence`,
      { active, request_id: requestId },
      config(cfg),
    )
    .then((r) => r.data);
export const reportArrival = () =>
  api.post(`${base}/operations/arrival`, {}, config()).then((r) => r.data);
export const reportIncident = (
  accountId: number,
  type: keyof typeof INCIDENT_TYPES,
  notes: string,
) =>
  api
    .post(
      `${base}/incidents`,
      { account_id: accountId, incident_type: type, notes },
      config(),
    )
    .then((r) => r.data);
