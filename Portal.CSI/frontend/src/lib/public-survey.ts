"use client";

const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export type PublicQuestion = {
  questionId: string;
  surveyId: string;
  type: string;
  promptText: string;
  subtitle?: string | null;
  isMandatory?: boolean;
  displayOrder?: number;
  pageNumber?: number;
  options?: Record<string, unknown> | null;
  imageUrl?: string | null;
  layoutOrientation?: string | null;
};

export type PublicSurveyForm = {
  surveyId: string;
  slug?: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  targetRespondents?: number | null;
  targetScore?: number | null;
  duplicatePreventionEnabled?: boolean;
  configuration?: {
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroImageUrl?: string | null;
    logoUrl?: string | null;
    backgroundImageUrl?: string | null;
    backgroundColor?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    fontFamily?: string | null;
    buttonStyle?: string | null;
    showProgressBar?: boolean;
    showPageNumbers?: boolean;
    multiPage?: boolean;
    heroImagePositionX?: number | null;
    heroImagePositionY?: number | null;
    logoPositionX?: number | null;
    logoPositionY?: number | null;
    backgroundPositionX?: number | null;
    backgroundPositionY?: number | null;
  } | null;
  questions: PublicQuestion[];
};

export type PublicOptionItem = {
  id: string;
  name: string;
  parentId?: string;
};

type JsonRecord = Record<string, unknown>;

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as JsonRecord;
  const err = data.error;
  if (err && typeof err === "object") {
    const e = err as JsonRecord;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
  }
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  return fallback;
}

async function requestJson(path: string, init?: RequestInit): Promise<{ ok: boolean; payload: JsonRecord | null }> {
  const response = await fetch(path, init);
  const payload = (await response.json().catch(() => null)) as JsonRecord | null;
  return { ok: response.ok, payload };
}

