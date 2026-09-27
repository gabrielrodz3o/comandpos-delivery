/** Orden de delivery del rider (shape de /api/restaurant/delivery/my-orders). */
export interface DeliveryOrder {
  id: number;
  location_id?: number;
  location_name?: string;
  name?: string;
  status_tracker_id: number;
  is_delivery: boolean;
  external_plattform_id?: number | null;
  delivery_contact_name?: string | null;
  delivery_phone?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  delivery_neighborhood?: string | null;
  delivery_reference_point?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  delivery_zone_id?: number | null;
  delivery_route_id?: number | null;
  delivery_route_order?: number | null;
  picked_up_at?: string | null;
  driver_assigned_at?: string | null;
  ready_at?: string | null;
  completed_at?: string | null;
  activity_at?: string | null;
  created_at?: string;
  updated_at?: string;
  delivery_cost?: number | string | null;
  invoice_id?: number | null;
  order_total?: number | string | null;
  amount_due?: number | string | null;
  currency_code?: string;
  expected_payment_type_id?: number | null;
  expected_payment_type_name?: string | null;
  payment_breakdown?: Array<{ payment_type_id: number; amount: number }> | null;
  proof_of_delivery_enabled?: boolean;
  pending_sync?: boolean;
  has_photo?: boolean;
  completion_declaration?: CompletionDetails | null;
  open_incidents_count?: number;
  incidents?: DeliveryIncident[];
  order_subtotal?: number | string | null;
  rider_collection_id?: string | null;
  rider_collection_status?:
    "pending" | "collected" | "partial" | "settled" | "cancelled" | null;
  rider_collection_amount?: number | string | null;
}

export interface MyOrdersResponse {
  success: boolean;
  data: DeliveryOrder[];
  meta?: { accepting_orders?: boolean | null; contract_version?: number };
}

/** status_tracker_id → etiqueta/colores (alineado con la web). */
export const STATUS_META: Record<number, { label: string; color: string }> = {
  1: { label: "Nueva", color: "#F59E0B" },
  2: { label: "Aceptada", color: "#3B82F6" },
  3: { label: "Preparando", color: "#F97316" },
  4: { label: "Lista", color: "#3B82F6" },
  5: { label: "Asignada", color: "#8B5CF6" },
  6: { label: "En camino", color: "#16A34A" },
  7: { label: "Entregada", color: "#15803D" },
  8: { label: "Cancelada por cliente", color: "#B91C1C" },
  9: { label: "Cancelada por tiempo", color: "#B91C1C" },
  10: { label: "Cancelada por restaurante", color: "#B91C1C" },
  11: { label: "Cancelada por repartidor", color: "#B91C1C" },
  12: { label: "Problema de entrega", color: "#B45309" },
};

export interface RiderOperations {
  location_id: number;
  location_name?: string;
  accepting_orders: boolean | null;
  dispatch_status: string | null;
  is_active?: boolean;
  rider_presence?: { active: boolean; reported_at: string } | null;
  arrival_tracking_enabled: boolean;
  proof_of_delivery_enabled: boolean;
  mobile_contract_version?: number;
  capabilities?: {
    completion_details: boolean;
    incidents: boolean;
    settlements: boolean;
    arrival_queue: boolean;
    directions_proxy: boolean;
    tracking: boolean;
    photo_evidence: boolean;
  };
}

export interface RiderFinances {
  updated_at: string;
  summaries: Array<{
    currency_code: string;
    fund_to_return: number;
    pending_collection: number;
    pending_settlement: number;
    pending_review: number;
    declared_received?: number;
    declared_cash?: number;
    declarations_count?: number;
  }>;
  funds: Array<{
    id: string;
    amount: number | string;
    currency_code: string;
    status: string;
    created_at: string;
    returned_at?: string;
    given_by_name?: string;
    box_name?: string;
    notes?: string;
  }>;
  collections: Array<{
    id: string;
    account_id: number;
    customer_name?: string;
    balance: number | string;
    currency_code: string;
    payment_method?: string;
    stage: "collection" | "settlement" | "review";
  }>;
}

export const INCIDENT_TYPES = {
  customer_unreachable: "Cliente no responde",
  wrong_address: "Dirección incorrecta",
  customer_rejected: "Cliente rechaza el pedido",
  no_change: "Falta de cambio",
  vehicle_breakdown: "Problema con el vehículo",
  accident: "Accidente",
  returned_order: "Pedido devuelto",
  other: "Otra situación",
} as const;

export interface CompletionDetails {
  photo_base64?: string;
  request_id?: string;
  occurred_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  collection?: {
    cash: number;
    card: number;
    transfer: number;
    other: number;
    notes?: string;
    expected_amount: number;
    currency_code: string;
  };
}
export interface DeliveryIncident {
  id: string;
  account_id: number | null;
  incident_type: keyof typeof INCIDENT_TYPES;
  status: "open" | "acknowledged" | "resolved" | "cancelled";
  notes: string;
  response?: string | null;
  created_at: string;
  resolved_at?: string | null;
}
export interface RiderSettlement {
  id: string;
  closed_at: string;
  status: string;
  cashier_name: string;
  location_name: string;
  orders_count: number;
  notes?: string;
  expected_total: number;
  collected_total: number;
  variance: number;
  currencies: Array<{ currency_code: string; amount: number }>;
  payments: Array<{
    account_id: number;
    amount: number;
    currency_code: string;
    payment_method: string;
  }>;
}
