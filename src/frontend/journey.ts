export const ONBOARDING_KEY = "citylog-onboarding-v1";
export const GUEST_KEY = "citylog-guest-journal-v1";

type LocatedVisit = { id: string | number; name: string; country: string; dateFrom: string; dateTo: string };

export function cityIdentity(city: Pick<LocatedVisit, "name" | "country">) {
  return `${city.name.normalize("NFKC").trim().toLocaleLowerCase()}|${city.country.trim().toLocaleLowerCase()}`;
}

/** Stable sorting preserves insertion order for visits with identical dates. */
export function newestVisits<T extends LocatedVisit>(visits: T[]): T[] {
  return [...visits].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom) || b.dateTo.localeCompare(a.dateTo));
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

export function visitHistory<T extends LocatedVisit>(visits: T[], city: Pick<LocatedVisit, "name" | "country">): T[] {
  return newestVisits(visits.filter(visit => cityIdentity(visit) === cityIdentity(city)));
}
