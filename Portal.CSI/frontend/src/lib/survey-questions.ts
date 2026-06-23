"use client";

import { getAccessToken } from "@/lib/auth";
import { API_BASE_PATH, getErrorMessage } from "@/lib/api-utils";
import type { SurveyQuestion } from "@/types/survey";

export interface SurveyQuestionPayload {
  surveyId: string | number;
  type: string;
  promptText: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  isMandatory?: boolean;
  displayOrder?: number;
  pageNumber?: number;
  layoutOrientation?: "vertical" | "horizontal";
  options?: unknown;
  commentRequiredBelowRating?: number | null;
  createdBy: number;
}

export async function fetchSurveyQuestions(
  surveyId: string,
): Promise<{ success: boolean; questions: SurveyQuestion[]; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, questions: [], message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/survey/${surveyId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: SurveyQuestion[]; message?: string; error?: unknown }
      | null;

    if (!response.ok || !body?.success) {
      return { success: false, questions: [], message: getErrorMessage(body, "Gagal memuat pertanyaan") };
    }

    return { success: true, questions: Array.isArray(body.data) ? body.data : [] };
  } catch {
    return { success: false, questions: [], message: "Gagal terhubung ke server" };
  }
}

export async function fetchSurveyResponseStatistics(
  surveyId: string,
): Promise<{ success: boolean; totalResponses: number; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, totalResponses: 0, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/responses/survey/${surveyId}/statistics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: { totalResponses?: unknown }; message?: string; error?: unknown }
      | null;

    if (!response.ok || !body?.success) {
      return { success: false, totalResponses: 0, message: getErrorMessage(body, "Gagal memuat statistik response") };
    }

    const total = Number(body.data?.totalResponses ?? 0);
    return { success: true, totalResponses: Number.isFinite(total) ? total : 0 };
  } catch {
    return { success: false, totalResponses: 0, message: "Gagal terhubung ke server" };
  }
}

export async function createSurveyQuestion(
  payload: SurveyQuestionPayload,
): Promise<{ success: boolean; question?: SurveyQuestion; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: SurveyQuestion; message?: string; error?: unknown }
      | null;

    if (!response.ok || !body?.success || !body.data) {
      return { success: false, message: getErrorMessage(body, "Gagal menambah pertanyaan") };
    }

    return { success: true, question: body.data };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function updateSurveyQuestion(
  questionId: string | number,
  payload: Partial<SurveyQuestionPayload> & { updatedBy?: number },
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/${String(questionId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal mengubah pertanyaan") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function deleteSurveyQuestion(
  questionId: string | number,
): Promise<{ success: boolean; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const response = await fetch(`${API_BASE_PATH}/questions/${String(questionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, message: getErrorMessage(body, "Gagal menghapus pertanyaan") };
    }

    return { success: true };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

export async function uploadSurveyQuestionImage(
  questionId: string | number,
  image: Blob,
  filename = "hero-cover.png",
): Promise<{ success: boolean; imageUrl?: string; message?: string }> {
  const token = getAccessToken();
  if (!token) {
    return { success: false, message: "Sesi login tidak ditemukan" };
  }

  try {
    const formData = new FormData();
    formData.append("image", image, filename);

    const response = await fetch(`${API_BASE_PATH}/questions/${String(questionId)}/upload/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const body = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: { imageUrl?: string }; message?: string; error?: unknown }
      | null;

    if (!response.ok || body?.success !== true || !body.data?.imageUrl) {
      return { success: false, message: getErrorMessage(body, "Gagal upload gambar pertanyaan") };
    }

    return { success: true, imageUrl: body.data.imageUrl };
  } catch {
    return { success: false, message: "Gagal terhubung ke server" };
  }
}
