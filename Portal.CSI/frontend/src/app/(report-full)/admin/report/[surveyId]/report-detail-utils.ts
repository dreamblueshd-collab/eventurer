import type { ReportSelectionItem } from "@/lib/reports";

export function normalizeRole(input: string | null | undefined): string {
  return String(input || "").toLowerCase().replace(/[\s_-]/g, "");
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function fmtScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

export function fmtTarget(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(1);
}

export function safeLabel(input: string | null | undefined, fallback = "-"): string {
  const value = String(input || "").trim();
  return value || fallback;
}

export function formatDateTime(value: string | null | undefined): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function subscribeToClientReady(callback: () => void): () => void {
  // Use a no-op since we handle client-ready via useEffect in the component.
  // The window "load" event may already have fired by the time this is called
  // in Next.js App Router, making it unreliable. Components should use
  // useEffect with an isMounted flag instead.
  if (typeof window === "undefined") return () => {};
  // If document is already complete, fire immediately via microtask
  if (document.readyState === "complete") {
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
  }
  window.addEventListener("load", callback);
  return () => window.removeEventListener("load", callback);
}

export function resolveReportTitle(
  reportTitle: string | null | undefined,
  surveyItem: ReportSelectionItem | null,
): string {
  return safeLabel(reportTitle || surveyItem?.title, "Survey");
}
