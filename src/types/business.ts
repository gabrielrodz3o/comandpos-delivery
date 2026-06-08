/** Usuario autenticado (subset de lo que devuelve /auth/login del backend Nuxt). */
export interface AuthLocation {
  id: number;
  description_short?: string;
  description_long?: string;
  business_unit_id?: number;
}

export interface AuthBusinessUnit {
  business_unit_id: number;
  company_id?: number;
  business_unit_description_short?: string;
  business_unit_description_long?: string;
  rnc?: string;
  color?: string;
  locations?: AuthLocation[];
}

export interface AuthUser {
  use_id: number;
  use_fullname: string;
  use_username: string;
  use_image?: string | null;
  per_level?: number;
  per_description?: string;
  acess_locations?: number[];
  business_units_with_access?: AuthBusinessUnit[];
  type_access?: Array<{ access?: { access_profile_id?: number; access_profile_description?: string } }>;
  [key: string]: unknown;
}
