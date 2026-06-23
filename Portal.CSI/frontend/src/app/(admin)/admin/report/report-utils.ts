import type { ReportSelectionItem } from "@/lib/reports";

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

export function mapSelectionStatus(
  item: ReportSelectionItem,
): "generated" | "active" | "draft" | "closed" | "archived" | "other" {
  if (item.hasGeneratedReport) return "generated";
  const normalized = String(item.status || "").toLowerCase();
  if (normalized === "generated") return "generated";
  if (normalized === "active") return "active";
  if (normalized === "draft") return "draft";
  if (normalized === "closed") return "closed";
  if (normalized === "archived") return "archived";
  return "other";
}

export function normalizeRole(input: string | null | undefined): string {
  return String(input || "").toLowerCase().replace(/[\s_-]/g, "");
}
