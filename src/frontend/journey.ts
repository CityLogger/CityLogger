export const ONBOARDING_KEY = "citylog-onboarding-v1";
export const GUEST_KEY = "citylog-guest-journal-v1";

export type GeographicCity = { name: string; country: string; lat?: number; lng?: number; geonameId?: string | null };
type LocatedVisit = GeographicCity & { id: string | number; dateFrom: string; dateTo: string; createdAt?: string };

export const visitSortDate = (visit: Pick<LocatedVisit,"dateFrom"|"dateTo"|"createdAt">) => visit.dateFrom || visit.dateTo || visit.createdAt?.slice(0,10) || "";

export function visitMonth(date: string, long = false) {
  return date ? new Intl.DateTimeFormat("en-GB", {month:long?"long":"short",year:"numeric"}).format(new Date(`${date}T12:00:00`)) : "Date not added";
}

export function cityIdentity(city: GeographicCity) {
  if (city.geonameId) return `geonames:${city.geonameId}`;
  // Exact coordinates only: never guess an identifier for a historic record.
  return `${city.name.normalize("NFKC").trim().toLowerCase()}|${city.country.trim().toLowerCase()}|${city.lat ?? "unknown"}|${city.lng ?? "unknown"}`;
}

/** Stable sorting preserves insertion order for visits with identical dates. */
export function newestVisits<T extends LocatedVisit>(visits: T[]): T[] {
  return [...visits].sort((a, b) => visitSortDate(b).localeCompare(visitSortDate(a)) || b.dateTo.localeCompare(a.dateTo) || (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function latestCities<T extends LocatedVisit>(visits: T[]): T[] {
  const seen = new Set<string>();
  return newestVisits(visits).filter(visit => {
    const key = cityIdentity(visit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function visitHistory<T extends LocatedVisit>(visits: T[], city: GeographicCity): T[] {
  return newestVisits(visits.filter(visit => cityIdentity(visit) === cityIdentity(city)));
}
