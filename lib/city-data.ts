import { supabase } from "./supabase";

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

const fromRow = (row: Record<string, any>): StoredCity => ({
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

const toRow = (city: Omit<StoredCity, "id">, userId: string) => ({
  user_id: userId,
  city_name: city.name,
  country: city.country,
  continent: city.continent,
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
  visit_type: city.visitType || null,
  note: city.note || null,
  updated_at: new Date().toISOString()
});

export async function loadVisits(): Promise<StoredCity[]> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("visits").select("*").order("date_from", { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function createVisit(city: Omit<StoredCity, "id">, userId: string): Promise<StoredCity> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("visits").insert(toRow(city, userId)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateVisit(city: StoredCity, userId: string): Promise<StoredCity> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("visits").update(toRow(city, userId)).eq("id", city.id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteVisit(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: photographs, error: photoReadError } = await supabase
    .from("visit_photographs").select("storage_path").eq("visit_id", id);
  if (photoReadError) throw photoReadError;
  const paths = (photographs || []).map(item => item.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("visit-photos").remove(paths);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadVisitPhoto(userId: string, visitId: string, file: File) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const validationError = validatePhoto(file);
  if (validationError) throw new Error(validationError);
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${visitId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("visit-photos").upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;
  const { error: recordError } = await supabase.from("visit_photographs").insert({ user_id: userId, visit_id: visitId, storage_path: path });
  if (recordError) {
    await supabase.storage.from("visit-photos").remove([path]);
    throw recordError;
  }
  return path;
}

export async function downloadAccountData(userId: string, email: string | undefined, createdAt: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const [{ data: profile, error: profileError }, { data: visits, error: visitsError }, { data: photographs, error: photosError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("visits").select("*").eq("user_id", userId),
    supabase.from("visit_photographs").select("id, visit_id, storage_path, created_at").eq("user_id", userId)
  ]);
  if (profileError || visitsError || photosError) throw profileError || visitsError || photosError;
  return { exported_at: new Date().toISOString(), account: { id: userId, email, created_at: createdAt }, profile, visits, photographs };
}
