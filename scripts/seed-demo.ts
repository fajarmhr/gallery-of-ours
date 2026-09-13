import { eq } from "drizzle-orm";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { db } from "@/db";
import { account, albums, comments, editGrants, favorites, media, milestones, reactions, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { findOrCreatePlace } from "@/lib/geocode";
import { processMedia } from "@/lib/media-processing";
import { mediaKeys, storage } from "@/lib/storage";
import { renderScene, SCENES } from "./demo-images";

export const DEMO_DOMAIN = "demo.gallery-of-ours.local";
const PASSWORD = process.env.DEMO_PASSWORD ?? "kenangan123";

type Scene = keyof typeof SCENES;
type Spot = { name: string; city: string; region: string; lat: number; lng: number };

const SPOTS = {
  jimbaran: { name: "Jimbaran Beach", city: "Badung", region: "Bali", lat: -8.7909, lng: 115.1603 },
  sanur: { name: "Sanur", city: "Denpasar", region: "Bali", lat: -8.6936, lng: 115.2627 },
  jatiluwih: { name: "Jatiluwih", city: "Tabanan", region: "Bali", lat: -8.3706, lng: 115.1316 },
  ubud: { name: "Ubud", city: "Gianyar", region: "Bali", lat: -8.5069, lng: 115.2625 },
  denpasar: { name: "Denpasar", city: "Denpasar", region: "Bali", lat: -8.6705, lng: 115.2126 },
  solo: { name: "Surakarta", city: "Surakarta", region: "Jawa Tengah", lat: -7.5695, lng: 110.8284 },
  malioboro: { name: "Malioboro", city: "Yogyakarta", region: "DI Yogyakarta", lat: -7.7925, lng: 110.3658 },
  bromo: { name: "Mount Bromo", city: "Probolinggo", region: "Jawa Timur", lat: -7.9425, lng: 112.953 },
  malang: { name: "Malang", city: "Malang", region: "Jawa Timur", lat: -7.9666, lng: 112.6326 },
  bandung: { name: "Braga", city: "Bandung", region: "Jawa Barat", lat: -6.9175, lng: 107.6094 },
  kaliurang: { name: "Kaliurang", city: "Sleman", region: "DI Yogyakarta", lat: -7.5997, lng: 110.4256 },
} satisfies Record<string, Spot>;

type Shot = { scene: Scene; at: string; spot?: keyof typeof SPOTS; by: string; caption?: string; ai?: [string, string, string[]]; portrait?: boolean };

async function ensureUser(name: string, username: string, role: "superadmin" | "admin" | "member", status: "active" | "pending" = "active", relation?: string) {
  const email = `${username}@${DEMO_DOMAIN}`;
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) return existing;
  const context = await auth.$context;
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name, email, emailVerified: true, username, displayUsername: username, role, status, relationNote: relation ?? null });
  await db.insert(account).values({ id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: await context.password.hash(PASSWORD) });
  const [created] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return created!;
}

