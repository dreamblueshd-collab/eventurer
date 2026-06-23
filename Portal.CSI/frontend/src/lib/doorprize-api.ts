"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";
import { API_BASE_PATH } from "@/lib/api-utils";
import type {
  DoorprizeEvent,
  DoorprizeGift,
  DoorprizeParticipant,
  DoorprizeResult,
  DrawState,
  DrawResponse,
  ImportResult,
} from "@/types/doorprize";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

interface PaginatedEvents {
  events: DoorprizeEvent[];
  total: number;
  page: number;
  limit: number;
}

interface PaginatedParticipants {
  participants: DoorprizeParticipant[];
  total: number;
  page: number;
  limit: number;
}

export type { ApiResult, PaginatedEvents, PaginatedParticipants };

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  const err = data.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
  }
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function authFetch<T>(
  endpoint: string,
  init: RequestInit,
  fallbackMessage: string,
  map: (payload: unknown) => T,
): Promise<ApiResult<T>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, fallbackMessage) };
    }

    return { success: true, data: map((payload as { data?: unknown } | null)?.data) };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

async function authFetchBlob(
  endpoint: string,
  fallbackMessage: string,
): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir" };
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return { success: false, message: getErrorMessage(payload, fallbackMessage) };
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition");
    const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] || "export.xlsx";
    return { success: true, blob, filename };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

async function authFetchFormData<T>(
  endpoint: string,
  formData: FormData,
  fallbackMessage: string,
  map: (payload: unknown) => T,
): Promise<ApiResult<T>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, fallbackMessage) };
    }

    return { success: true, data: map((payload as { data?: unknown } | null)?.data) };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function fetchDoorprizeEvents(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<ApiResult<PaginatedEvents>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";

  return authFetch(
    `/doorprize/events${qs}`,
    { method: "GET" },
    "Gagal memuat daftar event doorprize",
    (payload) => {
      const p = payload as Record<string, unknown>;
      const events = Array.isArray(p.data)
        ? (p.data as DoorprizeEvent[])
        : (p.events as DoorprizeEvent[]) || [];
      return {
        events,
        total: (p.total as number) || 0,
        page: (p.page as number) || 1,
        limit: (p.limit as number) || 10,
      };
    },
  );
}

export async function fetchDoorprizeEventById(
  eventId: number | string,
): Promise<ApiResult<DoorprizeEvent>> {
  return authFetch(
    `/doorprize/events/${eventId}`,
    { method: "GET" },
    "Gagal memuat detail event",
    (payload) => payload as DoorprizeEvent,
  );
}

export async function createDoorprizeEvent(input: {
  name: string;
  eventDate: string;
  status?: string;
  parentEventId?: number;
}): Promise<ApiResult<DoorprizeEvent>> {
  return authFetch(
    "/doorprize/events",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal membuat event doorprize",
    (payload) => payload as DoorprizeEvent,
  );
}

export async function createDoorprizeEventWithImage(
  formData: FormData,
): Promise<ApiResult<DoorprizeEvent>> {
  return authFetchFormData(
    "/doorprize/events",
    formData,
    "Gagal membuat event doorprize",
    (payload) => payload as DoorprizeEvent,
  );
}

