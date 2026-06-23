import styles from "../approval.module.css";

export function mapApprovalStatus(value?: string | null): { label: string; tone: string } {
  switch (value) {
    case "PendingITLead":
      return { label: "Pending IT Lead", tone: styles.pillBest };
    case "RejectedByAdmin":
      return { label: "Rejected", tone: styles.pillDuplicate };
    case "ApprovedFinal":
      return { label: "Approved Final", tone: styles.pillUnique };
    case "PendingAdminTakeoutDecision":
      return { label: "Pending Takeout", tone: styles.pillDuplicate };
    default:
      return { label: "Submitted", tone: styles.pillNo };
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toCsvValue(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function toSafeFileStem(value?: string | null, fallback = "survey"): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function getRespondentAriaLabel(row: {
  RespondentName?: string | null;
  RespondentEmail?: string | null;
  DepartmentName?: string | null;
  ApplicationName?: string | null;
}): string {
  const primary = String(row.RespondentName || row.RespondentEmail || "").trim();
  if (primary) return `Pilih responden ${primary}`;
  const secondary = [row.DepartmentName, row.ApplicationName].map((value) => String(value || "").trim()).filter(Boolean).join(" - ");
  return secondary ? `Pilih responden ${secondary}` : "Pilih responden";
}

export function getTakeoutAriaLabel(row: {
  QuestionText?: string | null;
  ApplicationName?: string | null;
}): string {
  const question = String(row.QuestionText || "").trim();
  const application = String(row.ApplicationName || "").trim();
  if (question && application) return `Pilih proposed takeout ${question} - ${application}`;
  if (question) return `Pilih proposed takeout ${question}`;
  if (application) return `Pilih proposed takeout ${application}`;
  return "Pilih proposed takeout";
}
