export type StoredCity = {
  geonameId?: string | null;
  id: string;
  name: string;
  country: string;
  continent: string;
  lat: number;
  lng: number;
  emoji: string;
  rating: number;
  ratings: {
    personal: number;
    culture: number | null;
    architecture: number | null;
    food: number | null;
    nature: number | null;
    nightlife: number | null;
  };
  dateFrom: string;
  dateTo: string;
  createdAt?: string;
  visitType: string;
  note: string;
  photoUrl?: string;
};

export type VisitRow = {
  geoname_id?: string | null;
  id: string;
  city_name: string;
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  emoji: string;
  overall_rating: number | string;
  personal_rating: number | string;
  culture_rating: number | string | null;
  architecture_rating: number | string | null;
  food_rating: number | string | null;
  nature_rating: number | string | null;
  nightlife_rating: number | string | null;
  date_from: string | null;
  date_to: string | null;
  created_at?: string;
  visit_type: string | null;
  note: string | null;
};

export const VISIT_COLUMNS = "id, city_name, country, continent, latitude, longitude, emoji, overall_rating, personal_rating, culture_rating, architecture_rating, food_rating, nature_rating, nightlife_rating, date_from, date_to, visit_type, note, created_at";

export function calculateStoredOverall(ratings: StoredCity["ratings"]) {
  const values = Object.values(ratings).filter((value): value is number => value !== null);
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function validateVisit(city: Omit<StoredCity, "id">) {
  if (city.geonameId && !/^[1-9][0-9]*$/.test(city.geonameId)) return "This city's geographic identifier is invalid.";
  if (!city.name.trim() || !city.country.trim() || !city.continent.trim()) return "City location details are required.";
  if (!Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90 || !Number.isFinite(city.lng) || city.lng < -180 || city.lng > 180) return "City coordinates are invalid.";
  for (const date of [city.dateFrom, city.dateTo]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) return "Choose a valid visit date or leave it blank.";
  }
  if (city.dateFrom && city.dateTo && city.dateTo < city.dateFrom) return "The departure date cannot be before the arrival date.";
  if (!Number.isFinite(city.ratings.personal) || city.ratings.personal < 1 || city.ratings.personal > 5) return "Personal experience is required.";
  if (city.note.length > 160) return "Notes must be 160 characters or fewer.";
  if (!Number.isFinite(city.rating) || city.rating < 1 || city.rating > 5) return "The overall rating must be between 1 and 5.";
  const scores = [city.ratings.personal, city.ratings.culture, city.ratings.architecture, city.ratings.food, city.ratings.nature, city.ratings.nightlife];
  if (scores.some(score => score !== null && (!Number.isFinite(score) || score < 1 || score > 5 || score * 2 % 1 !== 0))) return "Category ratings must use half-star values between 1 and 5.";
  return null;
}

export const fromVisitRow = (row: VisitRow): StoredCity => ({
  ...(row.geoname_id ? { geonameId: row.geoname_id } : {}),
  id: row.id,
  name: row.city_name,
  country: row.country,
  continent: row.continent,
  lat: row.latitude,
  lng: row.longitude,
  emoji: row.emoji,
  rating: Number(row.overall_rating),
  ratings: {
    personal: Number(row.personal_rating),
    culture: row.culture_rating === null ? null : Number(row.culture_rating),
    architecture: row.architecture_rating === null ? null : Number(row.architecture_rating),
    food: row.food_rating === null ? null : Number(row.food_rating),
    nature: row.nature_rating === null ? null : Number(row.nature_rating),
    nightlife: row.nightlife_rating === null ? null : Number(row.nightlife_rating)
  },
  dateFrom: row.date_from || "",
  dateTo: row.date_to || "",
  ...(row.created_at ? {createdAt:row.created_at} : {}),
  visitType: row.visit_type || "",
  note: row.note || ""
});

export const toVisitRow = (city: Omit<StoredCity, "id">, userId: string, id: string) => ({
  ...(city.geonameId ? { geoname_id: city.geonameId } : {}),
  id,
  user_id: userId,
  city_name: city.name.trim(),
  country: city.country.trim(),
  continent: city.continent.trim(),
  latitude: city.lat,
  longitude: city.lng,
  emoji: city.emoji,
  overall_rating: city.rating,
  personal_rating: city.ratings.personal,
  culture_rating: city.ratings.culture,
  architecture_rating: city.ratings.architecture,
  food_rating: city.ratings.food,
  nature_rating: city.ratings.nature,
  nightlife_rating: city.ratings.nightlife,
  date_from: city.dateFrom || null,
  date_to: city.dateTo || null,
  visit_type: city.visitType.trim() || null,
  note: city.note.trim() || null
});