export async function fetchPublicSurveyForm(
  surveyId: string,
): Promise<{ success: boolean; form?: PublicSurveyForm; message?: string }> {
  try {
    const result = await requestJson(`${API_BASE_PATH}/responses/survey/${encodeURIComponent(surveyId)}/form`, {
      method: "GET",
      cache: "no-store",
    });
    if (!result.ok || result.payload?.success !== true || !result.payload.data) {
      return { success: false, message: getErrorMessage(result.payload, "Survey tidak ditemukan atau sudah tidak aktif") };
    }
    return { success: true, form: result.payload.data as PublicSurveyForm };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function fetchPublicApplications(
  surveyId: string,
  filter?: { departmentId?: string; functionId?: string },
): Promise<{ success: boolean; applications: PublicOptionItem[]; message?: string }> {
  try {
    const query = new URLSearchParams();
    if (filter?.departmentId) query.set("departmentId", filter.departmentId);
    if (filter?.functionId) query.set("functionId", filter.functionId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const result = await requestJson(`${API_BASE_PATH}/responses/survey/${encodeURIComponent(surveyId)}/applications${suffix}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!result.ok || result.payload?.success !== true) {
      return { success: false, applications: [], message: getErrorMessage(result.payload, "Gagal memuat aplikasi") };
    }
    const raw = Array.isArray(result.payload.data) ? result.payload.data : [];
    return {
      success: true,
      applications: raw
        .map((item) => ({
          id: String((item as JsonRecord).applicationId || ""),
          name: String((item as JsonRecord).name || "").trim(),
        }))
        .filter((item) => item.id && item.name),
    };
  } catch {
    return { success: false, applications: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchPublicMasterData(): Promise<{
  success: boolean;
  data: {
    businessUnits: PublicOptionItem[];
    divisions: PublicOptionItem[];
    departments: PublicOptionItem[];
    functions: PublicOptionItem[];
  };
  message?: string;
}> {
  try {
    const [bu, division, department, fn] = await Promise.all([
      requestJson(`${API_BASE_PATH}/public/business-units`, { method: "GET", cache: "no-store" }),
      requestJson(`${API_BASE_PATH}/public/divisions`, { method: "GET", cache: "no-store" }),
      requestJson(`${API_BASE_PATH}/public/departments`, { method: "GET", cache: "no-store" }),
      requestJson(`${API_BASE_PATH}/public/functions`, { method: "GET", cache: "no-store" }),
    ]);

    return {
      success: true,
      data: {
        businessUnits: (Array.isArray(bu.payload?.data) ? bu.payload.data : [])
          .map((item) => ({ id: String((item as JsonRecord).BusinessUnitId || ""), name: String((item as JsonRecord).Name || "").trim() }))
          .filter((item) => item.id && item.name),
        divisions: (Array.isArray(division.payload?.data) ? division.payload.data : [])
          .map((item) => ({
            id: String((item as JsonRecord).DivisionId || ""),
            parentId: String((item as JsonRecord).BusinessUnitId || ""),
            name: String((item as JsonRecord).Name || "").trim(),
          }))
          .filter((item) => item.id && item.name),
        departments: (Array.isArray(department.payload?.data) ? department.payload.data : [])
          .map((item) => ({
            id: String((item as JsonRecord).DepartmentId || ""),
            parentId: String((item as JsonRecord).DivisionId || ""),
            name: String((item as JsonRecord).Name || "").trim(),
          }))
          .filter((item) => item.id && item.name),
        functions: (Array.isArray(fn.payload?.data) ? fn.payload.data : [])
          .map((item) => ({ id: String((item as JsonRecord).FunctionId || ""), name: String((item as JsonRecord).Name || "").trim() }))
          .filter((item) => item.id && item.name),
      },
    };
  } catch {
    return {
      success: false,
      data: { businessUnits: [], divisions: [], departments: [], functions: [] },
      message: "Gagal terhubung ke server",
    };
  }
}

export async function checkDuplicatePublicResponse(input: {
  surveyId: string;
  email: string;
  applicationIds: string[];
}): Promise<{ success: boolean; isDuplicate: boolean; message?: string }> {
  try {
    const result = await requestJson(`${API_BASE_PATH}/responses/check-duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!result.ok || result.payload?.success !== true) {
      return { success: false, isDuplicate: false, message: getErrorMessage(result.payload, "Gagal memeriksa duplikasi response") };
    }
    const dupData = (result.payload.data && typeof result.payload.data === "object")
      ? (result.payload.data as JsonRecord)
      : null;
    const dupMeta = (result.payload.meta && typeof result.payload.meta === "object")
      ? (result.payload.meta as JsonRecord)
      : null;
    return {
      success: true,
      isDuplicate: dupData?.isDuplicate === true,
      message: typeof dupMeta?.message === "string" ? dupMeta.message : undefined,
    };
  } catch {
    return { success: false, isDuplicate: false, message: "Gagal terhubung ke server" };
  }
}

export async function submitPublicSurveyResponse(input: {
  surveyId: string;
  respondent: {
    name: string;
    email: string;
    businessUnitId?: string | null;
    divisionId?: string | null;
    departmentId?: string | null;
  };
  selectedApplicationIds: string[];
  responses: Array<{
    questionId: string;
    value: {
      textValue?: string | null;
      numericValue?: number | null;
      dateValue?: string | null;
      matrixValues?: Record<string, number | string> | null;
      commentValue?: string | null;
    };
  }>;
}): Promise<{ success: boolean; responseId?: string; message?: string }> {
  try {
    const result = await requestJson(`${API_BASE_PATH}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!result.ok || result.payload?.success !== true) {
      return { success: false, message: getErrorMessage(result.payload, "Gagal mengirim response survey") };
    }
    const submitData = (result.payload.data && typeof result.payload.data === "object")
      ? (result.payload.data as JsonRecord)
      : null;
    const responseIds = Array.isArray(submitData?.responseIds) ? submitData.responseIds : [];
    return {
      success: true,
      responseId: responseIds.length > 0 ? String(responseIds[0]) : undefined,
    };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
