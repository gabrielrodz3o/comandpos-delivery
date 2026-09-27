/** HTTP conflicts must be resolved online; cached orders remain usable after network failures. */
export function canRecordOffline(error: unknown): boolean {
  if (!error) return true;
  const status = (error as { status?: number }).status;
  return !status || status >= 500 || status === 408 || status === 429;
}
export function amountInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
export function collectionTotal(values: {
  cash: number;
  card: number;
  transfer: number;
  other: number;
}) {
  return (
    Math.round(
      (values.cash + values.card + values.transfer + values.other) * 100,
    ) / 100
  );
}
export function notificationOrderId(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const id = Number((data as Record<string, unknown>).account_id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
export function customDateRange(
  from: string,
  to: string,
): { from: string; to: string } | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split("-").map(Number),
      date = new Date(y, m - 1, d);
    return date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
      ? date
      : null;
  };
  const start = parse(from),
    end = parse(to);
  if (
    !start ||
    !end ||
    end < start ||
    (end.getTime() - start.getTime()) / 86400000 > 365
  )
    return null;
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
