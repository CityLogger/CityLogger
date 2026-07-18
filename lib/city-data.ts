// Stable public facade for the application. Backend implementation details live
// in focused modules so database, storage and account operations stay separate.
export { downloadAccountData } from "./backend/account";
export { createPhotoUrl, uploadVisitPhoto } from "./backend/photos";
export { calculateStoredOverall, validatePhoto, validateVisit } from "./backend/model";
export type { StoredCity } from "./backend/model";
export { createVisit, deleteVisit, loadVisits, updateVisit } from "./backend/visits";
