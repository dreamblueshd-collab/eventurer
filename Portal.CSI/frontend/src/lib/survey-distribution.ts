"use client";

import { getAccessToken } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api-utils";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;

export type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";

interface ScheduleRequest {
  surveyId: string | number;
  scheduledDate: string;
  emailTemplate: string;
  customMessage?: string;
  customSubject?: string;
  includeQrCode?: boolean;
  recipientEmails?: string[];
  embedCover?: boolean;
  frequency?: ScheduleFrequency;
  scheduledTime?: string;
  dayOfWeek?: number;
}

function toSchedulePayload(input: ScheduleRequest) {
  const frequency: ScheduleFrequency = input.frequency || "once";
  const recipientEmails = Array.isArray(input.recipientEmails)
    ? input.recipientEmails.map((email) => email.trim()).filter(Boolean)
    : [];
  const payload: Record<string, unknown> = {
    scheduledDate: input.scheduledDate,
    emailTemplate: input.emailTemplate,
    embedCover: input.embedCover ?? false,
    frequency,
    targetCriteria: {
      recipientEmails,
      customMessage: (input.customMessage || "").trim(),
      customSubject: (input.customSubject || "").trim(),
      includeQrCode: input.includeQrCode === true,
    },
  };

  if (frequency !== "once" && input.scheduledTime) {
    payload.scheduledTime = input.scheduledTime;
  }

  if (frequency === "weekly" && typeof input.dayOfWeek === "number") {
    payload.dayOfWeek = input.dayOfWeek;
  }

  return payload;
}

export async function generateEventLink(
  surveyId: string | number,
  shortenUrl: boolean,
): Promise<{ success: boolean; surveyLink?: string; shortenedLink?: string | null; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${String(surveyId)}/link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shortenUrl }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: unknown; data?: { surveyLink?: string; shortenedLink?: string | null } }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal generate link") };
    }

    return {
      success: true,
      surveyLink: payload.data?.surveyLink,
      shortenedLink: payload.data?.shortenedLink ?? null,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function scheduleEventBlast(
  input: ScheduleRequest,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${String(input.surveyId)}/schedule-blast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toSchedulePayload(input)),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal schedule blast") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function scheduleEventReminder(
  input: ScheduleRequest,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${String(input.surveyId)}/schedule-reminder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(toSchedulePayload(input)),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal schedule reminder") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