export async function updateDoorprizeEvent(
  eventId: number | string,
  input: { name?: string; eventDate?: string; status?: string },
): Promise<ApiResult<DoorprizeEvent>> {
  return authFetch(
    `/doorprize/events/${eventId}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui event doorprize",
    (payload) => payload as DoorprizeEvent,
  );
}

export async function updateDoorprizeEventWithImage(
  eventId: number | string,
  formData: FormData,
): Promise<ApiResult<DoorprizeEvent>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/doorprize/events/${eventId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal memperbarui event") };
    }

    return { success: true, data: (payload as { data: DoorprizeEvent }).data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteDoorprizeEvent(
  eventId: number | string,
): Promise<ApiResult<void>> {
  return authFetch(
    `/doorprize/events/${eventId}`,
    { method: "DELETE" },
    "Gagal menghapus event doorprize",
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Gifts
// ---------------------------------------------------------------------------

export async function fetchGifts(
  eventId: number | string,
): Promise<ApiResult<DoorprizeGift[]>> {
  return authFetch(
    `/doorprize/events/${eventId}/gifts`,
    { method: "GET" },
    "Gagal memuat daftar hadiah",
    (payload) => (payload as DoorprizeGift[]) || [],
  );
}

export async function createGift(
  eventId: number | string,
  input: { name: string; quota: number; giftBy?: string; drawTime?: string; displayOrder?: number },
): Promise<ApiResult<DoorprizeGift>> {
  return authFetch(
    `/doorprize/events/${eventId}/gifts`,
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah hadiah",
    (payload) => payload as DoorprizeGift,
  );
}

export async function createGiftWithImage(
  eventId: number | string,
  formData: FormData,
): Promise<ApiResult<DoorprizeGift>> {
  return authFetchFormData(
    `/doorprize/events/${eventId}/gifts`,
    formData,
    "Gagal menambah hadiah",
    (payload) => payload as DoorprizeGift,
  );
}

export async function updateGift(
  giftId: number | string,
  input: { name?: string; quota?: number; giftBy?: string; drawTime?: string; displayOrder?: number },
): Promise<ApiResult<DoorprizeGift>> {
  return authFetch(
    `/doorprize/gifts/${giftId}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui hadiah",
    (payload) => payload as DoorprizeGift,
  );
}

