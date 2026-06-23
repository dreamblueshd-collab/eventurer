"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type ApprovalRespondent = {
  ResponseId: number;
  RespondentEmail: string;
  RespondentName: string;
  ApplicationId: number;
  ApplicationName: string;
  DepartmentId: number;
  DepartmentName: string;
  SubmittedAt: string;
  ResponseApprovalStatus?: string;
  DuplicateCount: number;
  IsDuplicate: boolean;
  SurveyTitle?: string | null;
  EventTitle?: string | null;
};

export type ApprovalTakeout = {
  QuestionResponseId: number;
  ResponseId: number;
  QuestionId: number;
  CommentValue?: string | null;
  NumericValue?: number | null;
  TakeoutStatus?: string | null;
  TakeoutReason?: string | null;
  ProposedAt?: string | null;
  QuestionText?: string | null;
  RespondentEmail?: string | null;
  RespondentName?: string | null;
  ApplicationName?: string | null;
  DepartmentName?: string | null;
  SurveyId?: number | null;
  SurveyTitle?: string | null;
  EventTitle?: string | null;
  FunctionId?: number | null;
  FunctionName?: string | null;
  ProposedByName?: string | null;
};

export type PendingApproval = {
  QuestionResponseId: number;
  ResponseId: number;
  QuestionId: number;
  TextValue?: string | null;
  NumericValue?: number | null;
  CommentValue?: string | null;
  TakeoutStatus?: string | null;
  TakeoutReason?: string | null;
  ProposedAt?: string | null;
  QuestionText?: string | null;
  RespondentEmail?: string | null;
  RespondentName?: string | null;
  ApplicationName?: string | null;
  DepartmentName?: string | null;
  SurveyTitle?: string | null;
  EventTitle?: string | null;
  FunctionId?: number | null;
  FunctionName?: string | null;
  ProposedByName?: string | null;
  SubmittedAt?: string | null;
};

export type ApprovalComment = {
  QuestionResponseId: number;
  ResponseId: number;
  QuestionId: number;
  CommentValue?: string | null;
  NumericValue?: number | null;
  IsBestComment?: boolean;
  QuestionText?: string | null;
  QuestionOrder?: number | null;
  RespondentEmail?: string | null;
  RespondentName?: string | null;
  SubmittedAt?: string | null;
  ApplicationId?: number | null;
  ApplicationName?: string | null;
  DepartmentId?: number | null;
  DepartmentName?: string | null;
  SurveyId?: number | null;
  SurveyTitle?: string | null;
  EventTitle?: string | null;
  FunctionId?: number | null;
  FunctionName?: string | null;
};

export type BestCommentWithFeedback = {
  QuestionResponseId: number;
  ResponseId?: number | null;
  QuestionId?: number | null;
  CommentValue?: string | null;
  NumericValue?: number | null;
  IsBestComment?: boolean;
  QuestionText?: string | null;
  QuestionOrder?: number | null;
  RespondentEmail?: string | null;
  RespondentName?: string | null;
  ApplicationName?: string | null;
  DepartmentName?: string | null;
  SubmittedAt?: string | null;
  SurveyId?: number | null;
  SurveyTitle?: string | null;
  EventTitle?: string | null;
  FeedbackText?: string | null;
  FeedbackCreatedAt?: string | null;
  ITLeadName?: string | null;
  FunctionId?: number | null;
  FunctionName?: string | null;
};

function extractError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  const err = data.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (Array.isArray(e.details)) {
      const first = e.details.find((d) => d && typeof d === "object" && "msg" in d) as { msg?: unknown } | undefined;
      if (first && typeof first.msg === "string" && first.msg.trim()) return first.msg;
    }
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

async function getJson<T>(endpoint: string, fallbackMessage: string): Promise<ApiResult<T>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: extractError(payload, fallbackMessage) };
    }
    return { success: true, data: (payload?.data ?? null) as T };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

