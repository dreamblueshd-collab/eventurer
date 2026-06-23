"use client";

/**
 * Standard API client for the CSI Portal frontend (Phase 2).
 *
 * Wraps fetch (with 401 -> login redirect via fetchWithAuth) and parses the
 * backend's standard envelope:
 *   Success: { success: true, data, meta? }
 *   Error:   { success: false, error: { code, message, details? } }
 *
 * Usage:
 *   const { data, meta } = await apiGet<User[]>("/users");
 *   try { await apiPost("/users", body); } catch (e) { if (isApiError(e)) ... }
 */

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import type { ApiMeta, ApiResponse } from "@/types/api";

export const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

/** Error thrown when the API returns a non-success envelope (or a non-OK HTTP status). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Best-effort extraction of a human-readable message from any error-ish payload.
 * Understands the new envelope ({ error: { message } }) plus legacy shapes
 * ({ message } / { error: "..." }) and express-validator details[].msg.
 */
export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as Record<string, unknown>;

  // New envelope: { success: false, error: { code, message, details } }
  const err = body.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (Array.isArray(e.details)) {
      const msg = firstDetailMessage(e.details);
      if (msg) return msg;
    }
  }

  // Legacy shapes
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (typeof body.error === "string" && body.error.trim()) return body.error;
  if (Array.isArray(body.details)) {
    const msg = firstDetailMessage(body.details);
    if (msg) return msg;
  }

  return fallback;
}

function firstDetailMessage(details: unknown[]): string | null {
  const messages = details
    .map((item) =>
      item && typeof item === "object" && "msg" in item
        ? String((item as { msg: unknown }).msg ?? "")
        : ""
    )
    .filter(Boolean);
  return messages.length > 0 ? messages.join(", ") : null;
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return path;
  return `${API_BASE_PATH}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Core request helper. Returns the unwrapped `data` plus optional `meta`.
 * Throws `ApiError` on a non-success envelope or non-OK HTTP status.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  fallbackMessage = "Permintaan gagal diproses"
): Promise<{ data: T; meta?: ApiMeta }> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  const response = await fetchWithAuth(buildUrl(path), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      // Don't force JSON content-type for FormData (browser sets the boundary).
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
  });

  const rawText = await response.text().catch(() => "");
  let body: unknown = null;
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = null;
    }
  }

  const envelope = body as Partial<ApiResponse<T>> | null;

  if (!response.ok || !envelope || envelope.success !== true) {
    const code =
      envelope && envelope.success === false && envelope.error?.code
        ? envelope.error.code
        : `HTTP_${response.status}`;
    const details =
      envelope && envelope.success === false ? envelope.error?.details : undefined;
    throw new ApiError(
      getApiErrorMessage(body, fallbackMessage),
      code,
      response.status,
      details
    );
  }

  return { data: (envelope as { data: T }).data, meta: (envelope as { meta?: ApiMeta }).meta };
}

/** Convenience: return only `data`. */
export async function apiGet<T = unknown>(path: string, fallbackMessage?: string): Promise<T> {
  const { data } = await apiFetch<T>(path, { method: "GET" }, fallbackMessage);
  return data;
}

/** Convenience: GET returning both `data` and `meta` (e.g. for pagination). */
export async function apiGetWithMeta<T = unknown>(
  path: string,
  fallbackMessage?: string
): Promise<{ data: T; meta?: ApiMeta }> {
  return apiFetch<T>(path, { method: "GET" }, fallbackMessage);
}

function jsonBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (typeof FormData !== "undefined" && body instanceof FormData) return body;
  return JSON.stringify(body);
}

export async function apiPost<T = unknown>(path: string, body?: unknown, fallbackMessage?: string): Promise<T> {
  const { data } = await apiFetch<T>(path, { method: "POST", body: jsonBody(body) }, fallbackMessage);
  return data;
}

export async function apiPut<T = unknown>(path: string, body?: unknown, fallbackMessage?: string): Promise<T> {
  const { data } = await apiFetch<T>(path, { method: "PUT", body: jsonBody(body) }, fallbackMessage);
  return data;
}

export async function apiPatch<T = unknown>(path: string, body?: unknown, fallbackMessage?: string): Promise<T> {
  const { data } = await apiFetch<T>(path, { method: "PATCH", body: jsonBody(body) }, fallbackMessage);
  return data;
}

export async function apiDelete<T = unknown>(path: string, body?: unknown, fallbackMessage?: string): Promise<T> {
  const { data } = await apiFetch<T>(path, { method: "DELETE", body: jsonBody(body) }, fallbackMessage);
  return data;
}
