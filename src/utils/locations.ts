import type { AuthUser } from '@types/business';

/** Sucursal accesible por el rider, ya aplanada con su unidad de negocio. */
export interface AccessibleLocation {
  id: number;
  name: string;
  businessUnitId?: number;
  businessUnitName?: string;
}

/**
 * Lista de sucursales a las que el rider tiene acceso, derivada de
 * `business_units_with_access`. Fallback a `acess_locations` (solo ids) si el
 * login no trajo el detalle. Deduplica por location id.
 */
export function accessibleLocations(user: AuthUser | null | undefined): AccessibleLocation[] {
  if (!user) return [];
  const out: AccessibleLocation[] = [];
  const seen = new Set<number>();

  for (const bu of user.business_units_with_access ?? []) {
    for (const loc of bu.locations ?? []) {
      if (loc.id == null || seen.has(loc.id)) continue;
      seen.add(loc.id);
      out.push({
        id: loc.id,
        name: loc.description_long || loc.description_short || `Sucursal #${loc.id}`,
        businessUnitId: bu.business_unit_id,
        businessUnitName: bu.business_unit_description_long || bu.business_unit_description_short,
      });
    }
  }

  if (!out.length && Array.isArray(user.acess_locations)) {
    for (const id of user.acess_locations) {
      const n = Number(id);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push({ id: n, name: `Sucursal #${n}` });
    }
  }

  return out;
}
