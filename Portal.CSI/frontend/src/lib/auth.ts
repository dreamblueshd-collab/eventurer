"use client";

import type { AuthUser, LoginResult } from "@/types/auth";
import { encryptPassword } from "@/lib/crypto";

const TOKEN_KEY = "csi_token";
const REFRESH_TOKEN_KEY = "csi_refresh_token";
const USER_KEY = "csi_user";
const SESSION_MARKER_KEY = "csi_session_present";
const COOKIE_SESSION_PLACEHOLDER = "__cookie_session__";
const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function getStorage(): Storage | null {
  if (!hasStorage()) return null;
  return window.sessionStorage;
}

export function clearLegacyLocalStorage(): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * @deprecated Legacy function that reads token from localStorage.
 * This is only used internally for the logout request and validateSession.
 * All other API calls use cookie-based auth via credentials: "include".
 * Do NOT use this in new code — use getAccessToken() + Authorization header pattern instead.
 */
function buildAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = hasStorage() && typeof window.localStorage !== "undefined"
    ? window.localStorage.getItem(TOKEN_KEY)
    : null;

  if (token) {
    return {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  return extraHeaders;
}

function parseJsonSafely<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;

  if (typeof maybePayload.message === "string") return maybePayload.message;
  if (typeof maybePayload.error === "string") return maybePayload.error;

  const details = maybePayload.details;
  if (Array.isArray(details) && details.length > 0) {
    const messages = details
      .map((item) =>
        typeof item === "object" && item && "msg" in item
          ? String((item as { msg: string }).msg)
          : ""
      )
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return fallback;
}

function tryParseJson<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  try {
    // Attempt to encrypt password client-side (AES-256-GCM)
    const encResult = await encryptPassword(password);

    const body = encResult
      ? { username, encryptedPassword: encResult.encrypted, challengeId: encResult.challengeId }
      : { username, password };

    const response = await fetch(`${API_BASE_PATH}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const rawText = await response.text().catch(() => "");
    const payload = tryParseJson<{ success?: boolean; user?: AuthUser; message?: string; error?: string; details?: unknown[] }>(rawText);

    if (!response.ok || !payload?.success) {
      const fallbackMessage = response.status === 401 ? "Username atau password salah" : "Login gagal";
      return {
        success: false,
        message: payload ? getErrorMessage(payload, fallbackMessage) : fallbackMessage,
      };
    }

    if (hasStorage()) {
      const storage = getStorage();
      storage?.setItem(USER_KEY, JSON.stringify(payload.user));
      storage?.setItem(SESSION_MARKER_KEY, "1");
    }
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    }

    return { success: true, user: payload.user as AuthUser };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function requestPasswordReset(
  method: "email" | "phone",
  identifier: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ method, identifier }),
    });

    const rawText = await response.text().catch(() => "");
    const payload = tryParseJson<{ success?: boolean; message?: string; error?: string; details?: unknown[] }>(rawText);
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: payload
          ? getErrorMessage(payload, "Gagal memproses forgot password")
          : "Gagal memproses forgot password",
      };
    }

    return {
      success: true,
      message: typeof payload?.message === "string" ? payload.message : "Permintaan reset password berhasil diproses",
    };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    // Attempt to encrypt password client-side (AES-256-GCM)
    const encResult = await encryptPassword(password);

    const body = encResult
      ? { token, encryptedPassword: encResult.encrypted, challengeId: encResult.challengeId }
      : { token, password };

    const response = await fetch(`${API_BASE_PATH}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const rawText = await response.text().catch(() => "");
    const payload = tryParseJson<{ success?: boolean; message?: string; error?: string; details?: unknown[] }>(rawText);
    if (!response.ok || !payload?.success) {
      return {
        success: false,
        message: payload
          ? getErrorMessage(payload, "Gagal mereset password")
          : "Gagal mereset password",
      };
    }

    return {
      success: true,
      message: typeof payload?.message === "string" ? payload.message : "Password berhasil direset",
    };
  } catch {
    return {
      success: false,
      message: "Gagal terhubung ke server",
    };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_PATH}/auth/logout`, {
      method: "POST",
      headers: buildAuthHeaders({ "Content-Type": "application/json" }),
      credentials: "include",
    });
  } finally {
    clearSession();
  }
}

export function clearSession(): void {
  const storage = getStorage();
  storage?.removeItem(USER_KEY);
  storage?.removeItem(SESSION_MARKER_KEY);
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Key used to stash the URL the user was on right before their session
 * expired. We persist it to sessionStorage so that even if the `next`
 * query param gets lost (e.g. router.replace stripping it, intermediate
 * 3rd-party redirect, etc.) we can still bring the user back to the
 * exact same page — including any query string.
 */
const PENDING_NEXT_KEY = "csi_pending_next";

/**
 * Capture the current full URL (pathname + search + hash) so we can
 * bring the user back here after they re-authenticate.
 */
export function captureCurrentLocation(): string {
  if (typeof window === "undefined") return "/admin/dashboard";
  const { pathname, search, hash } = window.location;
  return `${pathname}${search || ""}${hash || ""}`;
}

/**
 * Persist a `next` target so it survives a full-page navigation to /login.
 * The value should already be a path (with optional query/hash), e.g.
 * "/admin/event-management/survey-create?surveyId=1&eventId=2".
 */
export function stashPendingNext(target: string): void {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }
  if (!target || typeof target !== "string" || !target.startsWith("/")) return;
  try {
    window.sessionStorage.setItem(PENDING_NEXT_KEY, target);
  } catch {
    // ignore quota / disabled storage
  }
}

export function consumePendingNext(): string | null {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(PENDING_NEXT_KEY);
    if (value) {
      window.sessionStorage.removeItem(PENDING_NEXT_KEY);
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Centralised "session is gone" handler.
 *
 * 1. Clear all client-side auth state.
 * 2. Capture the current full URL (pathname + search + hash) so the user
 *    can be returned to the exact page they were on after re-login.
 * 3. Persist the captured URL to sessionStorage as a safety net, then
 *    navigate to /login with a `next` query param that mirrors it.
 *
 * Use this from any code that detects a 401 / expired session so the
 * behaviour is identical across the app — no more dropped query strings.
 */
export function redirectToLogin(options?: { reason?: string }): void {
  clearSession();

  if (typeof window === "undefined") return;

  const current = captureCurrentLocation();
  // Don't loop: if we're already on /login, do nothing extra.
  if (current.startsWith("/login")) {
    return;
  }

  stashPendingNext(current);

  const next = encodeURIComponent(current);
  const reasonParam = options?.reason
    ? `&reason=${encodeURIComponent(options.reason)}`
    : "";
  window.location.href = `/login?next=${next}${reasonParam}`;
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    const legacyToken = localStorage.getItem(TOKEN_KEY);
    if (legacyToken) return legacyToken;
  }

  const storage = getStorage();
  if (!storage) return null;

  const hasSession = storage.getItem(SESSION_MARKER_KEY) === "1" || Boolean(storage.getItem(USER_KEY));
  return hasSession ? COOKIE_SESSION_PLACEHOLDER : null;
}

export function getCurrentUser(): AuthUser | null {
  const storage = getStorage();
  if (storage) {
    const sessionUser = parseJsonSafely<AuthUser>(storage.getItem(USER_KEY));
    if (sessionUser) return sessionUser;
  }

  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    const legacyUser = parseJsonSafely<AuthUser>(localStorage.getItem(USER_KEY));
    if (legacyUser) {
      if (storage) {
        storage.setItem(USER_KEY, JSON.stringify(legacyUser));
        storage.setItem(SESSION_MARKER_KEY, "1");
      }
      return legacyUser;
    }
  }

  return null;
}

export function isAuthenticated(): boolean {
  return Boolean(getCurrentUser()) || Boolean(getAccessToken());
}

export async function validateSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${API_BASE_PATH}/auth/validate`, {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const payload = await response.json().catch(() => null);
    if (!payload?.valid || !payload?.user) {
      clearSession();
      return null;
    }

    const storage = getStorage();
    storage?.setItem(USER_KEY, JSON.stringify(payload.user));
    storage?.setItem(SESSION_MARKER_KEY, "1");
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    }
    return payload.user as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}