async function mutateJson(
  endpoint: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<ApiResult<Record<string, unknown>>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: extractError(payload, fallbackMessage) };
    }
    return { success: true, data: (payload?.data ?? {}) as Record<string, unknown> };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function fetchApprovalRespondents(input: {
  surveyId: number | string;
  duplicateFilter?: "all" | "duplicate" | "unique";
  applicationId?: number | string;
  departmentId?: number | string;
}): Promise<ApiResult<ApprovalRespondent[]>> {
  const query = toQuery({
    surveyId: input.surveyId,
    duplicateFilter: input.duplicateFilter || "all",
    applicationId: input.applicationId,
    departmentId: input.departmentId,
  });
  const result = await getJson<ApprovalRespondent[]>(
    `/approvals/respondents${query}`,
    "Gagal memuat responden"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function approveInitialResponses(input: {
  responseIds: number[];
  reason?: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/respondents/approve", "POST", input, "Gagal approve response awal");
}

export async function rejectInitialResponses(input: {
  responseIds: number[];
  reason: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/respondents/reject", "POST", input, "Gagal reject response awal");
}

export async function fetchProposedTakeouts(input: {
  surveyId?: number | string;
  functionId?: number | string;
  applicationId?: number | string;
  departmentId?: number | string;
  status?: string;
}): Promise<ApiResult<ApprovalTakeout[]>> {
  const query = toQuery({
    surveyId: input.surveyId,
    functionId: input.functionId,
    applicationId: input.applicationId,
    departmentId: input.departmentId,
    status: input.status,
  });
  const result = await getJson<ApprovalTakeout[]>(
    `/approvals/proposed-takeouts${query}`,
    "Gagal memuat proposed takeout"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function fetchMyFunctions(): Promise<ApiResult<Array<{ FunctionId: number; Name: string }>>> {
  const result = await getJson<Array<{ FunctionId: number; Name: string }>>(
    `/functions?myFunctionsOnly=true`,
    "Gagal memuat function"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function fetchPendingApprovals(input?: {
  surveyId?: number | string;
  functionId?: number | string;
}): Promise<ApiResult<PendingApproval[]>> {
  const query = toQuery({
    surveyId: input?.surveyId,
    functionId: input?.functionId,
  });
  const result = await getJson<PendingApproval[]>(
    `/approvals/pending${query}`,
    "Gagal memuat pending approvals"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function fetchCommentsForSelection(input: {
  surveyId?: number | string;
  functionId?: number | string;
  departmentId?: number | string;
  applicationId?: number | string;
}): Promise<ApiResult<ApprovalComment[]>> {
  const query = toQuery({
    surveyId: input.surveyId,
    functionId: input.functionId,
    departmentId: input.departmentId,
    applicationId: input.applicationId,
  });
  const result = await getJson<ApprovalComment[]>(
    `/approvals/comments${query}`,
    "Gagal memuat daftar komentar"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function fetchBestComments(input: {
  surveyId?: number | string;
  functionId?: number | string;
}): Promise<ApiResult<ApprovalComment[]>> {
  const query = toQuery({
    surveyId: input.surveyId,
    functionId: input.functionId,
  });
  const result = await getJson<ApprovalComment[]>(
    `/approvals/best-comments${query}`,
    "Gagal memuat best comments"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function fetchBestCommentsWithFeedback(input: {
  surveyId?: number | string;
  functionId?: number | string;
  departmentId?: number | string;
}): Promise<ApiResult<BestCommentWithFeedback[]>> {
  const query = toQuery({
    surveyId: input.surveyId,
    functionId: input.functionId,
    departmentId: input.departmentId,
  });
  const result = await getJson<BestCommentWithFeedback[]>(
    `/approvals/best-comments-with-feedback${query}`,
    "Gagal memuat best comments feedback"
  );
  if (!result.success) return result;
  return { success: true, data: result.data || [] };
}

export async function markBestComment(input: {
  responseId: number;
  questionId: number;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/best-comments", "POST", input, "Gagal menyimpan best comment");
}

export async function unmarkBestComment(input: {
  responseId: number;
  questionId: number;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/best-comments", "DELETE", input, "Gagal menghapus best comment");
}

export async function approveTakeout(input: {
  responseId: number;
  questionId: number;
  reason?: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/approve", "POST", input, "Gagal approve takeout");
}

export async function rejectTakeout(input: {
  responseId: number;
  questionId: number;
  reason: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/reject", "POST", input, "Gagal reject takeout");
}

export async function proposeTakeout(input: {
  responseId: number;
  questionId: number;
  reason: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/propose-takeout", "POST", input, "Gagal propose takeout");
}

export async function approveFinalResponses(input: {
  responseIds: number[];
  reason?: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/respondents/final-approve", "POST", input, "Gagal approve final response");
}

export async function submitBestCommentFeedback(input: {
  questionResponseId?: number;
  responseId?: number;
  questionId?: number;
  feedbackText: string;
}): Promise<ApiResult<Record<string, unknown>>> {
  return mutateJson("/approvals/best-comments/feedback", "POST", input, "Gagal mengirim feedback");
}
