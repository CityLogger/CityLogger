export type BackendErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AUTHENTICATED"
  | "VALIDATION"
  | "DATABASE"
  | "STORAGE"
  | "NETWORK"
  | "UNKNOWN";

export class BackendError extends Error {
  constructor(
    public readonly code: BackendErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export function normaliseBackendError(error: unknown, fallback: string) {
  if (error instanceof BackendError) return error;
  const source = error as { message?: string; status?: number } | null;
  const code = source?.status === 0 ? "NETWORK" : "DATABASE";
  return new BackendError(code, source?.message || fallback, error);
}
