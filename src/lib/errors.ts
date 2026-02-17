export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTH_ERROR = "AUTH_ERROR",
  NOT_FOUND = "NOT_FOUND",
  FORBIDDEN = "FORBIDDEN",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SYNC_PAYLOAD_INVALID = "SYNC_PAYLOAD_INVALID",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  CONFLICT = "CONFLICT",
}

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

export function actionSuccess<T>(data: T, warning?: string): ActionResult<T> {
  return { success: true, data, ...(warning ? { warning } : {}) };
}

export function actionError(error: string): ActionResult<never> {
  return { success: false, error };
}
