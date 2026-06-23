"use client";

import { redirectToLogin } from "@/lib/auth";

/**
 * Wrapper fetch yang auto-redirect ke /login saat menerima 401.
 *
 * `redirectToLogin` (defined in lib/auth) handles:
 *   - clearing all client-side session state,
 *   - capturing the current full URL (path + search + hash) so the user
 *     is returned to the exact same page after re-login,
 *   - persisting the URL to sessionStorage as a safety net, and
 *   - navigating to /login?next=<encoded-current-url>.
 *
 * Use this in place of fetch() in any lib that requires auth.
 */
export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status === 401) {
    redirectToLogin({ reason: "unauthorized" });
  }
  return response;
}
