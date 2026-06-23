import type { SurveyOverviewItem } from "@/types/survey";

type EventStatusSource = Pick<SurveyOverviewItem, "Status" | "StartDate" | "EndDate">;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T").replace(/Z$/i, "");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d+))?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute = "0", second = "0", fraction = "0"] = match;
  const milliseconds = Number(String(fraction).slice(0, 3).padEnd(3, "0"));
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function hasMeaningfulTime(date: Date): boolean {
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

export function resolveEventStatus(event: EventStatusSource, now: Date = new Date()): string {
  const rawStatus = String(event.Status || "").trim();
  const normalized = rawStatus.toLowerCase();
  const endDate = parseDate(event.EndDate);

  if (normalized === "archived") return "Archived";
  if (normalized === "closed") return "Closed";
  if (normalized === "draft") return "Draft";
  if (normalized === "in design") return "In Design";

  if (normalized === "active") {
    if (endDate && endDate.getTime() <= now.getTime()) {
      return "Closed";
    }
    return "Active";
  }

  if (endDate && endDate.getTime() <= now.getTime()) {
    return "Closed";
  }

  return rawStatus || "-";
}

export function getEventStatusLabel(status: string): string {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized === "draft") return "Draft";
  if (normalized === "in design") return "In Design";
  if (normalized === "active") return "Active";
  if (normalized === "closed") return "Closed";
  if (normalized === "archived") return "Archived";
  return status;
}

export function canPublishEvent(endDateValue?: string | null, now: Date = new Date()): boolean {
  const endDate = parseDate(endDateValue);
  if (!endDate) return true;
  return endDate.getTime() > now.getTime();
}

export function formatEventPeriod(startDateValue?: string | null, endDateValue?: string | null): string {
  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue);

  if (!startDate || !endDate) return "-";

  const withTime = hasMeaningfulTime(startDate) || hasMeaningfulTime(endDate);
  const format = new Intl.DateTimeFormat("id-ID", withTime
    ? {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  return `${format.format(startDate)} - ${format.format(endDate)}`;
}

export function formatEventPeriodParts(startDateValue?: string | null, endDateValue?: string | null): { start: string; end: string } | null {
  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue);

  if (!startDate || !endDate) return null;

  const withTime = hasMeaningfulTime(startDate) || hasMeaningfulTime(endDate);
  const format = new Intl.DateTimeFormat("id-ID", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });

  return { start: format.format(startDate), end: format.format(endDate) };
}
