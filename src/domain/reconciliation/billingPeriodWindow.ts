/** Billing dates are inclusive South African calendar dates. Explicit timestamps retain their offsets. */
export function billingPeriodWindow(start?: string, end?: string) {
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/;
  const boundary = (value: string) =>
    Date.parse(dayOnly.test(value) ? `${value}T00:00:00+02:00` : value);

  const lower = start ? boundary(start) : -Infinity;
  const exclusiveEnd = Boolean(end && dayOnly.test(end));
  const upper = end ? boundary(end) + (exclusiveEnd ? 86_400_000 : 0) : Infinity;

  return (timestamp: number) =>
    Number.isFinite(timestamp) &&
    timestamp >= lower &&
    (exclusiveEnd ? timestamp < upper : timestamp <= upper);
}
