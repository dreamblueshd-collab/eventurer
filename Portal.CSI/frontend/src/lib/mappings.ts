"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type MappedApplicationOption = {
  ApplicationId: number;
  ApplicationCode: string;
  ApplicationName: string;
  Description?: string | null;
};

export type FunctionApplicationMappingItem = {
  functionId: number;
  functionCode: string;
  functionName: string;
  itLeadUserId?: number | null;
  itLeadName?: string | null;
  applications: Array<{
    mappingId: number;
    applicationId: number;
    applicationCode: string;
    applicationName: string;
    createdAt?: string;
  }>;
};

export type DepartmentApplicationMappingHierarchy = {
  businessUnitId: number;
  businessUnitCode: string;
  businessUnitName: string;
  divisions: Array<{
    divisionId: number;
    divisionCode: string;
    divisionName: string;
    departments: Array<{
      departmentId: number;
      departmentCode: string;
      departmentName: string;
      applications: Array<{
        mappingId: number;
        applicationId: number;
        applicationCode: string;
        applicationName: string;
        createdAt?: string;
      }>;
    }>;
  }>;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return fallback;
}

async function fetchMappedApplications(
  path: string,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, applications: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; applications?: MappedApplicationOption[]; message?: string; error?: string }
      | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, applications: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || payload?.success !== true) {
      return {
        success: false,
        applications: [],
        message: getErrorMessage(payload, "Gagal memuat aplikasi dari mapping"),
      };
    }

    return {
      success: true,
      applications: Array.isArray(payload.applications) ? payload.applications : [],
    };
  } catch {
    return { success: false, applications: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchMappedApplicationsByDepartment(
  departmentId: number,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  return fetchMappedApplications(`/mappings/application-department/department/${departmentId}`);
}

export async function fetchMappedApplicationsByFunction(
  functionId: number,
): Promise<{ success: boolean; applications: MappedApplicationOption[]; message?: string }> {
  return fetchMappedApplications(`/mappings/function-application/function/${functionId}`);
}

async function authJson<T>(
  endpoint: string,
  init: RequestInit,
  fallbackMessage: string,
  map: (payload: Record<string, unknown> | null) => T,
): Promise<{ success: boolean; data?: T; message?: string }> {
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

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, fallbackMessage) };
    }

    return { success: true, data: map(payload) };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchFunctionApplicationMappingsDetailed(): Promise<{
  success: boolean;
  mappings: FunctionApplicationMappingItem[];
  message?: string;
}> {
  const result = await authJson(
    "/mappings/function-app/details",
    { method: "GET" },
    "Gagal memuat mapping function-aplikasi",
    (payload) => (Array.isArray(payload?.mappings) ? (payload?.mappings as FunctionApplicationMappingItem[]) : []),
  );
  return result.success
    ? { success: true, mappings: result.data || [] }
    : { success: false, mappings: [], message: result.message };
}

export async function fetchDepartmentApplicationMappingsHierarchical(): Promise<{
  success: boolean;
  mappings: DepartmentApplicationMappingHierarchy[];
  message?: string;
}> {
  const result = await authJson(
    "/mappings/app-dept/hierarchical",
    { method: "GET" },
    "Gagal memuat mapping dept-aplikasi",
    (payload) => (Array.isArray(payload?.mappings) ? (payload?.mappings as DepartmentApplicationMappingHierarchy[]) : []),
  );
  return result.success
    ? { success: true, mappings: result.data || [] }
    : { success: false, mappings: [], message: result.message };
}

export async function createFunctionApplicationMapping(input: {
  functionId: number;
  applicationIds: number[];
}): Promise<{ success: boolean; message?: string }> {
  const result = await authJson(
    "/mappings/function-app",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah mapping function-aplikasi",
    () => null,
  );
  return result.success ? { success: true } : { success: false, message: result.message };
}

export async function createDepartmentApplicationMapping(input: {
  departmentId: number;
  applicationIds: number[];
}): Promise<{ success: boolean; message?: string }> {
  const result = await authJson(
    "/mappings/app-dept",
    { method: "POST", body: JSON.stringify(input) },
    "Gagal menambah mapping dept-aplikasi",
    () => null,
  );
  return result.success ? { success: true } : { success: false, message: result.message };
}

export async function deleteFunctionApplicationMapping(mappingId: number): Promise<{ success: boolean; message?: string }> {
  const result = await authJson(
    `/mappings/function-application/${mappingId}`,
    { method: "DELETE" },
    "Gagal menghapus mapping function-aplikasi",
    () => null,
  );
  return result.success ? { success: true } : { success: false, message: result.message };
}

export async function deleteDepartmentApplicationMapping(mappingId: number): Promise<{ success: boolean; message?: string }> {
  const result = await authJson(
    `/mappings/application-department/${mappingId}`,
    { method: "DELETE" },
    "Gagal menghapus mapping dept-aplikasi",
    () => null,
  );
  return result.success ? { success: true } : { success: false, message: result.message };
}

export async function exportFunctionApplicationMappingsCsv(): Promise<{ success: boolean; blob?: Blob; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/mappings/function-app/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { success: false, message: "Gagal export mapping function-aplikasi" };
    }
    return { success: true, blob: await response.blob() };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function exportDepartmentApplicationMappingsCsv(): Promise<{ success: boolean; blob?: Blob; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/mappings/app-dept/export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { success: false, message: "Gagal export mapping dept-aplikasi" };
    }
    return { success: true, blob: await response.blob() };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export type BulkImportResult = {
  success: boolean;
  imported?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  errors?: Array<{ row: number; data: Record<string, unknown>; errors: string[] }>;
  message?: string;
};

export async function downloadMappingTemplate(
  mappingType: "function-application" | "application-department",
): Promise<{ success: boolean; blob?: Blob; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  const endpoint =
    mappingType === "function-application"
      ? "/mappings/function-app/template"
      : "/mappings/app-dept/template";

  try {
    const response = await fetch(`${API_BASE_PATH}${endpoint}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { success: false, message: "Gagal mengunduh template" };
    }
    return { success: true, blob: await response.blob() };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function bulkImportMappings(
  file: File,
  mappingType: "function-application" | "application-department",
): Promise<BulkImportResult> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mappingType", mappingType);

  try {
    const response = await fetch(`${API_BASE_PATH}/mappings/bulk-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, message: "Sesi telah berakhir, silakan login kembali" };
    }

    if (!response.ok) {
      const errors = Array.isArray(payload?.errors)
        ? (payload.errors as Array<{ row: number; data: Record<string, unknown>; errors: string[] }>)
        : undefined;
      return {
        success: false,
        message: typeof payload?.message === "string" ? payload.message : "Gagal mengimpor data",
        errors,
      };
    }

    return {
      success: true,
      imported: typeof payload?.imported === "number" ? payload.imported : 0,
      updated: typeof payload?.updated === "number" ? payload.updated : 0,
      skipped: typeof payload?.skipped === "number" ? payload.skipped : 0,
      failed: typeof payload?.failed === "number" ? payload.failed : 0,
      errors: Array.isArray(payload?.errors)
        ? (payload.errors as Array<{ row: number; data: Record<string, unknown>; errors: string[] }>)
        : [],
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
