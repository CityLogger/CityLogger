import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secret = process.env.SUPABASE_SECRET_KEY;
const email = process.env.CITYLOGGER_REVIEW_EMAIL || "appreview@citylogger.test";
const password = process.env.CITYLOGGER_REVIEW_PASSWORD;

if (!url || !secret || !password) {
  throw new Error("Set SUPABASE_URL, SUPABASE_SECRET_KEY and CITYLOGGER_REVIEW_PASSWORD before seeding.");
}

const headers = { apikey: secret, Authorization: `Bearer ${secret}` };

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers, ...(options.body && !(options.body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

const users = await request("/auth/v1/admin/users?per_page=1000");
let user = users.users?.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase());
if (user) {
  user = await request(`/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true, user_metadata: { display_name: "Apple Review" } })
  });
} else {
  user = await request("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: "Apple Review" } })
  });
}

const userId = user.id;
const city = (name, country, continent, latitude, longitude, emoji, ratings, date_from, date_to, visit_type, note) => ({
  id: randomUUID(), user_id: userId, city_name: name, country, continent, latitude, longitude, emoji,
  overall_rating: Math.round((Object.values(ratings).filter(value => value !== null).reduce((sum, value) => sum + value, 0) / Object.values(ratings).filter(value => value !== null).length) * 10) / 10,
  personal_rating: ratings.personal, culture_rating: ratings.culture, architecture_rating: ratings.architecture,
  food_rating: ratings.food, nature_rating: ratings.nature, nightlife_rating: ratings.nightlife,
  date_from, date_to, visit_type, note
});

const visits = [
  city("Lisbon", "Portugal", "Europe", 38.7223, -9.1393, "🇵🇹", { personal: 5, culture: 4.5, architecture: 5, food: 5, nature: 4.5, nightlife: 4.5 }, "2026-05-10", "2026-05-16", "Holiday", "Golden evenings, tiled streets and unforgettable small plates."),
  city("Kyoto", "Japan", "Asia", 35.0116, 135.7681, "🇯🇵", { personal: 5, culture: 5, architecture: 5, food: 4.5, nature: 4.5, nightlife: null }, "2025-10-12", "2025-10-19", "Holiday", "Quiet gardens before breakfast—a city that rewards slowing down."),
  city("Cape Town", "South Africa", "Africa", -33.9249, 18.4241, "🇿🇦", { personal: 4.5, culture: 4, architecture: 4, food: 4.5, nature: 5, nightlife: 4 }, "2026-02-03", "2026-02-12", "Road trip", "Mountains, ocean and long lunches in one remarkable place."),
  city("New York", "United States", "North America", 40.7128, -74.006, "🇺🇸", { personal: 4, culture: 5, architecture: 4.5, food: 4.5, nature: 3, nightlife: 5 }, "2024-09-18", "2024-09-25", "City break", "Endless energy, neighbourhood walks and a different meal every night."),
  city("Buenos Aires", "Argentina", "South America", -34.6037, -58.3816, "🇦🇷", { personal: 4.5, culture: 4.5, architecture: 4, food: 4.5, nature: 3.5, nightlife: 5 }, "2026-01-08", "2026-01-15", "Visiting friends or family", "Late dinners, leafy streets and music that seemed to spill outside."),
  city("Melbourne", "Australia", "Oceania", -37.8136, 144.9631, "🇦🇺", { personal: 4, culture: 4.5, architecture: 3.5, food: 5, nature: 3.5, nightlife: 4 }, "2023-11-04", "2023-11-13", "Work", "Excellent coffee, thoughtful galleries and easy tram journeys."),
  city("Marrakech", "Morocco", "Africa", 31.6295, -7.9811, "🇲🇦", { personal: 2.5, culture: 4, architecture: 4, food: 3.5, nature: 2, nightlife: 2 }, "2024-03-06", "2024-03-10", "City break", "Beautiful and intense, though the busiest areas felt overwhelming."),
  city("Reykjavík", "Iceland", "Europe", 64.1466, -21.9426, "🇮🇸", { personal: 4, culture: 3.5, architecture: 3, food: 3.5, nature: 5, nightlife: null }, "2022-01-14", "2022-01-19", "Road trip", "A compact base for landscapes that made every drive worthwhile."),
  city("Bangkok", "Thailand", "Asia", 13.7563, 100.5018, "🇹🇭", { personal: 3.5, culture: 4, architecture: 3.5, food: 5, nature: 2.5, nightlife: 4.5 }, "2025-06-21", "2025-06-27", "Holiday", "The food was exceptional; the pace and heat took time to adjust to."),
  city("Brussels", "Belgium", "Europe", 50.8503, 4.3517, "🇧🇪", { personal: 2, culture: 3, architecture: 3, food: 3, nature: 2, nightlife: 2.5 }, "2021-08-02", "2021-08-05", "Day trip", "Some lovely squares, but it never quite clicked on this short visit.")
];

for (const table of ["personal_list_cities", "personal_lists", "wishlist_cities", "visit_photographs", "visits"]) {
  await request(`/rest/v1/${table}?user_id=eq.${userId}`, { method: "DELETE" });
}
await request(`/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({ display_name: "Apple Review", yearly_goal: 12, ranking_order: [visits[1].id, visits[0].id, visits[4].id, visits[2].id, visits[5].id, visits[3].id, visits[8].id, visits[7].id, visits[6].id, visits[9].id] })
});
await request("/rest/v1/visits", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(visits) });

