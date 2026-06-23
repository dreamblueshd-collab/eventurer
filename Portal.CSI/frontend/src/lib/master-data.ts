"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export type BusinessUnitMaster = {
  BusinessUnitId: number;
  Code: number;
  Name: string;
  IsActive: boolean;
};

export type DivisionMaster = {
  DivisionId: number;
  BusinessUnitId: number;
  Code: number;
  Name: string;
  IsActive: boolean;
};

export type DepartmentMaster = {
  DepartmentId: number;
  DivisionId: number;
  Code: number;
  Name: string;
  IsActive: boolean;
};

export type FunctionMaster = {
  FunctionId: number;
  Code: number;
  Name: string;
  ITLeadUserId?: number | null;
  ITLeadName?: string | null;
  IsActive: boolean;
};

export type ApplicationMaster = {
  ApplicationId: number;
  Code: number;
  Name: string;
  Description?: string | null;
  IsActive: boolean;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  return getApiErrorMessage(payload, fallback);
}

function tryParseJson<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readResponseErrorMessage(response: Response, fallback: string): Promise<string> {
  const rawText = await response.text().catch(() => "");
  if (!rawText) {
    return fallback;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json") || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
    try {
      return getErrorMessage(JSON.parse(rawText), fallback);
    } catch {
      // Fall through to text normalization.
    }
  }

  return fallback;
}

async function authFetch<T>(
  endpoint: string,
  init: RequestInit,
  fallbackMessage: string,
  map: (payload: unknown) => T
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

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok) {
      const message = await readResponseErrorMessage(response, fallbackMessage);
      return { success: false, message };
    }

    const payload = await response.json().catch(() => null);
    return { success: true, data: map(payload) };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchBusinessUnitsMaster(): Promise<ApiResult<BusinessUnitMaster[]>> {
  return authFetch(
    "/business-units?includeInactive=true",
    { method: "GET" },
    "Gagal memuat business unit",
    (payload) => ((payload as { data?: BusinessUnitMaster[] } | null)?.data || [])
  );
}

export async function createBusinessUnitMaster(input: { name: string }): Promise<ApiResult<BusinessUnitMaster>> {
  return authFetch(
    "/business-units",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah business unit",
    (payload) => (payload as { data: BusinessUnitMaster }).data
  );
}

export async function updateBusinessUnitMaster(id: number, input: Partial<{ name: string; isActive: boolean }>): Promise<ApiResult<BusinessUnitMaster>> {
  return authFetch(
    `/business-units/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui business unit",
    (payload) => (payload as { data: BusinessUnitMaster }).data
  );
}

export async function fetchDivisionsMaster(): Promise<ApiResult<DivisionMaster[]>> {
  return authFetch(
    "/divisions?includeInactive=true",
    { method: "GET" },
    "Gagal memuat divisi",
    (payload) => ((payload as { data?: DivisionMaster[] } | null)?.data || [])
  );
}

export async function createDivisionMaster(input: { businessUnitId: number; name: string }): Promise<ApiResult<DivisionMaster>> {
  return authFetch(
    "/divisions",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah divisi",
    (payload) => (payload as { data: DivisionMaster }).data
  );
}

export async function updateDivisionMaster(id: number, input: Partial<{ businessUnitId: number; name: string; isActive: boolean }>): Promise<ApiResult<DivisionMaster>> {
  return authFetch(
    `/divisions/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui divisi",
    (payload) => (payload as { data: DivisionMaster }).data
  );
}

export async function fetchDepartmentsMaster(): Promise<ApiResult<DepartmentMaster[]>> {
  return authFetch(
    "/departments?includeInactive=true",
    { method: "GET" },
    "Gagal memuat department",
    (payload) => ((payload as { data?: DepartmentMaster[] } | null)?.data || [])
  );
}

export async function createDepartmentMaster(input: { divisionId: number; name: string }): Promise<ApiResult<DepartmentMaster>> {
  return authFetch(
    "/departments",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah department",
    (payload) => (payload as { data: DepartmentMaster }).data
  );
}

export async function updateDepartmentMaster(id: number, input: Partial<{ divisionId: number; name: string; isActive: boolean }>): Promise<ApiResult<DepartmentMaster>> {
  return authFetch(
    `/departments/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui department",
    (payload) => (payload as { data: DepartmentMaster }).data
  );
}

export async function fetchFunctionsMaster(): Promise<ApiResult<FunctionMaster[]>> {
  return authFetch(
    "/functions?includeInactive=true",
    { method: "GET" },
    "Gagal memuat function",
    (payload) => ((payload as { data?: FunctionMaster[] } | null)?.data || [])
  );
}

export async function createFunctionMaster(input: { name: string; itLeadUserId?: number | null }): Promise<ApiResult<FunctionMaster>> {
  return authFetch(
    "/functions",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah function",
    (payload) => (payload as { data: FunctionMaster }).data
  );
}

export async function updateFunctionMaster(id: number, input: Partial<{ name: string; isActive: boolean; itLeadUserId: number | null }>): Promise<ApiResult<FunctionMaster>> {
  return authFetch(
    `/functions/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui function",
    (payload) => (payload as { data: FunctionMaster }).data
  );
}