export async function updateGiftWithImage(
  giftId: number | string,
  formData: FormData,
): Promise<ApiResult<DoorprizeGift>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/doorprize/gifts/${giftId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal memperbarui hadiah") };
    }

    return { success: true, data: (payload as { data: DoorprizeGift }).data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteGift(
  giftId: number | string,
): Promise<ApiResult<void>> {
  return authFetch(
    `/doorprize/gifts/${giftId}`,
    { method: "DELETE" },
    "Gagal menghapus hadiah",
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function fetchParticipants(
  eventId: number | string,
  params?: { page?: number; limit?: number; search?: string; isActive?: boolean },
): Promise<ApiResult<PaginatedParticipants>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.isActive !== undefined) query.set("isActive", String(params.isActive));
  const qs = query.toString() ? `?${query.toString()}` : "";

  return authFetch(
    `/doorprize/events/${eventId}/participants${qs}`,
    { method: "GET" },
    "Gagal memuat daftar peserta",
    (payload) => {
      const p = payload as Record<string, unknown>;
      const participants = Array.isArray(p.data)
        ? (p.data as DoorprizeParticipant[])
        : (p.participants as DoorprizeParticipant[]) || [];
      return {
        participants,
        total: (p.total as number) || 0,
        page: (p.page as number) || 1,
        limit: (p.limit as number) || 10,
      };
    },
  );
}

export async function createParticipant(
  eventId: number | string,
  input: { name: string; employeeCode?: string; phone?: string; email?: string; unit?: string; isActive?: boolean },
): Promise<ApiResult<DoorprizeParticipant>> {
  return authFetch(
    `/doorprize/events/${eventId}/participants`,
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah peserta",
    (payload) => payload as DoorprizeParticipant,
  );
}

export async function createParticipantWithImage(
  eventId: number | string,
  formData: FormData,
): Promise<ApiResult<DoorprizeParticipant>> {
  return authFetchFormData(
    `/doorprize/events/${eventId}/participants`,
    formData,
    "Gagal menambah peserta",
    (payload) => payload as DoorprizeParticipant,
  );
}

export async function updateParticipant(
  participantId: number | string,
  input: { name?: string; employeeCode?: string; phone?: string; email?: string; unit?: string; isActive?: boolean },
): Promise<ApiResult<DoorprizeParticipant>> {
  return authFetch(
    `/doorprize/participants/${participantId}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui peserta",
    (payload) => payload as DoorprizeParticipant,
  );
}

export async function updateParticipantWithImage(
  participantId: number | string,
  formData: FormData,
): Promise<ApiResult<DoorprizeParticipant>> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/doorprize/participants/${participantId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal memperbarui peserta") };
    }

    return { success: true, data: (payload as { data: DoorprizeParticipant }).data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteParticipant(
  participantId: number | string,
): Promise<ApiResult<void>> {
  return authFetch(
    `/doorprize/participants/${participantId}`,
    { method: "DELETE" },
    "Gagal menghapus peserta",
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Import / Template
// ---------------------------------------------------------------------------

export async function importParticipants(
  eventId: number | string,
  file: File,
): Promise<ApiResult<ImportResult>> {
  const formData = new FormData();
  formData.append("file", file);

  return authFetchFormData(
    `/doorprize/events/${eventId}/participants/import`,
    formData,
    "Gagal mengimport peserta",
    (payload) => payload as ImportResult,
  );
}

// ---------------------------------------------------------------------------
// Photo Upload (ZIP)
// ---------------------------------------------------------------------------

export interface PhotoUploadResult {
  total: number;
  matched: number;
  unmatched: string[];
  errors: string[];
}

export async function uploadParticipantPhotos(
  eventId: number | string,
  file: File,
): Promise<ApiResult<PhotoUploadResult>> {
  const formData = new FormData();
  formData.append("file", file);

  return authFetchFormData(
    `/doorprize/events/${eventId}/participants/photos`,
    formData,
    "Gagal mengupload foto peserta",
    (payload) => {
      const p = payload as Record<string, unknown>;
      return {
        total: (p.total as number) || 0,
        matched: (p.matched as number) || 0,
        unmatched: (p.unmatched as string[]) || [],
        errors: (p.errors as string[]) || [],
      };
    },
  );
}

export async function downloadParticipantTemplate(
  eventId: number | string,
): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  return authFetchBlob(
    `/doorprize/events/${eventId}/participants/template`,
    "Gagal download template",
  );
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

export async function fetchDrawState(
  eventId: number | string,
): Promise<ApiResult<DrawState>> {
  return authFetch(
    `/doorprize/events/${eventId}/draw-state`,
    { method: "GET" },
    "Gagal memuat status undian",
    (payload) => payload as DrawState,
  );
}

export async function executeDraw(
  eventId: number | string,
  giftId: number,
): Promise<ApiResult<DrawResponse>> {
  return authFetch(
    `/doorprize/events/${eventId}/draw`,
    { method: "POST", body: JSON.stringify({ giftId }) },
    "Gagal melakukan undian",
    (payload) => payload as DrawResponse,
  );
}

export async function resetDrawResult(
  resultId: number | string,
): Promise<ApiResult<void>> {
  return authFetch(
    `/doorprize/results/${resultId}`,
    { method: "DELETE" },
    "Gagal menghapus hasil undian",
    () => undefined,
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportEventData(
  eventId: number | string,
): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  return authFetchBlob(
    `/doorprize/events/${eventId}/export`,
    "Gagal mengekspor data event",
  );
}

// ---------------------------------------------------------------------------
// Public endpoints (no auth required)
// ---------------------------------------------------------------------------

export async function fetchPublicResults(
  eventId: number | string,
  after?: number,
): Promise<ApiResult<{ event: DoorprizeEvent; results: DoorprizeResult[]; gifts: DoorprizeGift[] }>> {
  const qs = after ? `?after=${after}` : "";

  try {
    const response = await fetch(
      `${API_BASE_PATH}/public/doorprize/events/${eventId}/results${qs}`,
      { method: "GET", cache: "no-store" },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal memuat hasil undian") };
    }

    const p = ((payload as { data?: Record<string, unknown> } | null)?.data) || {};
    return {
      success: true,
      data: {
        event: p.event as DoorprizeEvent,
        results: (p.results as DoorprizeResult[]) || [],
        gifts: (p.gifts as DoorprizeGift[]) || [],
      },
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchPublicEventInfo(
  eventId: number | string,
): Promise<ApiResult<{ name: string; eventDate: string; imageUrl: string | null; gifts: { name: string; quota: number }[] }>> {
  try {
    const response = await fetch(
      `${API_BASE_PATH}/public/doorprize/events/${eventId}/info`,
      { method: "GET", cache: "no-store" },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal memuat info event") };
    }

    const p = ((payload as { data?: Record<string, unknown> } | null)?.data) || {};
    return {
      success: true,
      data: {
        name: (p.name as string) || "",
        eventDate: (p.eventDate as string) || "",
        imageUrl: (p.imageUrl as string | null) || null,
        gifts: (p.gifts as { name: string; quota: number }[]) || [],
      },
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
