/** Stable per-account UUIDs make retries idempotent without sharing IDs between accounts. */
export async function guestTransferId(owner: string, kind: "visit" | "list", id: string | number) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`citylog-import-v1:${owner}:${kind}:${id}`)));
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function verifyGuestTransfer(expected: { visits: string[]; lists: { id: string; cityIds: string[] }[]; wishlist: string[]; ranking: string[] }, visits: { id: string }[], state: { lists: { id: string; cityIds: string[] }[]; wishlist: { id: string }[]; rankingOrder: string[] }) {
  const ids = new Set(visits.map(item => item.id));
  if (expected.visits.some(id => !ids.has(id)) || expected.wishlist.some(id => !state.wishlist.some(item => item.id === id)) || expected.ranking.some(id => !state.rankingOrder.includes(id)) || expected.lists.some(list => {
    const saved = state.lists.find(item => item.id === list.id);
    return !saved || list.cityIds.some(id => !saved.cityIds.includes(id));
  })) throw new Error("Transfer verification failed. Guest entries remain on this device; retry the import.");
}
