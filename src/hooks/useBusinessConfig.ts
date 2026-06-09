import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBusinessConfig } from '@services/business';
import { useAuthStore } from '@store/useAuthStore';

/** Query key de la config de sucursal (scopeada por locationId). */
export const businessConfigKey = (locationId: number | null) => ['business-config', locationId];

/**
 * Config de la sucursal activa del rider: principalmente la google_maps_api_key
 * (por unidad de negocio).
 *
 * Refresh ante cambios en la DB:
 *  - `refetchOnReconnect`: al recuperar internet.
 *  - AppState → al volver la app a primer plano se invalida (si el admin cambió
 *    la key mientras la app estaba en background, se vuelve a traer).
 */
export function useBusinessConfig() {
  const locationId = useAuthStore((s) => s.locationId);
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: businessConfigKey(locationId),
    queryFn: () => getBusinessConfig(locationId as number),
    enabled: !!token && locationId != null,
    staleTime: 5 * 60_000,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (locationId == null) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        qc.invalidateQueries({ queryKey: businessConfigKey(locationId) });
      }
    });
    return () => sub.remove();
  }, [qc, locationId]);

  return {
    ...query,
    config: query.data ?? null,
    googleMapsApiKey: query.data?.google_maps_api_key ?? null,
  };
}
