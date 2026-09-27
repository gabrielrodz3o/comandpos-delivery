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
  CompletionDetails,
  DeliveryIncident,
  RiderSettlement,
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
  details?: CompletionDetails,
) =>
  api
    .post(
      `${base}/complete`,
      { ...details, account_id: accountId, recipient_name: recipientName },
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
export const reportArrival = (requestId?: string, cfg?: AxiosRequestConfig) =>
  api
    .post(`${base}/operations/arrival`, { request_id: requestId }, config(cfg))
    .then((r) => r.data);
export const reportIncident = (
  accountId: number,
  type: keyof typeof INCIDENT_TYPES,
  notes: string,
  requestId?: string,
  cfg?: AxiosRequestConfig,
) =>
  api
    .post(
      `${base}/incidents`,
      {
        account_id: accountId,
        incident_type: type,
        notes,
        request_id: requestId,
      },
      config(cfg),
    )
    .then((r) => r.data);

export const getIncidents = async (
  signal?: AbortSignal,
): Promise<{ data: DeliveryIncident[]; open_count: number }> =>
  (
    await api.get(
      `${base}/incidents`,
      config({
        signal,
        params: { location_id: useAuthStore.getState().locationId },
      }),
    )
  ).data;
export const getSettlements = async (
  offset = 0,
  signal?: AbortSignal,
): Promise<{ data: RiderSettlement[]; next_offset: number | null }> =>
  (
    await api.get(
      `${base}/my-settlements`,
      config({
        signal,
        params: { offset, location_id: useAuthStore.getState().locationId },
      }),
    )
  ).data;

export const getDeliveryPhoto = async (
  id: number,
  signal?: AbortSignal,
): Promise<string | null> =>
  (
    await api.get(
      `${base}/proof`,
      config({ signal, params: { account_id: id } }),
    )
  ).data.data.photo;
