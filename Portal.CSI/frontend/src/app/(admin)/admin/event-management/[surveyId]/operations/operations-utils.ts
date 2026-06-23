import type { ScheduleFrequency } from "@/lib/surveys";
import styles from "./operations.module.css";

export type DayOfWeekValue = "0" | "1" | "2" | "3" | "4" | "5" | "6";

export interface ScheduledOperation {
  operationId: number;
  operationType: string;
  frequency: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  dayOfWeek?: number | null;
  status: string;
}

export function parseRecipients(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateScheduleInput(input: {
  date: string;
  time: string;
  frequency: ScheduleFrequency;
  recipients: string[];
  dayOfWeek?: DayOfWeekValue;
}): string | null {
  if (!input.date || !input.time) {
    return "Tanggal dan waktu wajib diisi";
  }

  if (input.frequency === "weekly" && (input.dayOfWeek === undefined || input.dayOfWeek === null)) {
    return "Hari wajib diisi untuk recurring mingguan";
  }

  const invalidRecipients = input.recipients.filter((email) => !isValidEmail(email));
  if (invalidRecipients.length > 0) {
    return `Format email tidak valid: ${invalidRecipients[0]}`;
  }

  const now = new Date();
  const scheduleDate = new Date(`${input.date}T${input.time}:00+07:00`);
  if (Number.isNaN(scheduleDate.getTime())) {
    return "Format tanggal/waktu tidak valid";
  }

  if (input.frequency === "once" && scheduleDate <= now) {
    return "Jadwal once harus lebih besar dari waktu saat ini";
  }

  const startDateOnly = new Date(`${input.date}T00:00:00+07:00`);
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (input.frequency !== "once" && startDateOnly < todayDateOnly) {
    return "Start date recurring tidak boleh di masa lalu";
  }

  return null;
}

export function formatOperationDate(date?: string | null, time?: string | null) {
  const raw = date || "";
  if (!raw) return "-";
  const parsed = time ? new Date(`${raw}T${time}+07:00`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function getStatusBadge(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending") return styles.badgePending;
  if (normalized === "completed") return styles.badgeCompleted;
  if (normalized === "failed") return styles.badgeFailed;
  return styles.badgeCancelled;
}

export function toDownloadFileStem(value?: string | null, fallback = "survey") {
  const stem = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem || fallback;
}
