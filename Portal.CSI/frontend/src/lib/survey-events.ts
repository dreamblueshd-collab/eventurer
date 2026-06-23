"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";
import { API_BASE_PATH, getErrorMessage } from "@/lib/api-utils";
import type { SurveyConfiguration, SurveyDetail, SurveyOverviewItem } from "@/types/survey";

const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;
const SURVEYS_ENDPOINT = `${API_BASE_PATH}/surveys`;

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return "";
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizePositiveIntArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((id) => (typeof id === "number" ? id : Number(String(id).trim())))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function requestJson(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> | null }> {
  const response = await fetch(path, init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? (await response.json().catch(() => null)) as Record<string, unknown> | null
    : null;
  if (response.status === 401) {
    // Centralised handler preserves the current URL (with query
    // string) so the user is returned to the exact same page after
    // re-login.
    redirectToLogin({ reason: "unauthorized" });
  }
  return { ok: response.ok, status: response.status, payload };
}

export async function fetchSurveyOverview(filter?: {
  assignedAdminId?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  surveys: SurveyOverviewItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, surveys: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const query = buildQuery(filter);
    // Try surveys endpoint first for detailed data (StartDate, EndDate, TargetRespondents, etc.)
    const primary = await requestJson(`${SURVEYS_ENDPOINT}${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let resolved = primary;
    if (!primary.ok) {
      // Fallback to events endpoint if surveys fails
      const fallback = await requestJson(`${EVENTS_ENDPOINT}${query}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      resolved = fallback;
    }

    if (!resolved.ok || resolved.payload?.success !== true) {
      return {
        success: false,
        surveys: [],
        message: getErrorMessage(resolved.payload, "Gagal memuat data survey"),
      };
    }

    const surveys = Array.isArray(resolved.payload.data)
      ? (resolved.payload.data as SurveyOverviewItem[])
      : [];

    const normalizedSurveys = surveys.map((survey) => ({
      ...survey,
      AssignedAdminIds: normalizePositiveIntArray((survey as unknown as Record<string, unknown>).AssignedAdminIds),
    }));

    return { success: true, surveys: normalizedSurveys };
  } catch {
    return { success: false, surveys: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchEventsOverview(filter?: {
  assignedAdminId?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  events: SurveyOverviewItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, events: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const query = buildQuery(filter);
    const result = await requestJson(`${EVENTS_ENDPOINT}${query}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!result.ok || result.payload?.success !== true) {
      return {
        success: false,
        events: [],
        message: getErrorMessage(result.payload, "Gagal memuat data events"),
      };
    }

    const events = Array.isArray(result.payload.data)
      ? (result.payload.data as SurveyOverviewItem[])
      : [];

    const normalizedEvents = events.map((event) => ({
      ...event,
      AssignedAdminIds: normalizePositiveIntArray((event as unknown as Record<string, unknown>).AssignedAdminIds),
    }));

    return { success: true, events: normalizedEvents };
  } catch {
    return { success: false, events: [], message: "Gagal terhubung ke server" };
  }
}

export async function createSurveyUnderEvent(
  eventId: string | number,
  input: { title?: string; description?: string } = {},
): Promise<{ success: boolean; surveyId?: number; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const result = await requestJson(`${EVENTS_ENDPOINT}/${String(eventId)}/surveys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: input.title || "Untitled Survey", ...input }),
    });

    if (!result.ok || result.payload?.success !== true) {
      return { success: false, message: getErrorMessage(result.payload, "Gagal membuat survey") };
    }

    const survey = result.payload.data as { SurveyId?: number } | undefined;
    return { success: true, surveyId: survey?.SurveyId };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function createEventDraft(input: {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  assignedAdminId?: number;
  assignedAdminIds?: number[];
  targetRespondents?: number;
  targetScore?: number;
  status?: string;
}): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    let payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;
    let resolvedResponse = response;
    if (response.status === 404) {
      const fallbackResponse = await fetch(SURVEYS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      resolvedResponse = fallbackResponse;
      payload = (await fallbackResponse.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null;
    }

    if (!resolvedResponse.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal membuat event") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchSurveyById(
  surveyId: string | number,
): Promise<{ success: boolean; survey?: SurveyDetail; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const primary = await requestJson(`${SURVEYS_ENDPOINT}/${String(surveyId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    let resolved = primary;
    if (!primary.ok) {
      resolved = await requestJson(`${EVENTS_ENDPOINT}/${String(surveyId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
    }

    if (!resolved.ok || resolved.payload?.success !== true) {
      return {
        success: false,
        message: getErrorMessage(resolved.payload, "Gagal memuat detail event"),
      };
    }

    const survey = resolved.payload.data as SurveyDetail | undefined;
    if (!survey) {
      return { success: false, message: "Detail event tidak ditemukan" };
    }

    const normalizedSurvey: SurveyDetail = {
      ...survey,
      AssignedAdminIds: normalizePositiveIntArray((survey as unknown as Record<string, unknown>).AssignedAdminIds),
    };

    return { success: true, survey: normalizedSurvey };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateEventById(
  surveyId: string | number,
  input: {
    title: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    assignedAdminId?: number;
    assignedAdminIds?: number[];
    targetRespondents?: number;
    targetScore?: number;
    requireApproval?: boolean;
  },
  isParentEvent?: boolean,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const payload: Record<string, unknown> = {
      title: input.title,
    };

    if (input.description !== undefined) {
      payload.description = input.description;
    }
    if (input.status !== undefined) {
      payload.status = input.status;
    }

    if (input.assignedAdminId !== undefined) {
      payload.assignedAdminId = input.assignedAdminId;
    }
    if (input.assignedAdminIds !== undefined) {
      payload.assignedAdminIds = input.assignedAdminIds;
    }
    if (input.startDate !== undefined) {
      payload.startDate = input.startDate;
    }
    if (input.endDate !== undefined) {
      payload.endDate = input.endDate;
    }
    if (input.targetRespondents !== undefined) {
      payload.targetRespondents = input.targetRespondents;
    }
    if (input.targetScore !== undefined) {
      payload.targetScore = input.targetScore;
    }
    if (input.requireApproval !== undefined) {
      payload.requireApproval = input.requireApproval;
    }

    const endpoint = isParentEvent === true
      ? `${EVENTS_ENDPOINT}/${String(surveyId)}`
      : `${SURVEYS_ENDPOINT}/${String(surveyId)}`;

    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menyimpan event") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteEventById(
  surveyId: string | number,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${String(surveyId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    let body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    let resolvedResponse = response;
    if (response.status === 404) {
      const fallbackResponse = await fetch(`${SURVEYS_ENDPOINT}/${String(surveyId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      resolvedResponse = fallbackResponse;
      body = (await fallbackResponse.json().catch(() => null)) as Record<string, unknown> | null;
    }

    if (!resolvedResponse.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menghapus event") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteSurveyById(
  surveyId: string | number,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${SURVEYS_ENDPOINT}/${String(surveyId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menghapus form") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export interface EventDetailSurvey {
  SurveyId: number;
  Title: string;
  Description: string | null;
  SortOrder: number;
  StartDate: string | null;
  EndDate: string | null;
  Status: string;
  TargetRespondents: number | null;
  TargetScore: number | null;
  CurrentScore: number | null;
  SurveyLink: string | null;
  RespondentCount: number;
  QuestionCount: number;
  CreatedAt: string;
}

export interface EventDetailDoorprize {
  DoorprizeEventId: number;
  Name: string;
  EventDate: string | null;
  ImagePath: string | null;
  Status: string;
  GiftCount: number;
  ParticipantCount: number;
  CreatedAt: string;
}

export interface EventDetail {
  EventId: number;
  Title: string;
  Description: string | null;
  AssignedAdminId: number | null;
  AssignedAdminName: string | null;
  AssignedAdminIds?: number[];
  AssignedAdminNames?: string[];
  AssignedAdminUsernames?: string[];
  EventTypeId: number | null;
  RequireApproval: boolean;
  Status: string;
  CreatedAt: string;
  CreatedBy: number | null;
  UpdatedAt: string | null;
  UpdatedBy: number | null;
  Surveys: EventDetailSurvey[];
  Doorprizes?: EventDetailDoorprize[];
}

export async function fetchEventDetail(
  eventId: string | number,
): Promise<{ success: boolean; event?: EventDetail; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const result = await requestJson(`${EVENTS_ENDPOINT}/${String(eventId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!result.ok || result.payload?.success !== true) {
      return {
        success: false,
        message: getErrorMessage(result.payload, "Gagal memuat detail event"),
      };
    }

    const event = result.payload.data as EventDetail | undefined;
    if (!event) {
      return { success: false, message: "Detail event tidak ditemukan" };
    }

    return { success: true, event };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateEventConfiguration(
  surveyId: string,
  input: Partial<SurveyConfiguration>,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const normalizedPayload: Record<string, unknown> = {};

    if (input.HeroTitle !== undefined) normalizedPayload.heroTitle = input.HeroTitle;
    if (input.HeroSubtitle !== undefined) normalizedPayload.heroSubtitle = input.HeroSubtitle;
    if (input.HeroImageUrl !== undefined) normalizedPayload.heroImageUrl = input.HeroImageUrl;
    if (input.LogoUrl !== undefined) normalizedPayload.logoUrl = input.LogoUrl;
    if (input.BackgroundColor !== undefined) normalizedPayload.backgroundColor = input.BackgroundColor;
    if (input.BackgroundImageUrl !== undefined) normalizedPayload.backgroundImageUrl = input.BackgroundImageUrl;
    if (input.PrimaryColor !== undefined) normalizedPayload.primaryColor = input.PrimaryColor;
    if (input.SecondaryColor !== undefined) normalizedPayload.secondaryColor = input.SecondaryColor;
    if (input.FontFamily !== undefined) normalizedPayload.fontFamily = input.FontFamily;
      if (input.ButtonStyle !== undefined) normalizedPayload.buttonStyle = input.ButtonStyle;
      if (input.ShowProgressBar !== undefined) normalizedPayload.showProgressBar = input.ShowProgressBar;
      if (input.ShowPageNumbers !== undefined) normalizedPayload.showPageNumbers = input.ShowPageNumbers;
      if (input.MultiPage !== undefined) normalizedPayload.multiPage = input.MultiPage;
      if (input.HeroImagePositionX !== undefined) normalizedPayload.heroImagePositionX = input.HeroImagePositionX;
      if (input.HeroImagePositionY !== undefined) normalizedPayload.heroImagePositionY = input.HeroImagePositionY;
      if (input.LogoPositionX !== undefined) normalizedPayload.logoPositionX = input.LogoPositionX;
      if (input.LogoPositionY !== undefined) normalizedPayload.logoPositionY = input.LogoPositionY;
      if (input.BackgroundPositionX !== undefined) normalizedPayload.backgroundPositionX = input.BackgroundPositionX;
      if (input.BackgroundPositionY !== undefined) normalizedPayload.backgroundPositionY = input.BackgroundPositionY;

    const response = await fetch(`${SURVEYS_ENDPOINT}/${surveyId}/config`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedPayload),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menyimpan konfigurasi") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function uploadSurveyStyleImage(
  surveyId: string | number,
  imageType: "hero" | "logo" | "background",
  file: File,
): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const formData = new FormData();
    formData.append("image", file, file.name);

    const response = await fetch(
      `${API_BASE_PATH}/surveys/${String(surveyId)}/upload/${imageType}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: { imageUrl?: string }; message?: string; error?: unknown }
      | null;

    if (!response.ok || body?.success !== true || !body.data?.imageUrl) {
      return { success: false, message: getErrorMessage(body, "Gagal upload gambar") };
    }

    return { success: true, imageUrl: body.data.imageUrl };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
