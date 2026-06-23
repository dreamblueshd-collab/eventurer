"use client";

import { getAccessToken, getCurrentUser, redirectToLogin } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export interface ReportSelectionItem {
  surveyId: string;
  title: string;
  description?: string | null;
  period?: string | null;
  status: string;
  respondentCount: number;
  hasGeneratedReport: boolean;
  currentPublishCycleId?: string | null;
  currentCycleNumber?: number | null;
  generatedAt?: string | null;
  eventTitle?: string | null;
}

export interface GeneratedReport {
  survey: {
    surveyId: string;
    title: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
    status?: string;
  };
  statistics: {
    totalResponses: number;
    uniqueRespondents: number;
    averageRating: number | null;
    minRating: number | null;
    maxRating: number | null;
    takenOutCount: number;
    activeCount: number;
    proposedCount: number;
  };
  responses: Array<{
    ResponseId: string;
    RespondentEmail: string;
    RespondentName: string;
    SubmittedAt: string;
    BusinessUnitName: string;
    DivisionName: string;
    DepartmentName: string;
    FunctionName?: string | null;
    ApplicationName: string;
    PromptText: string;
    QuestionType: string;
    TextValue?: string | null;
    NumericValue?: number | null;
    DateValue?: string | null;
    MatrixValues?: string | null;
    CommentValue?: string | null;
    TakeoutStatus?: string | null;
  }>;
  ratingDistribution: Array<{
    Rating: number;
    Count: number;
  }>;
}

export interface TakeoutComparisonRow {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  takeoutCount: number;
  avgScoreBefore: number | null;
  avgScoreAfter: number | null;
  takeoutReasons: string;
}

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  const err = data.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

function parseFilenameFromDisposition(headerValue: string | null, fallback: string): string {
  const input = String(headerValue || "");
  const utf8Match = input.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const basicMatch = input.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) return basicMatch[1];
  return fallback;
}

export async function fetchReportSelectionList(): Promise<{
  success: boolean;
  surveys: ReportSelectionItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, surveys: [], message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/reports/selection-list`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: ReportSelectionItem[]; message?: string; error?: unknown }
      | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, surveys: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || payload?.success !== true || !Array.isArray(payload.data)) {
      return { success: false, surveys: [], message: extractError(payload, "Gagal memuat data report") };
    }

    return { success: true, surveys: payload.data };
  } catch {
    return { success: false, surveys: [], message: "Gagal terhubung ke server" };
  }
}

export async function generateSurveyReport(input: {
  surveyId: string;
  includeTakenOut?: boolean;
  businessUnitId?: string;
  divisionId?: string;
  departmentId?: string;
  functionId?: string;
  applicationId?: string;
}): Promise<{ success: boolean; report?: GeneratedReport; message?: string }> {
  const token = getAccessToken();
  const user = getCurrentUser();
  if (!token || !user) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/reports/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        includeTakenOut: input.includeTakenOut ?? false,
        userId: String(user.userId),
        userRole: user.role,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: GeneratedReport; message?: string; error?: unknown }
      | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || payload?.success !== true || !payload.data) {
      return { success: false, message: extractError(payload, "Gagal generate report") };
    }

    return { success: true, report: payload.data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchSurveyReport(input: {
  surveyId: string;
  includeTakenOut?: boolean;
  businessUnitId?: string;
  divisionId?: string;
  departmentId?: string;
  functionId?: string;
  applicationId?: string;
}): Promise<{ success: boolean; report?: GeneratedReport; message?: string }> {
  const token = getAccessToken();
  const user = getCurrentUser();
  if (!token || !user) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/reports/view`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...input,
        includeTakenOut: input.includeTakenOut ?? false,
        userId: String(user.userId),
        userRole: user.role,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: GeneratedReport; message?: string; error?: unknown }
      | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || payload?.success !== true || !payload.data) {
      return { success: false, message: extractError(payload, "Gagal memuat report") };
    }

    return { success: true, report: payload.data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchTakeoutComparison(input: {
  surveyId: string;
  functionId?: string;
}): Promise<{ success: boolean; comparison: TakeoutComparisonRow[]; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, comparison: [], message: "Sesi login tidak ditemukan" };

  try {
    const query = new URLSearchParams();
    if (input.functionId) query.set("functionId", input.functionId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(`${API_BASE_PATH}/reports/takeout-comparison/${encodeURIComponent(input.surveyId)}${suffix}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: TakeoutComparisonRow[]; message?: string; error?: unknown }
      | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, comparison: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || payload?.success !== true || !Array.isArray(payload.data)) {
      return { success: false, comparison: [], message: extractError(payload, "Gagal memuat data takeout comparison") };
    }
    return { success: true, comparison: payload.data };
  } catch {
    return { success: false, comparison: [], message: "Gagal terhubung ke server" };
  }
}

export async function exportSurveyReport(input: {
  surveyId: string;
  format: "excel" | "pdf";
  includeTakenOut?: boolean;
}): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  const token = getAccessToken();
  const user = getCurrentUser();
  if (!token || !user) return { success: false, message: "Sesi login tidak ditemukan" };

  const endpoint = input.format === "excel" ? "excel" : "pdf";
  try {
    const response = await fetch(`${API_BASE_PATH}/reports/export/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId: input.surveyId,
        includeTakenOut: input.includeTakenOut ?? false,
        userId: String(user.userId),
        userRole: user.role,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        redirectToLogin({ reason: "unauthorized" });
        return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
      }
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      return { success: false, message: extractError(payload, "Gagal export report") };
    }

    const blob = await response.blob();
    const fallbackFilename = input.format === "excel" ? "report.xlsx" : "report.pdf";
    const filename = parseFilenameFromDisposition(response.headers.get("Content-Disposition"), fallbackFilename);
    return { success: true, blob, filename };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
