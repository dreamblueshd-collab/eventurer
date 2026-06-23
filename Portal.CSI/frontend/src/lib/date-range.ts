const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateParts(value: string): {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
} | null {
  const normalized = String(value)
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "T")
    .replace(/(?:Z|[+-]\d{2}:\d{2})$/i, "");

  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second, fraction] = match;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: hour !== undefined ? Number(hour) : undefined,
    minute: minute !== undefined ? Number(minute) : undefined,
    second: second !== undefined ? Number(second) : undefined,
    millisecond: fraction !== undefined
      ? Number(String(fraction).slice(0, 3).padEnd(3, "0"))
      : undefined,
  };
}

export function parseLocalDate(value?: string | null, boundary: "start" | "end" = "start"): Date | null {
  if (!value) return null;

  const parts = parseDateParts(value);
  if (!parts) return null;

  const hasTime = parts.hour !== undefined;
  const hour = hasTime ? parts.hour! : boundary === "end" ? 23 : 0;
  const minute = hasTime ? parts.minute! : boundary === "end" ? 59 : 0;
  const second = hasTime ? parts.second! : boundary === "end" ? 59 : 0;
  const millisecond = hasTime ? (parts.millisecond ?? 0) : boundary === "end" ? 999 : 0;

  const parsed = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
    second,
    millisecond,
  );

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatLocalDateInputValue(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function isDateRangeExceeded(start: string, end: string, maxDays: number): boolean {
  if (!start || !end) return false;
  const startDate = parseLocalDate(start, "start");
  const endDate = parseLocalDate(end, "end");
  if (!startDate || !endDate) return false;
  return (endDate.getTime() - startDate.getTime()) / DAY_MS > maxDays;
}

export function clampEndDate(start: string, maxDays: number): string {
  const startDate = parseLocalDate(start, "start");
  if (!startDate) return "";

  const maxDate = new Date(startDate.getTime() + maxDays * DAY_MS);
  return formatLocalDateInputValue(maxDate);
}

export function matchesInclusiveDateRange(
  itemStart?: string | null,
  itemEnd?: string | null,
  filterStart?: string,
  filterEnd?: string,
): boolean {
  if (!itemStart || !itemEnd) return true;

  const startDate = parseLocalDate(filterStart, "start");
  const endDate = parseLocalDate(filterEnd, "end");
  const rangeStart = parseLocalDate(itemStart, "start");
  const rangeEnd = parseLocalDate(itemEnd, "end");

  if (!startDate || !endDate || !rangeStart || !rangeEnd) return true;
  return rangeStart >= startDate && rangeEnd <= endDate;
}
