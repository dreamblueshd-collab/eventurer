"use client";

export const API_BASE_PATH = process.env.NEXT_PUBLIC_API_BASE_PATH || "/api/v1";

export function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybePayload = payload as Record<string, unknown>;

  // Standard envelope: { success:false, error:{ code, message, details } }
  const err = maybePayload.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    if (Array.isArray(e.details)) {
      const msg = firstDetailMsg(e.details);
      if (msg) return msg;
    }
  }

  // Legacy shapes
  if (typeof maybePayload.message === "string" && maybePayload.message.trim()) return maybePayload.message;
  if (typeof maybePayload.error === "string" && maybePayload.error.trim()) return maybePayload.error;
  if (Array.isArray(maybePayload.details)) {
    const msg = firstDetailMsg(maybePayload.details);
    if (msg) return msg;
  }

  return fallback;
}

function firstDetailMsg(details: unknown[]): string | null {
  const messages = details
    .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg ?? "") : ""))
    .filter(Boolean);
  return messages.length > 0 ? messages.join(", ") : null;
}
