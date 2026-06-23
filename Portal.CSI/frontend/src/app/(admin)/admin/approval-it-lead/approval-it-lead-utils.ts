export function shortText(value?: string | null, max = 80): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function mapError(res: Array<{ success: boolean; message?: string }>): string {
  const firstFailed = res.find((item) => !item.success);
  if (!firstFailed) return "";
  return firstFailed.message || "Terjadi kesalahan saat proses approval";
}

export function getPendingReviewAriaLabel(row: {
  QuestionText?: string | null;
  ApplicationName?: string | null;
  DepartmentName?: string | null;
}): string {
  const question = String(row.QuestionText || "").trim();
  const application = String(row.ApplicationName || "").trim();
  const department = String(row.DepartmentName || "").trim();
  if (question && application) return `Pilih review ${question} - ${application}`;
  if (question && department) return `Pilih review ${question} - ${department}`;
  if (question) return `Pilih review ${question}`;
  if (application) return `Pilih review ${application}`;
  return "Pilih review";
}

export function getFeedbackAriaLabel(row: {
  QuestionText?: string | null;
  ApplicationName?: string | null;
}): string {
  const question = String(row.QuestionText || "").trim();
  const application = String(row.ApplicationName || "").trim();
  if (question && application) return `Feedback IT Lead untuk ${question} - ${application}`;
  if (question) return `Feedback IT Lead untuk ${question}`;
  if (application) return `Feedback IT Lead untuk ${application}`;
  return "Feedback IT Lead";
}
