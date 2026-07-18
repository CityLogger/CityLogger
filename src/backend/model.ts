export type StoredCity = {
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
    culture: number;
    architecture: number;
    food: number;
    nature: number | null;
    nightlife: number | null;
  };
  dateFrom: string;
  dateTo: string;
  visitType: string;
  note: string;
};

export type VisitRow = {
  id: string;
  city_name: string;
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  emoji: string;
  overall_rating: number | string;
  personal_rating: number | string;
  culture_rating: number | string;
  architecture_rating: number | string;
  food_rating: number | string;
  nature_rating: number | string | null;
  nightlife_rating: number | string | null;
  date_from: string;
  date_to: string;
  visit_type: string | null;
  note: string | null;
};

export const VISIT_COLUMNS = "id, city_name, country, continent, latitude, longitude, emoji, overall_rating, personal_rating, culture_rating, architecture_rating, food_rating, nature_rating, nightlife_rating, date_from, date_to, visit_type, note";

export function validatePhoto(file: Pick<File, "type" | "size">) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowed.includes(file.type)) return "Choose a JPEG, PNG, WebP or HEIC photograph.";
  if (file.size > 10 * 1024 * 1024) return "Photographs must be smaller than 10 MB.";
  return null;
}

export function calculateStoredOverall(ratings: StoredCity["ratings"]) {
  const values = Object.values(ratings).filter((value): value is number => value !== null);
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function validateVisit(city: Omit<StoredCity, "id">) {
  if (!city.name.trim() || !city.country.trim() || !city.continent.trim()) return "City location details are required.";
  if (!Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90 || !Number.isFinite(city.lng) || city.lng < -180 || city.lng > 180) return "City coordinates are invalid.";
  if (city.dateTo < city.dateFrom) return "The departure date cannot be before the arrival date.";
  if (city.note.length > 160) return "Notes must be 160 characters or fewer.";
  if (city.rating < 1 || city.rating > 5) return "The overall rating must be between 1 and 5.";
  const scores = [city.ratings.personal, city.ratings.culture, city.ratings.architecture, city.ratings.food, city.ratings.nature, city.ratings.nightlife];
  if (scores.some(score => score !== null && (score < 1 || score > 5 || score * 2 % 1 !== 0))) return "Category ratings must use half-star values between 1 and 5.";
  return null;
}

export const fromVisitRow = (row: VisitRow): StoredCity => ({
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
    culture: Number(row.culture_rating),
    architecture: Number(row.architecture_rating),
    food: Number(row.food_rating),
    nature: row.nature_rating === null ? null : Number(row.nature_rating),
    nightlife: row.nightlife_rating === null ? null : Number(row.nightlife_rating)
  },
  dateFrom: row.date_from,
  dateTo: row.date_to,
  visitType: row.visit_type || "",
  note: row.note || ""
});

export const toVisitRow = (city: Omit<StoredCity, "id">, userId: string, id: string) => ({
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
  date_from: city.dateFrom,
  date_to: city.dateTo,
  visit_type: city.visitType.trim() || null,
  note: city.note.trim() || null
});
