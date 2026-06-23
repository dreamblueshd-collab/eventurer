"use client";

import { getAccessToken, redirectToLogin } from "@/lib/auth";
import type { UserListItem, UsersResponse } from "@/types/user";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

// Re-export UserListItem for external use
export type { UserListItem } from "@/types/user";

export type AdminEventUser = {
  UserId: number;
  Username: string;
  DisplayName: string;
  Email: string;
  Role: string;
  IsActive: boolean;
};

export type UserRole = "SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead";

export type CreateUserInput = {
  username: string;
  npk?: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  useLDAP: boolean;
  businessUnitId?: number;
  divisionId?: number;
  departmentId?: number;
  password?: string;
};

export type UpdateUserInput = {
  username?: string;
  npk?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  role?: UserRole;
  businessUnitId?: number;
  divisionId?: number;
  departmentId?: number;
  isActive?: boolean;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;
  if (Array.isArray(maybePayload.details) && maybePayload.details.length > 0) {
    const first = maybePayload.details[0] as Record<string, unknown>;
    if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
  }
  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;
  return fallback;
}

export async function searchAdminEventUsers(search: string): Promise<{
  success: boolean;
  users: AdminEventUser[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, users: [], message: "Sesi login tidak ditemukan" };

  const query = new URLSearchParams({
    role: "AdminEvent",
    search,
  });

  try {
    const response = await fetch(`${API_BASE_PATH}/users?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; users?: AdminEventUser[]; message?: string; error?: string }
      | null;

    if (response.status === 401) {
      // Use the centralised handler so the user is returned to the
      // exact page they were on (with query string intact) after
      // re-login — not the dashboard.
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, users: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        users: [],
        message: getErrorMessage(payload, "Gagal memuat daftar Admin Event"),
      };
    }

    return { success: true, users: payload.users || [] };
  } catch {
    return { success: false, users: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchUsers(search: string): Promise<{
  success: boolean;
  users: UserListItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, users: [], message: "Sesi login tidak ditemukan" };

  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());

  try {
    const response = await fetch(`${API_BASE_PATH}/users?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as UsersResponse | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, users: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        users: [],
        message: getErrorMessage(payload, "Gagal memuat data user"),
      };
    }

    return { success: true, users: payload.users || [] };
  } catch {
    return { success: false, users: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchUsersWithFilters(input: {
  search?: string;
  role?: string;
  isActive?: "true" | "false";
  includeInactive?: "true" | "false";
  departmentId?: string;
}): Promise<{
  success: boolean;
  users: UserListItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, users: [], message: "Sesi login tidak ditemukan" };

  const query = new URLSearchParams();
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.role && input.role !== "all") query.set("role", input.role);
  if (input.isActive) query.set("isActive", input.isActive);
  if (input.includeInactive) query.set("includeInactive", input.includeInactive);
  if (input.departmentId && input.departmentId !== "all") query.set("departmentId", input.departmentId);

  try {
    const response = await fetch(`${API_BASE_PATH}/users?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as UsersResponse | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, users: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        users: [],
        message: getErrorMessage(payload, "Gagal memuat data user"),
      };
    }

    return { success: true, users: payload.users || [] };
  } catch {
    return { success: false, users: [], message: "Gagal terhubung ke server" };
  }
}

/**
 * Fetch IT Lead users for dropdown (public endpoint, no special permission required)
 */
export async function fetchITLeadUsers(input?: {
  includeInactive?: "true" | "false";
}): Promise<{
  success: boolean;
  users: UserListItem[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, users: [], message: "Sesi login tidak ditemukan" };

  const query = new URLSearchParams();
  if (input?.includeInactive) query.set("includeInactive", input.includeInactive);

  try {
    const response = await fetch(`${API_BASE_PATH}/public/users/it-leads?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as UsersResponse | null;
    if (response.status === 401) {
      redirectToLogin({ reason: "unauthorized" });
      return { success: false, users: [], message: "Sesi telah berakhir, silakan login kembali" };
    }
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        users: [],
        message: getErrorMessage(payload, "Gagal memuat daftar IT Lead"),
      };
    }

    return { success: true, users: payload.users || [] };
  } catch {
    return { success: false, users: [], message: "Gagal terhubung ke server" };
  }
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string; details?: Array<{ msg?: string }> }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal membuat user") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateUser(userId: number, input: UpdateUserInput): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string; details?: Array<{ msg?: string }> }
      | null;

    if (!response.ok || !payload?.success) {
      return { success: false, message: getErrorMessage(payload, "Gagal memperbarui user") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function toggleUserLdap(userId: number, useLDAP: boolean): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users/${userId}/ldap`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ useLDAP }),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal update LDAP user") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function setUserPassword(userId: number, password: string): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users/${userId}/password`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return { success: false, message: getErrorMessage(payload, "Gagal update password user") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function downloadUserTemplateFile(): Promise<{
  success: boolean;
  blob?: Blob;
  filename?: string;
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users/template`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      return { success: false, message: getErrorMessage(payload, "Gagal download template") };
    }

    const contentDisposition = response.headers.get("content-disposition") || "";
    const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || "master-user-template.xlsx";
    const blob = await response.blob();

    return { success: true, blob, filename };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function downloadUserList(): Promise<{
  success: boolean;
  blob?: Blob;
  filename?: string;
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const response = await fetch(`${API_BASE_PATH}/users/download`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      return { success: false, message: getErrorMessage(payload, "Gagal download user list") };
    }

    const contentDisposition = response.headers.get("content-disposition") || "";
    const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || "user-list.xlsx";
    const blob = await response.blob();

    return { success: true, blob, filename };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function uploadUserFile(file: File): Promise<{
  success: boolean;
  message?: string;
  imported?: number;
  failed?: number;
  errors?: Array<{ row: number; data: unknown; errors: string[] }>;
}> {
  const token = getAccessToken();
  if (!token) return { success: false, message: "Sesi login tidak ditemukan" };

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_PATH}/users/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string; imported?: number; failed?: number; errors?: Array<{ row: number; data: unknown; errors: string[] }> }
      | null;

    if (!response.ok || !payload?.success) {
      return { 
        success: false, 
        message: getErrorMessage(payload, "Gagal upload file"),
        imported: payload?.imported,
        failed: payload?.failed,
        errors: payload?.errors
      };
    }

    return {
      success: true,
      message: payload.message,
      imported: payload.imported,
      failed: payload.failed,
      errors: payload.errors,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

