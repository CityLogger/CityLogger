import type { StoredCity } from "../backend/model";
export type RatingKey = keyof StoredCity["ratings"];
export type Ratings = Record<RatingKey, number | null>;
export type CityId = number | string;

// Draft ratings can be unset; persisted visits require a personal score.
export type City = Omit<StoredCity, "id" | "ratings"> & { id: CityId; ratings: Ratings };

export type CityOption = Pick<StoredCity, "geonameId" | "name" | "country" | "continent" | "lat" | "lng" | "emoji"> & { id?: string; ascii?: string; population?: number };

export type PersonalList = { id: CityId; title: string; cityIds: CityId[] };
