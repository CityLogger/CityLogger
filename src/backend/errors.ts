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
  const diagnosticCode = /^[A-Z0-9_]{1,32}$/.test(source?.code || "") ? source!.code : "UNKNOWN";
  // Never log messages/details/hints: they may contain user text, SQL or tokens.
  console.warn("CityLog backend request failed", {code: diagnosticCode, status: Number.isInteger(source?.status) ? source?.status : undefined});
  if (source?.status === 401 || source?.code === "PGRST301") return new BackendError("NOT_AUTHENTICATED", "Your session has expired. Sign in again to continue; your saved journal is safe.", error);
  if (source?.code === "42501" || source?.status === 403) return new BackendError("DATABASE", "You cannot access this entry. Refresh your journal or sign in again.", error);
  if (source?.status === 0 || error instanceof TypeError) return new BackendError("NETWORK", "Could not confirm the request. Check your connection and retry.", error);
  if (source?.status === 429) return new BackendError("NETWORK", "Too many requests. Wait a moment, then try again.", error);
  return new BackendError("DATABASE", fallback, error);
}
