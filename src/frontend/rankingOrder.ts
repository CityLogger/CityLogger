import { cityIdentity, latestCities } from "./journey";

type RankedVisit = Parameters<typeof latestCities>[0][number] & { rating: number };

/** One linear lookup build replaces history scans inside sorting and row actions. */
export function rankingIndex<T extends RankedVisit>(visits: T[], order: (string | number)[]) {
  const byId = new Map(visits.map(visit => [String(visit.id), visit]));
  const index = new Map<string, { id: string | number; position: number }>();
  order.forEach((id, position) => {
    const visit = byId.get(String(id));
    if (!visit) return;
    const identity = cityIdentity(visit);
    if (!index.has(identity)) index.set(identity, { id: visit.id, position });
  });
  return index;
}

/** Keep historical representative UUIDs so logging another visit does not move a city. */
export function canonicalRanking<T extends RankedVisit>(visits: T[], saved: (string | number)[] | null) {
  const byId = new Map(visits.map(visit => [String(visit.id), visit]));
  const seen = new Set<string>();
  const order: (string | number)[] = [];
  for (const id of saved || []) {
    const visit = byId.get(String(id));
    if (!visit || seen.has(cityIdentity(visit))) continue;
    seen.add(cityIdentity(visit));
    order.push(visit.id);
  }
  for (const visit of latestCities(visits).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))) {
    if (seen.has(cityIdentity(visit))) continue;
    seen.add(cityIdentity(visit));
    order.push(visit.id);
  }
  return order;
}

/** Only replace visible slots; hidden cities retain their exact positions. */
export function reorderVisible<T>(canonical: T[], visible: T[], from: T, to: T): T[] {
  const subset = [...visible];
  const start = subset.indexOf(from), end = subset.indexOf(to);
  if (start < 0 || end < 0) return [...canonical];
  subset.splice(end, 0, subset.splice(start, 1)[0]);
  const visibleSet = new Set(visible);
  let index = 0;
  return canonical.map(id => visibleSet.has(id) ? subset[index++] : id);
}
