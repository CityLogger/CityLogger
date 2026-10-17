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
  const source = error as { message?: string; status?: number; code?: string } | null;
  if ((source?.code === "42703" || source?.code === "PGRST204") && source.message?.includes("geoname_id")) {
    return new BackendError("DATABASE", "The cloud database needs the city-identity update before this city can be saved. Your entry has not been discarded.", error);
  }
  const code = source?.status === 0 ? "NETWORK" : "DATABASE";
  return new BackendError(code, source?.message || fallback, error);
}
