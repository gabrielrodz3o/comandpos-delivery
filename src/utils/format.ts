export const money = (n: number | string | null | undefined): string => {
  const v = Number(n) || 0;
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(v);
};

export const orderTotal = (o: { order_subtotal?: number | string | null; delivery_cost?: number | string | null }): number => {
  const sub = Number(o.order_subtotal) || 0;
  const fee = Number(o.delivery_cost) || 0;
  return sub + sub * 0.18 + fee; // aprox con ITBIS, igual que la web
};

export const initials = (name?: string | null): string => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
};
