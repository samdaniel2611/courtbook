export interface Slot { startsAt: string; label: string; disabled: boolean; }
const dateFormatter = (timeZone: string): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = dateFormatter(timeZone).formatToParts(date);
  const part = (type: string): string => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dateKeyAfterDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function wallTimeToUtc(dateKey: string, hour: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour);
  let candidate = wanted;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const values = new Map(parts.map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(values.get('year') ?? 0, (values.get('month') ?? 1) - 1, values.get('day') ?? 1, values.get('hour') ?? 0, values.get('minute') ?? 0, values.get('second') ?? 0);
    const correction = wanted - represented;
    if (correction === 0) break;
    candidate += correction;
  }
  return new Date(candidate);
}

export function generateSlots(dateString: string, timeZone: string, now: Date): Slot[] {
  const labelFormatter = new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' });
  return Array.from({ length: 24 }, (_, hour) => {
    const instant = wallTimeToUtc(dateString, hour, timeZone);
    return { startsAt: instant.toISOString(), label: labelFormatter.format(instant), disabled: instant.getTime() <= now.getTime() };
  });
}