async function thumbhashOf(buffer: Buffer) {
  const { data, info } = await sharp(buffer).resize(100, 100, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");
}

async function main() {
  const [already] = await db.select({ id: albums.id }).from(albums).where(eq(albums.isDemo, true)).limit(1);
  if (already) {
    console.log("Demo content already exists. Run `pnpm seed:remove` first to start over.");
    return;
  }

  console.log("Creating demo family…");
  const people = {
    papa: await ensureUser("Papa", "papa", "superadmin"),
    mama: await ensureUser("Mama", "mama", "admin"),
    raka: await ensureUser("Raka", "raka", "admin"),
    sari: await ensureUser("Tante Sari", "sari", "member"),
    budi: await ensureUser("Om Budi", "budi", "member"),
    nenek: await ensureUser("Nenek", "nenek", "member"),
  };
  await ensureUser("Dinda Putri", "dinda", "member", "pending", "Om Budi's daughter");
  await ensureUser("Yusuf Hamdani", "yusuf", "member", "pending", "Tante Sari's husband");

  const files = await storage();
  const placeIds = new Map<string, string | null>();
  for (const [key, spot] of Object.entries(SPOTS)) {
    placeIds.set(key, await findOrCreatePlace(spot.lat, spot.lng, { name: spot.name, city: spot.city, region: spot.region, country: "Indonesia" }));
  }

  const albumSpecs: { title: string; note: string; description?: string; category: string; start: string; end: string; by: keyof typeof people; unlockAt?: string; shots: Shot[] }[] = [
    {
      title: "Bali, August 2024", note: "Nenek's first time on a plane", category: "trips", start: "2024-08-17", end: "2024-08-23", by: "mama",
      description: "A week of sunsets, rice fields and far too much nasi campur.",
      shots: [
        { scene: "beach", at: "2024-08-17T17:40:00+08:00", spot: "jimbaran", by: "mama", caption: "Our first sunset in Jimbaran", ai: ["The family watching a golden sunset over the sea", "Keluarga menikmati matahari terbenam keemasan di pantai", ["beach", "sunset", "sea", "bali"]] },
        { scene: "beach", at: "2024-08-17T18:05:00+08:00", spot: "jimbaran", by: "raka" },
        { scene: "sea", at: "2024-08-18T07:15:00+08:00", spot: "sanur", by: "raka", caption: "Morning swim before breakfast" },
        { scene: "sea", at: "2024-08-18T09:30:00+08:00", spot: "sanur", by: "papa", portrait: true },
        { scene: "terraces", at: "2024-08-19T10:10:00+08:00", spot: "jatiluwih", by: "papa", caption: "Jatiluwih rice terraces", ai: ["Green rice terraces stretching across the hills", "Sawah terasering hijau membentang di perbukitan", ["rice field", "terraces", "green", "nature"]] },
        { scene: "terraces", at: "2024-08-19T10:40:00+08:00", spot: "jatiluwih", by: "mama", portrait: true },
        { scene: "garden", at: "2024-08-20T15:00:00+08:00", spot: "ubud", by: "mama", caption: "Hiding from the heat in Ubud" },
        { scene: "lanterns", at: "2024-08-21T20:30:00+08:00", spot: "ubud", by: "raka", caption: "Night market, three kinds of sate" },
        { scene: "cake", at: "2024-08-21T19:00:00+08:00", spot: "denpasar", by: "sari", caption: "Nenek's birthday dinner", portrait: true },
        { scene: "rain", at: "2024-08-23T12:00:00+08:00", spot: "denpasar", by: "mama", caption: "Rain at the airport, nobody wanted to leave" },
      ],
    },
    {
      title: "Mudik Lebaran 2025", note: "Opor ayam, three helpings each", category: "celebrations", start: "2025-03-29", end: "2025-04-06", by: "papa",
      shots: [
        { scene: "mountains", at: "2025-03-29T06:30:00+07:00", spot: "solo", by: "papa", caption: "On the road to Solo" },
        { scene: "garden", at: "2025-03-31T08:00:00+07:00", spot: "solo", by: "mama", caption: "Idul Fitri morning at Nenek's", ai: ["Family gathered in a sunny garden for Eid morning", "Keluarga berkumpul di taman yang cerah saat pagi Lebaran", ["eid", "family", "garden", "lebaran"]] },
        { scene: "cake", at: "2025-03-31T12:00:00+07:00", spot: "solo", by: "nenek", caption: "Kue lebaran on every table" },
        { scene: "lanterns", at: "2025-04-02T19:30:00+07:00", spot: "malioboro", by: "raka", caption: "Malioboro at night" },
        { scene: "lanterns", at: "2025-04-02T20:10:00+07:00", spot: "malioboro", by: "budi", portrait: true },
      ],
    },
    {
      title: "Bromo road trip", note: "5am and absolutely freezing", category: "trips", start: "2024-06-07", end: "2024-06-09", by: "raka",
      shots: [
        { scene: "mountains", at: "2024-06-08T05:12:00+07:00", spot: "bromo", by: "raka", caption: "Bromo sunrise", ai: ["Layers of misty mountains at sunrise", "Lapisan pegunungan berkabut saat matahari terbit", ["mountain", "sunrise", "bromo", "mist"]] },
        { scene: "mountains", at: "2024-06-08T05:40:00+07:00", spot: "bromo", by: "papa", portrait: true },
        { scene: "rain", at: "2024-06-08T09:00:00+07:00", spot: "bromo", by: "raka", caption: "Foggy jeep ride down" },
        { scene: "terraces", at: "2024-06-09T11:00:00+07:00", spot: "malang", by: "mama", caption: "Tea fields near Malang" },
      ],
    },
    {
      title: "Kakek turns 70", note: "He cried at the slideshow", category: "celebrations", start: "2025-01-12", end: "2025-01-12", by: "mama",
      shots: [
        { scene: "garden", at: "2025-01-12T16:00:00+08:00", spot: "denpasar", by: "sari", caption: "Everyone arriving at the house" },
        { scene: "cake", at: "2025-01-12T19:30:00+08:00", spot: "denpasar", by: "mama", caption: "Seventy candles would not fit", portrait: true },
        { scene: "lanterns", at: "2025-01-12T20:15:00+08:00", spot: "denpasar", by: "raka", caption: "Lights in the garden after dinner" },
      ],
    },
    {
      title: "Raka's graduation", note: "Finally!", category: "celebrations", start: "2025-08-24", end: "2025-08-24", by: "mama",
      shots: [
        { scene: "sea", at: "2025-08-24T09:00:00+07:00", spot: "bandung", by: "papa", caption: "The ceremony hall" },
        { scene: "garden", at: "2025-08-24T11:30:00+07:00", spot: "bandung", by: "mama", caption: "The family photo", portrait: true },
        { scene: "rain", at: "2025-08-24T19:00:00+07:00", spot: "bandung", by: "raka", caption: "Dinner on Braga in the rain" },
      ],
    },
    {
      title: "Everyday moments", note: "The small stuff counts too", category: "everyday", start: "2023-09-13", end: "2026-09-12", by: "mama",
      shots: [
        { scene: "garden", at: "2023-09-13T16:30:00+07:00", spot: "kaliurang", by: "papa", caption: "Mangoes from Nenek's tree", ai: ["Sunlight through leaves in a backyard garden", "Sinar matahari menembus dedaunan di kebun belakang", ["garden", "mango", "home", "afternoon"]] },
        { scene: "cake", at: "2022-09-13T15:00:00+07:00", spot: "kaliurang", by: "nenek", caption: "Sambal mangga for everyone" },
        { scene: "rain", at: "2026-02-10T17:00:00+07:00", spot: "kaliurang", by: "budi", caption: "Rainy week, board games again" },
        { scene: "garden", at: "2026-09-12T08:00:00+07:00", spot: "kaliurang", by: "mama", caption: "Sunday morning coffee" },
        { scene: "sea", at: "2026-07-20T10:00:00+07:00", by: "sari", caption: "A picture without a place" },
      ],
    },
    {
      title: "Letters for 2027", note: "Open together on New Year's Day", category: "other", start: "2026-09-01", end: "2026-09-01", by: "papa", unlockAt: "2027-01-01T00:00:00+07:00",
      shots: [
        { scene: "lanterns", at: "2026-09-01T20:00:00+07:00", spot: "kaliurang", by: "papa", caption: "A wish for next year" },
        { scene: "garden", at: "2026-09-01T20:10:00+07:00", spot: "kaliurang", by: "papa" },
      ],
    },
  ];

  let seed = 7;
  const created: { albumId: string; mediaIds: string[] }[] = [];
  for (const spec of albumSpecs) {
    console.log(`Album: ${spec.title}`);
    const [album] = await db
      .insert(albums)
      .values({
        title: spec.title,
        note: spec.note,
        description: spec.description ?? null,
        category: spec.category,
        startDate: spec.start,
        endDate: spec.end,
        unlockAt: spec.unlockAt ? new Date(spec.unlockAt) : null,
        createdById: people[spec.by].id,
        isDemo: true,
      })
      .returning({ id: albums.id });
    const mediaIds: string[] = [];
    for (const shot of spec.shots) {
      seed += 13;
      const { buffer, width, height } = await renderScene(shot.scene, seed, shot.portrait);
      const id = crypto.randomUUID();
      const key = mediaKeys(id).original("jpg");
      await files.put(key, buffer, "image/jpeg");
      const spot = shot.spot ? SPOTS[shot.spot] : null;
      await db.insert(media).values({
        id,
        albumId: album!.id,
        uploaderId: people[shot.by as keyof typeof people].id,
        type: "photo",
        status: "processing",
        originalKey: key,
        originalName: `IMG_${String(seed).padStart(4, "0")}.JPG`,
        mime: "image/jpeg",
        sizeBytes: buffer.length,
        width,
        height,
        thumbhash: await thumbhashOf(buffer),
        takenAt: new Date(shot.at),
        lat: spot?.lat ?? null,
        lng: spot?.lng ?? null,
        placeId: shot.spot ? (placeIds.get(shot.spot) ?? null) : null,
        caption: shot.caption ?? null,
        aiCaption: shot.ai ? { en: shot.ai[0], id: shot.ai[1] } : null,
        aiTags: shot.ai ? shot.ai[2] : null,
        isDemo: true,
      });
      await processMedia(id, { skipAI: true });
      mediaIds.push(id);
    }
    created.push({ albumId: album!.id, mediaIds });
  }

  const bali = created[0]!;
  await db.insert(editGrants).values({ userId: people.sari.id, albumId: bali.albumId, grantedById: people.mama.id, expiresAt: new Date(Date.now() + 5 * 86_400_000) });

  const firstPhoto = bali.mediaIds[0]!;
  await db.insert(favorites).values([
    { userId: people.papa.id, mediaId: firstPhoto },
    { userId: people.mama.id, mediaId: firstPhoto },
    { userId: people.raka.id, mediaId: bali.mediaIds[4]! },
    { userId: people.papa.id, mediaId: created[2]!.mediaIds[0]! },
  ]);
  await db.insert(reactions).values([
    { mediaId: firstPhoto, userId: people.nenek.id, kind: "heart" },
    { mediaId: firstPhoto, userId: people.sari.id, kind: "heart" },
    { mediaId: firstPhoto, userId: people.budi.id, kind: "wow" },
    { mediaId: bali.mediaIds[8]!, userId: people.raka.id, kind: "touched" },
    { mediaId: created[4]!.mediaIds[1]!, userId: people.papa.id, kind: "clap" },
    { mediaId: created[4]!.mediaIds[1]!, userId: people.nenek.id, kind: "clap" },
  ]);
  await db.insert(comments).values([
    { mediaId: firstPhoto, userId: people.nenek.id, body: "Indah sekali, kapan kita ke sana lagi?" },
    { mediaId: firstPhoto, userId: people.raka.id, body: "Next year, promise!" },
    { mediaId: created[4]!.mediaIds[1]!, userId: people.papa.id, body: "Proud of you, nak." },
  ]);

  await db.insert(milestones).values([
    { title: "Mama & Papa's anniversary", date: "1998-09-25", kind: "anniversary", repeatsYearly: true, createdById: people.papa.id, isDemo: true },
    { title: "Raka's birthday", date: "2002-10-03", kind: "birthday", repeatsYearly: true, createdById: people.mama.id, isDemo: true },
    { title: "Nenek's birthday", date: "1950-11-20", kind: "birthday", repeatsYearly: true, createdById: people.mama.id, isDemo: true },
  ]);

  console.log(`
Demo family ready. Sign in with any of these (password: ${PASSWORD}):
  papa   superadmin
  mama   admin
  raka   admin
  sari   member with editing access to "Bali, August 2024"
  budi   member (view only)
  nenek  member (view only)
Waiting for approval: dinda, yusuf
Remove everything with: pnpm seed:remove`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
