/**
 * Standard API response envelope types (Phase 2).
 *
 * Mirrors the backend envelope produced by `backend/src/utils/apiResponse.js`:
 *   Success: { success: true, data: <T>, meta?: ApiMeta }
 *   Error:   { success: false, error: { code, message, details? } }
 *
 * See docs/API-STANDARDIZATION-PLAN.md (repo root).
 */

export interface ApiPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  message?: string;
  count?: number;
  pagination?: ApiPagination;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  /** Stable, machine-readable code (UPPER_SNAKE_CASE), e.g. VALIDATION_ERROR. */
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

/** Stable error codes emitted by the backend (keep in sync with apiResponse.js). */
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "NOT_ACCEPTABLE"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "UPSTREAM_ERROR"
  | (string & {});
