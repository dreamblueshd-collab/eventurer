"use client";

import { getAccessToken } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { getApiErrorMessage } from "@/lib/api-client";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type BlastRecipient = {
  name?: string;
  email: string;
};

export type SendEmailBlastInput = {
  subject: string;
  message: string;
  recipients: BlastRecipient[];
  includeQrCode?: boolean;
  includeSurveyButton?: boolean;
  surveyLink?: string;
  buttonLabel?: string;
  includeCalendarInvite: boolean;
  eventTitle?: string;
  location?: string;
  teamsLink?: string;
  startAt?: string;
  endAt?: string;
  file?: File | null;
};

export async function sendStandaloneEmailBlast(input: SendEmailBlastInput): Promise<{
  success: boolean;
  message: string;
  total?: number;
  sent?: number;
  failed?: number;
  errors?: Array<{ email: string; error: string }>;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  const form = new FormData();
  form.append("subject", input.subject);
  form.append("message", input.message);
  form.append("recipients", JSON.stringify(input.recipients || []));
  form.append("includeQrCode", String(input.includeQrCode === true));
  form.append("includeSurveyButton", String(input.includeSurveyButton === true));
  if (input.surveyLink) form.append("surveyLink", input.surveyLink);
  if (input.buttonLabel) form.append("buttonLabel", input.buttonLabel);
  form.append("includeCalendarInvite", String(input.includeCalendarInvite));
  if (input.eventTitle) form.append("eventTitle", input.eventTitle);
  if (input.location) form.append("location", input.location);
  if (input.teamsLink) form.append("teamsLink", input.teamsLink);
  if (input.startAt) form.append("startAt", input.startAt);
  if (input.endAt) form.append("endAt", input.endAt);
  if (input.file) form.append("file", input.file);

  try {
    const response = await fetchWithAuth(`${API_BASE_PATH}/emails/blast-standalone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          meta?: { message?: string };
          data?: { total?: number; sent?: number; failed?: number; errors?: Array<{ email: string; error: string }> };
          error?: unknown;
        }
      | null;

    if (!response.ok || payload?.success !== true) {
      return {
        success: false,
        message: getApiErrorMessage(payload, "Gagal mengirim email blast"),
      };
    }

    return {
      success: true,
      message: payload.meta?.message || "Email blast berhasil dikirim",
      total: payload.data?.total,
      sent: payload.data?.sent,
      failed: payload.data?.failed,
      errors: payload.data?.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export type ScheduleStandaloneBlastInput = {
  subject: string;
  message: string;
  recipients: BlastRecipient[];
  scheduledDate: string;
  scheduledTime?: string;
  frequency: "once" | "daily" | "weekly" | "monthly";
  dayOfWeek?: number;
  includeQrCode?: boolean;
  includeSurveyButton?: boolean;
  surveyLink?: string;
  buttonLabel?: string;
  includeCalendarInvite: boolean;
  eventTitle?: string;
  location?: string;
  teamsLink?: string;
  startAt?: string;
  endAt?: string;
  file?: File | null;
};

/**
 * Schedule a standalone email blast.
 * Uses POST /emails/schedule-standalone endpoint.
 */
export async function scheduleStandaloneEmailBlast(input: ScheduleStandaloneBlastInput): Promise<{
  success: boolean;
  message: string;
  operation?: {
    operationId: number;
    operationType: string;
    frequency: string;
    scheduledDate: string;
    status: string;
    nextExecutionAt: string;
  };
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  const form = new FormData();
  form.append("subject", input.subject);
  form.append("message", input.message);
  form.append("recipients", JSON.stringify(input.recipients || []));
  form.append("scheduledDate", input.scheduledDate);
  if (input.scheduledTime) form.append("scheduledTime", input.scheduledTime);
  form.append("frequency", input.frequency);
  if (input.dayOfWeek !== undefined) form.append("dayOfWeek", String(input.dayOfWeek));
  form.append("includeQrCode", String(input.includeQrCode === true));
  form.append("includeSurveyButton", String(input.includeSurveyButton === true));
  if (input.surveyLink) form.append("surveyLink", input.surveyLink);
  if (input.buttonLabel) form.append("buttonLabel", input.buttonLabel);
  form.append("includeCalendarInvite", String(input.includeCalendarInvite));
  if (input.eventTitle) form.append("eventTitle", input.eventTitle);
  if (input.location) form.append("location", input.location);
  if (input.teamsLink) form.append("teamsLink", input.teamsLink);
  if (input.startAt) form.append("startAt", input.startAt);
  if (input.endAt) form.append("endAt", input.endAt);
  if (input.file) form.append("file", input.file);

  try {
    const response = await fetchWithAuth(`${API_BASE_PATH}/emails/schedule-standalone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; meta?: { message?: string }; data?: unknown; error?: unknown }
      | null;

    if (!response.ok || payload?.success !== true) {
      return {
        success: false,
        message: getApiErrorMessage(payload, "Gagal menjadwalkan email blast"),
      };
    }

    return {
      success: true,
      message: payload.meta?.message || "Email blast berhasil dijadwalkan",
      operation: payload.data as ScheduleStandaloneBlastInput extends never ? never : {
        operationId: number;
        operationType: string;
        frequency: string;
        scheduledDate: string;
        status: string;
        nextExecutionAt: string;
      },
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export type SendSurveyBlastInput = {
  surveyId: string | number;
  customSubject?: string;
  customMessage?: string;
  includeQrCode?: boolean;
  embedCover?: boolean;
  recipientEmails?: string[];
  disableDuplicateCheck?: boolean;
  buttonLabel?: string;
  primaryColor?: string;
  showPeriod?: boolean;
  showBadge?: boolean;
  badgeText?: string;
  showButton?: boolean;
  showLinkFallback?: boolean;
};

export type SendSurveyReminderInput = {
  surveyId: string | number;
  customSubject?: string;
  customMessage?: string;
  recipientEmails?: string[];
  embedCover?: boolean;
  buttonLabel?: string;
  primaryColor?: string;
};

type BlastResult = {
  success: boolean;
  message: string;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  errors?: Array<{ email: string; error: string }>;
};

/**
 * Send immediate survey blast using EJS template (survey-invitation).
 * Uses POST /emails/blast endpoint.
 */
export async function sendSurveyBlast(input: SendSurveyBlastInput): Promise<BlastResult> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetchWithAuth(`${API_BASE_PATH}/emails/blast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId: input.surveyId,
        customSubject: input.customSubject || "",
        customMessage: input.customMessage || "",
        includeQrCode: input.includeQrCode === true,
        embedCover: input.embedCover === true,
        recipientEmails: input.recipientEmails || [],
        disableDuplicateCheck: input.disableDuplicateCheck === true,
        buttonLabel: input.buttonLabel || "",
        primaryColor: input.primaryColor || "",
        showPeriod: input.showPeriod !== false,
        showBadge: input.showBadge !== false,
        badgeText: input.badgeText || "",
        showButton: input.showButton !== false,
        showLinkFallback: input.showLinkFallback !== false,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; meta?: { message?: string }; data?: { total?: number; sent?: number; failed?: number; skipped?: number; errors?: Array<{ email: string; error: string }> }; error?: unknown }
      | null;

    if (!response.ok || payload?.success !== true) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal mengirim survey blast") };
    }

    return {
      success: true,
      message: payload.meta?.message || "Survey blast berhasil dikirim",
      total: payload.data?.total,
      sent: payload.data?.sent,
      failed: payload.data?.failed,
      skipped: payload.data?.skipped,
      errors: payload.data?.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

/**
 * Send immediate survey reminder using EJS template (survey-reminder).
 * Uses POST /emails/reminders endpoint.
 * If recipientEmails is empty, backend auto-detects non-respondents.
 */
export async function sendSurveyReminder(input: SendSurveyReminderInput): Promise<BlastResult> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetchWithAuth(`${API_BASE_PATH}/emails/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId: input.surveyId,
        customSubject: input.customSubject || "",
        customMessage: input.customMessage || "",
        recipientEmails: input.recipientEmails || [],
        embedCover: input.embedCover === true,
        buttonLabel: input.buttonLabel || "",
        primaryColor: input.primaryColor || "",
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; meta?: { message?: string }; data?: { total?: number; sent?: number; failed?: number; skipped?: number; errors?: Array<{ email: string; error: string }> }; error?: unknown }
      | null;

    if (!response.ok || payload?.success !== true) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal mengirim reminder") };
    }

    return {
      success: true,
      message: payload.meta?.message || "Reminder berhasil dikirim",
      total: payload.data?.total,
      sent: payload.data?.sent,
      failed: payload.data?.failed,
      skipped: payload.data?.skipped,
      errors: payload.data?.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