export async function fetchApplicationsMaster(): Promise<ApiResult<ApplicationMaster[]>> {
  return authFetch(
    "/applications?includeInactive=true",
    { method: "GET" },
    "Gagal memuat aplikasi",
    (payload) => ((payload as { data?: ApplicationMaster[] } | null)?.data || [])
  );
}

export async function createApplicationMaster(input: { name: string; description?: string }): Promise<ApiResult<ApplicationMaster>> {
  return authFetch(
    "/applications",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah aplikasi",
    (payload) => (payload as { data: ApplicationMaster }).data
  );
}

export async function updateApplicationMaster(id: number, input: Partial<{ name: string; description: string; isActive: boolean }>): Promise<ApiResult<ApplicationMaster>> {
  return authFetch(
    `/applications/${id}`,
    { method: "PUT", body: JSON.stringify(input) },
    "Gagal memperbarui aplikasi",
    (payload) => (payload as { data: ApplicationMaster }).data
  );
}

export async function downloadBusinessUnitTemplate(): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };
  try {
    const response = await fetch(`${API_BASE_PATH}/business-units/template`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { success: false, message: await readResponseErrorMessage(response, "Gagal download template") };
    }
    const blob = await response.blob();
    return { success: true, blob, filename: "master-bu-template.xlsx" };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function uploadBusinessUnitFile(file: File): Promise<{
  success: boolean;
  message?: string;
  imported?: number;
  updated?: number;
  failed?: number;
  errors?: Array<{ row: number; data: unknown; errors: string[] }>;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_PATH}/business-units/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const rawText = await response.text().catch(() => "");
    const payload = tryParseJson<{
      success?: boolean;
      meta?: { message?: string };
      data?: {
        imported?: number;
        updated?: number;
        failed?: number;
        errors?: Array<{ row: number; data: unknown; errors: string[] }>;
      };
      error?: { message?: string; details?: Array<{ row: number; data: unknown; errors: string[] }> };
    }>(rawText);
    if (!response.ok || !payload?.success) {
      const message = getErrorMessage(payload, "Gagal upload file");
      const failureErrors = payload?.error?.details;
      return { success: false, message, errors: Array.isArray(failureErrors) ? failureErrors : undefined };
    }
    return {
      success: true,
      message: payload.meta?.message,
      imported: payload.data?.imported,
      updated: payload.data?.updated,
      failed: payload.data?.failed,
      errors: payload.data?.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

type UploadResult = {
  success: boolean;
  message?: string;
  imported?: number;
  updated?: number;
  failed?: number;
  errors?: Array<{ row: number; data: unknown; errors: string[] }>;
};

async function downloadTemplate(endpoint: string, filename: string): Promise<{ success: boolean; blob?: Blob; filename?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };
  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return { success: false, message: await readResponseErrorMessage(response, "Gagal download template") };
    }
    const blob = await response.blob();
    return { success: true, blob, filename };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

async function uploadFile(endpoint: string, file: File): Promise<UploadResult> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const rawText = await response.text().catch(() => "");
    const payload = tryParseJson<{
      success?: boolean;
      meta?: { message?: string };
      data?: {
        imported?: number;
        updated?: number;
        failed?: number;
        errors?: Array<{ row: number; data: unknown; errors: string[] }>;
      };
      error?: { message?: string; details?: Array<{ row: number; data: unknown; errors: string[] }> };
    }>(rawText);
    if (!response.ok || !payload?.success) {
      const message = getErrorMessage(payload, "Gagal upload file");
      const failureErrors = payload?.error?.details;
      return { success: false, message, errors: Array.isArray(failureErrors) ? failureErrors : undefined };
    }
    return {
      success: true,
      message: payload.meta?.message,
      imported: payload.data?.imported,
      updated: payload.data?.updated,
      failed: payload.data?.failed,
      errors: payload.data?.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

// Division template & upload
export async function downloadDivisionTemplate() {
  return downloadTemplate("/divisions/template", "master-divisi-template.xlsx");
}
export async function uploadDivisionFile(file: File): Promise<UploadResult> {
  return uploadFile("/divisions/upload", file);
}

// Department template & upload
export async function downloadDepartmentTemplate() {
  return downloadTemplate("/departments/template", "master-department-template.xlsx");
}
export async function uploadDepartmentFile(file: File): Promise<UploadResult> {
  return uploadFile("/departments/upload", file);
}

// Function template & upload
export async function downloadFunctionTemplate() {
  return downloadTemplate("/functions/template", "master-function-template.xlsx");
}
export async function uploadFunctionFile(file: File): Promise<UploadResult> {
  return uploadFile("/functions/upload", file);
}

// Application template & upload
export async function downloadApplicationTemplate() {
  return downloadTemplate("/applications/template", "master-aplikasi-template.xlsx");
}
export async function uploadApplicationFile(file: File): Promise<UploadResult> {
  return uploadFile("/applications/upload", file);
}
