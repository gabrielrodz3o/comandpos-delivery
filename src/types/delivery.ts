/** Orden de delivery del rider (shape de /api/restaurant/delivery/my-orders). */
export interface DeliveryOrder {
  id: number;
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
  created_at?: string;
  updated_at?: string;
  delivery_cost?: number | string | null;
  invoice_id?: number | null;
  order_subtotal?: number | string | null;
  rider_collection_id?: string | null;
  rider_collection_status?: 'pending' | 'collected' | 'partial' | 'settled' | 'cancelled' | null;
  rider_collection_amount?: number | string | null;
}

export interface MyOrdersResponse {
  success: boolean;
  data: DeliveryOrder[];
  meta?: { accepting_orders?: boolean | null };
}

/** status_tracker_id → etiqueta/colores (alineado con la web). */
export const STATUS_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Nueva', color: '#F59E0B' },
  2: { label: 'Aceptada', color: '#3B82F6' },
  3: { label: 'Preparando', color: '#F97316' },
  4: { label: 'Lista', color: '#3B82F6' },
  5: { label: 'Recogida', color: '#8B5CF6' },
  6: { label: 'En camino', color: '#16A34A' },
  7: { label: 'Entregada', color: '#15803D' },
  10: { label: 'Programada', color: '#6B7280' },
};
