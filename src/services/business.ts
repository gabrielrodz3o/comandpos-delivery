import { api } from './apiClient';
import type { DeliveryBusinessConfig } from '@types/business';

/**
 * Config de la sucursal activa (incluye la google_maps_api_key de la unidad
 * de negocio). `skipErrorToast`: el caller (hook) maneja el error en silencio,
 * la app sigue funcionando con el mapa nativo aunque falle.
 */
export const getBusinessConfig = async (locationId: number): Promise<DeliveryBusinessConfig> => {
  const { data } = await api.get<{ success: boolean; data: DeliveryBusinessConfig }>(
    '/api/restaurant/delivery/business-config',
    { params: { location_id: locationId }, skipErrorToast: true },
  );
  return data.data;
};
