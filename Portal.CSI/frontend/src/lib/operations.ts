"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";
const EVENTS_ENDPOINT = `${API_BASE_PATH}/events`;

interface ScheduledOperation {
  operationId: number;
  operationType: string;
  frequency: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  dayOfWeek?: number | null;
  status: string;
}

export async function generateQRCode(surveyId: string): Promise<{ success: boolean; qrCodeUrl?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/qrcode`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal generate QR code") };
    }

    const qrCodeUrl = payload.data?.qrCodeDataUrl || payload.data?.qrCodeUrl;
    if (!qrCodeUrl) {
      return { success: false, message: "QR code tidak tersedia dari server" };
    }

    return { success: true, qrCodeUrl };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function getScheduledOperations(surveyId: string): Promise<{ success: boolean; operations?: ScheduledOperation[]; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${EVENTS_ENDPOINT}/${surveyId}/scheduled-operations`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal memuat scheduled operations") };
    }

    const rawOperations = Array.isArray(payload?.data) ? payload.data : [];
    const normalized = rawOperations.map((item: Record<string, unknown>) => ({
      operationId: Number(item.operationId || item.OperationId || 0),
      operationType: String(item.operationType || item.OperationType || ""),
      frequency: String(item.frequency || item.Frequency || ""),
      scheduledDate: (item.scheduledDate || item.ScheduledDate || null) as string | null,
      scheduledTime: (item.scheduledTime || item.ScheduledTime || null) as string | null,
      dayOfWeek: (item.dayOfWeek ?? item.DayOfWeek ?? null) as number | null,
      status: String(item.status || item.Status || ""),
    }));
    return { success: true, operations: normalized };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function cancelScheduledOperation(_surveyId: string, operationId: number): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/surveys/scheduled-operations/${operationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal cancel operation") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function retryScheduledOperation(operationId: number): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/surveys/scheduled-operations/${operationId}/retry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return { success: false, message: getApiErrorMessage(payload, "Gagal retry operation") };
    }

    return { success: true, message: payload?.meta?.message };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
