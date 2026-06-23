"use client";

import { getAccessToken } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-client";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type BusinessUnitOption = {
  BusinessUnitId: number;
  Name: string;
  IsActive: boolean;
};

export type DivisionOption = {
  DivisionId: number | string; // Allow string for auto-generated IDs
  BusinessUnitId: number;
  Name: string;
  IsActive: boolean;
};

export type DepartmentOption = {
  DepartmentId: number | string; // Allow string for auto-generated IDs  
  DivisionId: number | string; // Allow string for auto-generated IDs
  Name: string;
  IsActive: boolean;
};

function getErrorMessage(payload: unknown, fallback: string): string {
  return getApiErrorMessage(payload, fallback);
}

export async function fetchOrgHierarchy(): Promise<{
  success: boolean;
  businessUnits: BusinessUnitOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  message?: string;
}> {
  const token = getAccessToken();
  if (!token) {
    return {
      success: false,
      businessUnits: [],
      divisions: [],
      departments: [],
      message: "Sesi login tidak ditemukan",
    };
  }

  try {
    const [buResponse, divResponse, deptResponse] = await Promise.all([
      fetch(`${API_BASE_PATH}/business-units`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      fetch(`${API_BASE_PATH}/divisions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      fetch(`${API_BASE_PATH}/departments`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
    ]);

    const [buPayload, divPayload, deptPayload] = await Promise.all([
      buResponse.json().catch(() => null),
      divResponse.json().catch(() => null),
      deptResponse.json().catch(() => null),
    ]);

    if (!buResponse.ok || !divResponse.ok || !deptResponse.ok) {
      return {
        success: false,
        businessUnits: [],
        divisions: [],
        departments: [],
        message:
          getErrorMessage(buPayload, "") ||
          getErrorMessage(divPayload, "") ||
          getErrorMessage(deptPayload, "Gagal memuat data organisasi"),
      };
    }

    const businessUnits = ((buPayload as { data?: BusinessUnitOption[] } | null)?.data || []).filter(
      (item) => item?.IsActive !== false
    );
    const divisions = ((divPayload as { data?: DivisionOption[] } | null)?.data || []).filter(
      (item) => item?.IsActive !== false
    );
    const departments = ((deptPayload as { data?: DepartmentOption[] } | null)?.data || []).filter(
      (item) => item?.IsActive !== false
    );

    return {
      success: true,
      businessUnits,
      divisions,
      departments,
    };
  } catch {
    return {
      success: false,
      businessUnits: [],
      divisions: [],
      departments: [],
      message: "Gagal terhubung ke server",
    };
  }
}

