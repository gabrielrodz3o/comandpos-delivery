export const money = (n: number | string | null | undefined, currency = 'DOP'): string => {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return 'Por confirmar';
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'DOP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
};

export const orderTotal = (o: { order_total?: number | string | null }): number | null => {
  return o.order_total != null && Number.isFinite(Number(o.order_total)) ? Number(o.order_total) : null;
};

export const initials = (name?: string | null): string => {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
};