const wishlist = [
  ["Mexico City", "Mexico", "North America", 19.4326, -99.1332, "🇲🇽"],
  ["Hanoi", "Vietnam", "Asia", 21.0278, 105.8342, "🇻🇳"],
  ["Seoul", "South Korea", "Asia", 37.5665, 126.978, "🇰🇷"],
  ["Barcelona", "Spain", "Europe", 41.3874, 2.1686, "🇪🇸"],
  ["Vancouver", "Canada", "North America", 49.2827, -123.1207, "🇨🇦"]
].map(([city_name, country, continent, latitude, longitude, emoji]) => ({ user_id: userId, city_name, country, continent, latitude, longitude, emoji }));
await request("/rest/v1/wishlist_cities", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(wishlist) });

const lists = [
  { id: randomUUID(), user_id: userId, title: "Best food cities", position: 0 },
  { id: randomUUID(), user_id: userId, title: "Most underrated", position: 1 }
];
await request("/rest/v1/personal_lists", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(lists) });
const listCities = [
  [lists[0].id, visits[8].id, 0], [lists[0].id, visits[0].id, 1], [lists[0].id, visits[5].id, 2], [lists[0].id, visits[1].id, 3],
  [lists[1].id, visits[4].id, 0], [lists[1].id, visits[7].id, 1], [lists[1].id, visits[2].id, 2]
].map(([list_id, visit_id, position]) => ({ list_id, user_id: userId, visit_id, position }));
await request("/rest/v1/personal_list_cities", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(listCities) });

for (const [visit, filename, localPath] of [
  [visits[0], "lisbon-review-memory.png", "review-content/lisbon-review-memory.png"],
  [visits[1], "kyoto-review-memory.png", "review-content/kyoto-review-memory.png"]
]) {
  const storagePath = `${userId}/${visit.id}/${filename}`;
  const bytes = new Uint8Array(await readFile(resolve(localPath)));
  await request(`/storage/v1/object/visit-photos/${storagePath}`, { method: "POST", headers: { "Content-Type": "image/png", "x-upsert": "true" }, body: bytes });
  await request("/rest/v1/visit_photographs", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, visit_id: visit.id, storage_path: storagePath })
  });
}

console.log(JSON.stringify({
  email,
  account_id: userId,
  email_verified: Boolean(user.email_confirmed_at),
  visits: visits.length,
  photographs: 2,
  want_to_visit: wishlist.length,
  personal_lists: lists.length,
  yearly_goal: 12,
  current_year_visits: visits.filter(visit => visit.date_from.startsWith("2026-")).length
}, null, 2));
