/** Prefer photos for a recap, while keeping video-only years viewable. */
export function buildRecapHighlights<T extends { id: string; type: "photo" | "video" }>(cards: T[], loved: T[]): T[] {
  const photos = cards.filter((card) => card.type === "photo");
  const candidates = photos.length ? photos : cards;
  const step = Math.max(1, Math.floor(candidates.length / 24));
  const sampled = candidates.filter((_, index) => index % step === 0);
  return [...new Map([...loved, ...sampled].map((card) => [card.id, card])).values()].slice(0, 24);
}
