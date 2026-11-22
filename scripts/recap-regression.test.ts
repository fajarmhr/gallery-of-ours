import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRecapHighlights } from "../src/lib/recap-highlights";

test("a video-only year without reactions still has a recap cover and highlights", () => {
  const videos = [{ id: "first-steps", type: "video" as const }, { id: "bedtime-story", type: "video" as const }];
  const highlights = buildRecapHighlights(videos, []);
  assert.equal(highlights[0]?.id, "first-steps");
  assert.equal(highlights.length, 2);
});

test("mixed years keep photo highlights and include a loved video only once", () => {
  const video = { id: "birthday-candles", type: "video" as const };
  const photo = { id: "birthday-table", type: "photo" as const };
  const ordinaryVideo = { id: "walking-home", type: "video" as const };
  assert.deepEqual(buildRecapHighlights([ordinaryVideo, photo, video], [video, photo]), [video, photo]);
});

test("a large recap stays bounded and does not repeat loved photos", () => {
  const photos = Array.from({ length: 78 }, (_, i) => ({ id: `memory-${i}`, type: "photo" as const }));
  const highlights = buildRecapHighlights(photos, [photos[0]!, photos[20]!]);
  assert.equal(highlights.length, 24);
  assert.equal(new Set(highlights.map((item) => item.id)).size, 24);
  assert.equal(highlights[0]?.id, photos[0]!.id);
});
