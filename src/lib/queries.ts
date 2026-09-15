import { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  albums,
  editGrants,
  favorites,
  invites,
  media,
  milestones,
  places,
  reactions,
  shareLinks,
  user,
  type BilingualText,
} from "@/db/schema";
import { nextOccurrence } from "@/lib/format";
import { isAlbumLocked } from "@/lib/permissions";
import { sign } from "@/lib/signing";

/* ───────────── Share links ───────────── */

export async function getActiveShareLink(token: string) {
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt.getTime() < Date.now())) return null;
  return link;
}

export const shareCookieName = (token: string) => `share_${token.slice(0, 16)}`;

export const shareCookieValue = (link: { token: string; passwordHash: string | null }) =>
  sign(`share:${link.token}:${link.passwordHash ?? ""}`);

export async function shareAllowsAlbum(token: string, albumId: string, cookieValue: string | undefined) {
  const link = await getActiveShareLink(token);
  if (!link || link.albumId !== albumId) return false;
  if (!link.passwordHash) return true;
  return cookieValue === shareCookieValue(link);
}

/* ───────────── Media cards ───────────── */

export type MediaCard = {
  id: string;
  albumId: string;
  albumTitle: string | null;
  type: "photo" | "video";
  status: string;
  width: number;
  height: number;
  thumbhash: string | null;
  takenAt: string | null;
  createdAt: string;
  caption: string | null;
  aiCaption: BilingualText | null;
  durationSec: number | null;
  placeName: string | null;
  uploaderName: string | null;
  sizeBytes: number | null;
  originalName: string | null;
};

/** A photo's own place, or its album's place when it has none. Needs `albums` joined. */
const placeOfMedia = sql`coalesce(${media.placeId}, ${albums.placeId})`;

const cardColumns = {
  id: media.id,
  albumId: media.albumId,
  albumTitle: albums.title,
  type: media.type,
  status: media.status,
  width: media.width,
  height: media.height,
  thumbhash: media.thumbhash,
  takenAt: media.takenAt,
  createdAt: media.createdAt,
  caption: media.caption,
  aiCaption: media.aiCaption,
  durationSec: media.durationSec,
  placeName: places.name,
  uploaderName: user.name,
  sizeBytes: media.sizeBytes,
  originalName: media.originalName,
};

const selectCards = () =>
  db
    .select(cardColumns)
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .leftJoin(places, sql`${places.id} = ${placeOfMedia}`)
    .leftJoin(user, eq(media.uploaderId, user.id));

type CardRow = Awaited<ReturnType<typeof selectCards>>[number];

const toCard = (row: CardRow): MediaCard => ({
  ...row,
  type: row.type === "video" ? "video" : "photo",
  width: row.width ?? 4,
  height: row.height ?? 3,
  takenAt: row.takenAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

const sortDate = sql`coalesce(${media.takenAt}, ${media.createdAt})`;

/** Not deleted, ready or still processing, and not inside someone else's sealed time capsule. */
export const visibleMedia = (viewerId: string) =>
  and(
    isNull(media.deletedAt),
    isNull(albums.deletedAt),
    inArray(media.status, ["ready", "processing"]),
    or(isNull(albums.unlockAt), lte(albums.unlockAt, sql`now()`), eq(albums.createdById, viewerId)),
  );

/* ───────────── Albums ───────────── */

export type AlbumOverview = {
  id: string;
  title: string;
  note: string | null;
  category: string;
  startDate: string | null;
  endDate: string | null;
  unlockAt: string | null;
  locked: boolean;
  itemCount: number;
  covers: { id: string; thumbhash: string | null }[];
  createdByName: string | null;
};

export async function getAlbumsOverview(viewerId: string, options: { category?: string; capsulesOnly?: boolean } = {}) {
  const rows = await db
    .select({
      album: albums,
      createdByName: user.name,
      itemCount: sql<number>`(select count(*)::int from media m where m.album_id = ${albums.id} and m.deleted_at is null and m.status in ('ready', 'processing'))`,
    })
    .from(albums)
    .leftJoin(user, eq(albums.createdById, user.id))
    .where(
      and(
        isNull(albums.deletedAt),
        options.category && options.category !== "all" ? eq(albums.category, options.category) : undefined,
        options.capsulesOnly ? isNotNull(albums.unlockAt) : undefined,
      ),
    )
    .orderBy(
      options.capsulesOnly ? asc(albums.unlockAt) : desc(sql`coalesce(${albums.startDate}, ${albums.createdAt}::date)`),
    );

  const ids = rows.map((r) => r.album.id);
  const piles = new Map<string, { id: string; thumbhash: string | null }[]>();
  if (ids.length) {
    const result = await db.execute<{ album_id: string; id: string; thumbhash: string | null }>(sql`
      select album_id, id, thumbhash from (
        select m.album_id, m.id, m.thumbhash,
          row_number() over (partition by m.album_id order by (m.id = a.cover_media_id) desc, m.taken_at asc nulls last, m.created_at asc) as rn
        from media m join albums a on a.id = m.album_id
        where m.deleted_at is null and m.status = 'ready' and m.album_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      ) ranked where rn <= 3`);
    for (const row of result.rows) {
      const list = piles.get(row.album_id) ?? [];
      list.push({ id: row.id, thumbhash: row.thumbhash });
      piles.set(row.album_id, list);
    }
  }

  return rows.map(({ album, itemCount, createdByName }): AlbumOverview => {
    const locked = isAlbumLocked(album, viewerId);
    return {
      id: album.id,
      title: album.title,
      note: album.note,
      category: album.category,
      startDate: album.startDate,
      endDate: album.endDate,
      unlockAt: album.unlockAt?.toISOString() ?? null,
      locked,
      itemCount,
      covers: locked ? [] : (piles.get(album.id) ?? []),
      createdByName,
    };
  });
}

export async function getAlbum(albumId: string) {
  const [row] = await db
    .select({ album: albums, createdByName: user.name, placeName: places.name })
    .from(albums)
    .leftJoin(user, eq(albums.createdById, user.id))
    .leftJoin(places, eq(albums.placeId, places.id))
    .where(eq(albums.id, albumId))
    .limit(1);
  return row ?? null;
}

export async function getAlbumMedia(albumId: string) {
  const rows = await selectCards()
    .where(and(eq(media.albumId, albumId), isNull(media.deletedAt), inArray(media.status, ["ready", "processing"])))
    .orderBy(asc(sortDate));
  return rows.map(toCard);
}

export async function listAlbumsForMove() {
  return db
    .select({ id: albums.id, title: albums.title })
    .from(albums)
    .where(isNull(albums.deletedAt))
    .orderBy(asc(albums.title));
}

/* ───────────── Timeline, places, favorites, search ───────────── */

export async function getTimeline(viewerId: string, limit: number) {
  const rows = await selectCards().where(visibleMedia(viewerId)).orderBy(desc(sortDate)).limit(limit);
  return rows.map(toCard);
}

export type PlaceOverview = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  count: number;
  albumCount: number;
  coverId: string;
  /** Unix seconds of the earliest photo there: when the family first went. */
  firstAt: number;
};

export async function getPlacesOverview(viewerId: string): Promise<PlaceOverview[]> {
  return db
    .select({
      id: places.id,
      name: places.name,
      city: places.city,
      country: places.country,
      lat: places.lat,
      lng: places.lng,
      count: sql<number>`count(${media.id})::int`,
      albumCount: sql<number>`count(distinct ${media.albumId})::int`,
      coverId: sql<string>`(array_agg(${media.id} order by ${media.takenAt} desc nulls last))[1]`,
      firstAt: sql<number>`extract(epoch from min(${sortDate}))::float8`.mapWith(Number),
    })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .innerJoin(places, sql`${places.id} = ${placeOfMedia}`)
    .where(visibleMedia(viewerId))
    .groupBy(places.id)
    .orderBy(desc(sql`count(${media.id})`));
}

export type MapPoint = { id: string; placeId: string; lat: number; lng: number };

/** Every visible photo and video with a location: at its own GPS point, or at the centre of its place. */
export async function getMapPoints(viewerId: string): Promise<MapPoint[]> {
  return db
    .select({
      id: media.id,
      placeId: places.id,
      lat: sql<number>`coalesce(${media.lat}, ${places.lat})`,
      lng: sql<number>`coalesce(${media.lng}, ${places.lng})`,
    })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .innerJoin(places, sql`${places.id} = ${placeOfMedia}`)
    .where(and(visibleMedia(viewerId), eq(media.status, "ready")))
    .orderBy(desc(sortDate))
    .limit(5000);
}

export async function getPlaceMedia(viewerId: string, placeId: string) {
  const rows = await selectCards()
    .where(and(visibleMedia(viewerId), sql`${placeOfMedia} = ${placeId}`))
    .orderBy(desc(sortDate))
    .limit(300);
  return rows.map(toCard);
}

export async function getFavorites(viewerId: string) {
  const rows = await selectCards()
    .innerJoin(favorites, and(eq(favorites.mediaId, media.id), eq(favorites.userId, viewerId)))
    .where(visibleMedia(viewerId))
    .orderBy(desc(favorites.createdAt));
  return rows.map(toCard);
}

export async function searchMemories(viewerId: string, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const foundAlbums = await db
    .select({ id: albums.id })
    .from(albums)
    .where(
      and(
        isNull(albums.deletedAt),
        or(ilike(albums.title, pattern), ilike(albums.note, pattern), ilike(albums.description, pattern)),
      ),
    )
    .limit(24);
  const overview = foundAlbums.length
    ? (await getAlbumsOverview(viewerId)).filter((a) => foundAlbums.some((f) => f.id === a.id))
    : [];

  const rows = await selectCards()
    .where(
      and(
        visibleMedia(viewerId),
        or(
          ilike(media.caption, pattern),
          sql`${media.aiCaption}->>'en' ilike ${pattern}`,
          sql`${media.aiCaption}->>'id' ilike ${pattern}`,
          sql`${media.aiTags}::text ilike ${pattern}`,
          ilike(places.name, pattern),
          ilike(places.city, pattern),
          ilike(places.district, pattern),
          ilike(places.village, pattern),
          ilike(places.hamlet, pattern),
          ilike(places.region, pattern),
          ilike(albums.title, pattern),
          ilike(media.originalName, pattern),
        ),
      ),
    )
    .orderBy(desc(sortDate))
    .limit(200);
  return { albums: overview, media: rows.map(toCard) };
}

/* ───────────── Home ───────────── */

export type MemoryLevel = "day" | "thisMonth" | "lastMonth" | "thisYear";

/**
 * Memories for Home: photos taken on this date in earlier years. When there are none, photos from this month, then last
 * month (both from any year), then this year.
 */
export async function getMemories(viewerId: string, timeZone: string): Promise<{ level: MemoryLevel; items: MediaCard[] }> {
  const taken = sql`(${media.takenAt} at time zone ${timeZone})`;
  const today = sql`(now() at time zone ${timeZone})`;
  const levels: [MemoryLevel, SQL][] = [
    ["day", sql`to_char(${taken}, 'MM-DD') = to_char(${today}, 'MM-DD') and extract(year from ${taken}) < extract(year from ${today})`],
    ["thisMonth", sql`extract(month from ${taken}) = extract(month from ${today})`],
    ["lastMonth", sql`extract(month from ${taken}) = extract(month from ${today} - interval '1 month')`],
    ["thisYear", sql`extract(year from ${taken}) = extract(year from ${today})`],
  ];
  for (const [level, condition] of levels) {
    const rows = await selectCards()
      .where(and(visibleMedia(viewerId), eq(media.status, "ready"), lte(media.takenAt, sql`now()`), condition))
      .orderBy(desc(media.takenAt), asc(media.createdAt))
      .limit(80);
    if (rows.length) return { level, items: rows.map(toCard) };
  }
  return { level: "day", items: [] };
}

export async function getRecentMedia(viewerId: string, limit = 12) {
  const rows = await selectCards()
    .where(and(visibleMedia(viewerId), eq(media.status, "ready")))
    .orderBy(desc(media.createdAt))
    .limit(limit);
  return rows.map(toCard);
}

export type UpcomingItem =
  | { kind: "milestone"; id: string; title: string; milestoneKind: string; date: string; originalDate: string; repeatsYearly: boolean; days: number }
  | { kind: "capsule"; id: string; title: string; date: string; days: number };

export async function getUpcoming(windowDays = 60): Promise<UpcomingItem[]> {
  const now = new Date();
  const items: UpcomingItem[] = [];
  for (const m of await db.select().from(milestones)) {
    const next = nextOccurrence(m.date, m.repeatsYearly, now);
    if (!next) continue;
    const days = Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
    if (days <= windowDays) {
      items.push({ kind: "milestone", id: m.id, title: m.title, milestoneKind: m.kind, date: next.toISOString(), originalDate: m.date, repeatsYearly: m.repeatsYearly, days });
    }
  }
  const capsules = await db
    .select({ id: albums.id, title: albums.title, unlockAt: albums.unlockAt })
    .from(albums)
    .where(and(isNull(albums.deletedAt), gt(albums.unlockAt, now), lte(albums.unlockAt, new Date(now.getTime() + 180 * 86_400_000))));
  for (const c of capsules) {
    items.push({ kind: "capsule", id: c.id, title: c.title, date: c.unlockAt!.toISOString(), days: Math.ceil((c.unlockAt!.getTime() - now.getTime()) / 86_400_000) });
  }
  return items.sort((a, b) => a.days - b.days);
}

export async function getMilestones() {
  return db.select().from(milestones).orderBy(asc(milestones.date));
}

/* ───────────── Family ───────────── */

export async function getPendingUsers() {
  return db
    .select({ id: user.id, name: user.name, username: user.username, email: user.email, relationNote: user.relationNote, createdAt: user.createdAt })
    .from(user)
    .where(and(eq(user.status, "pending"), eq(user.emailVerified, true)))
    .orderBy(asc(user.createdAt));
}

export async function getMembers() {
  const members = await db
    .select({ id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, image: user.image })
    .from(user)
    .where(eq(user.status, "active"))
    .orderBy(asc(user.createdAt));
  const grants = await db
    .select({ userId: editGrants.userId, albumId: editGrants.albumId, expiresAt: editGrants.expiresAt, albumTitle: albums.title })
    .from(editGrants)
    .leftJoin(albums, eq(editGrants.albumId, albums.id))
    .where(and(isNull(editGrants.revokedAt), or(isNull(editGrants.expiresAt), gt(editGrants.expiresAt, new Date()))));
  return members.map((m) => {
    const grant = grants.find((g) => g.userId === m.id);
    return {
      ...m,
      grant: grant ? { albumId: grant.albumId, albumTitle: grant.albumTitle, expiresAt: grant.expiresAt?.toISOString() ?? null } : null,
    };
  });
}

/** Invite links that still work, plus the ones used in the last 30 days. */
export async function getInvites() {
  const joined = alias(user, "joined_user");
  const now = new Date();
  const rows = await db
    .select({
      id: invites.id,
      token: invites.token,
      note: invites.note,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedByName: joined.name,
      usedByStatus: joined.status,
      createdByName: user.name,
    })
    .from(invites)
    .leftJoin(user, eq(invites.createdById, user.id))
    .leftJoin(joined, eq(invites.usedById, joined.id))
    .where(
      and(
        isNull(invites.revokedAt),
        or(and(isNull(invites.usedAt), gt(invites.expiresAt, now)), gte(invites.usedAt, new Date(now.getTime() - 30 * 86_400_000))),
      ),
    )
    .orderBy(desc(invites.createdAt))
    .limit(50);
  return rows.map((row) => ({ ...row, expiresAt: row.expiresAt.toISOString(), usedAt: row.usedAt?.toISOString() ?? null }));
}

/** Ready photos and videos outside the trash, per storage ("primary" or "cloudinary:<cloud name>"). */
export async function getMediaCountsBySource() {
  const rows = await db
    .select({ source: media.source, count: sql<number>`count(*)::int` })
    .from(media)
    .where(and(eq(media.status, "ready"), isNull(media.deletedAt)))
    .groupBy(media.source);
  return new Map(rows.map((row) => [row.source, Number(row.count)]));
}

/* ───────────── Trash ───────────── */

export async function getTrash() {
  const trashedAlbums = await db
    .select({
      id: albums.id,
      title: albums.title,
      deletedAt: albums.deletedAt,
      itemCount: sql<number>`(select count(*)::int from media m where m.album_id = ${albums.id})`,
    })
    .from(albums)
    .where(isNotNull(albums.deletedAt))
    .orderBy(desc(albums.deletedAt));
  const trashedMedia = await db
    .select({ id: media.id, type: media.type, thumbhash: media.thumbhash, width: media.width, height: media.height, deletedAt: media.deletedAt, albumTitle: albums.title })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .where(isNotNull(media.deletedAt))
    .orderBy(desc(media.deletedAt))
    .limit(500);
  return {
    albums: trashedAlbums.map((a) => ({ ...a, deletedAt: a.deletedAt!.toISOString() })),
    media: trashedMedia.map((m) => ({ ...m, deletedAt: m.deletedAt!.toISOString() })),
  };
}

/* ───────────── Days worth remembering ───────────── */

export type AlbumAnniversary = { id: string; title: string; note: string | null; startDate: string; coverId: string; itemCount: number };

/** Albums that started on this date in an earlier year and have a photo to show. */
export async function getAlbumAnniversaries(viewerId: string, timeZone: string): Promise<AlbumAnniversary[]> {
  const today = sql`(now() at time zone ${timeZone})`;
  const rows = await db
    .select({
      id: albums.id,
      title: albums.title,
      note: albums.note,
      startDate: albums.startDate,
      coverId: sql<string | null>`(select m.id from media m where m.album_id = ${albums.id} and m.deleted_at is null and m.status = 'ready' order by (m.id = ${albums.coverMediaId}) desc nulls last, m.taken_at asc nulls last limit 1)`,
      itemCount: sql<number>`(select count(*)::int from media m where m.album_id = ${albums.id} and m.deleted_at is null and m.status = 'ready')`,
    })
    .from(albums)
    .where(
      and(
        isNull(albums.deletedAt),
        or(isNull(albums.unlockAt), lte(albums.unlockAt, sql`now()`), eq(albums.createdById, viewerId)),
        sql`to_char(${albums.startDate}, 'MM-DD') = to_char(${today}, 'MM-DD')`,
        sql`extract(year from ${albums.startDate}) < extract(year from ${today})`,
      ),
    )
    .orderBy(desc(albums.startDate))
    .limit(4);
  return rows.flatMap((row) => (row.startDate && row.coverId ? [{ ...row, startDate: row.startDate, coverId: row.coverId }] : []));
}

/** Photos taken on a month and day ("08-17") in earlier years, oldest first: a yearly milestone's look back. */
export async function getDayMemories(viewerId: string, monthDay: string, timeZone: string) {
  const taken = sql`(${media.takenAt} at time zone ${timeZone})`;
  const rows = await selectCards()
    .where(
      and(
        visibleMedia(viewerId),
        eq(media.status, "ready"),
        sql`to_char(${taken}, 'MM-DD') = ${monthDay}`,
        sql`extract(year from ${taken}) < extract(year from (now() at time zone ${timeZone}))`,
      ),
    )
    .orderBy(asc(media.takenAt))
    .limit(60);
  return rows.map(toCard);
}

/* ───────────── Year recap ───────────── */

export async function getRecapYears(viewerId: string, timeZone: string) {
  const yearExpr = sql<number>`extract(year from ${sortDate} at time zone ${timeZone})::int`;
  // Group/order by ordinal: repeating yearExpr binds the time zone as new params ($1 vs $6),
  // which Postgres treats as a different expression → "must appear in the GROUP BY clause".
  return db
    .select({
      year: yearExpr,
      count: sql<number>`count(*)::int`,
      places: sql<number>`count(distinct ${placeOfMedia})::int`,
      coverId: sql<string>`(array_agg(${media.id} order by random()))[1]`,
    })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .where(and(visibleMedia(viewerId), eq(media.status, "ready")))
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`);
}

export async function getRecap(viewerId: string, year: number, timeZone: string) {
  const inYear = sql`extract(year from ${sortDate} at time zone ${timeZone}) = ${year}`;
  const rows = await selectCards()
    .where(and(visibleMedia(viewerId), eq(media.status, "ready"), inYear))
    .orderBy(asc(sortDate));
  const cards = rows.map(toCard);
  if (cards.length === 0) return null;

  const loveRows = await db
    .select({ mediaId: media.id, score: sql<number>`(select count(*) from ${favorites} f where f.media_id = ${media.id}) + (select count(*) from ${reactions} r where r.media_id = ${media.id})` })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .where(and(visibleMedia(viewerId), eq(media.status, "ready"), inYear));
  const score = new Map(loveRows.map((r) => [r.mediaId, Number(r.score)]));

  const tally = <K,>(values: K[]) => {
    const map = new Map<K, number>();
    for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const monthOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone, month: "numeric" }).format(new Date(iso)));

  const photosOnly = cards.filter((c) => c.type === "photo");
  const loved = [...cards].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0)).filter((c) => (score.get(c.id) ?? 0) > 0);
  const step = Math.max(1, Math.floor(photosOnly.length / 24));
  const highlights = [...new Map([...loved, ...photosOnly.filter((_, i) => i % step === 0)].map((c) => [c.id, c])).values()].slice(0, 24);

  return {
    year,
    photos: photosOnly.length,
    videos: cards.length - photosOnly.length,
    albums: new Set(cards.map((c) => c.albumId)).size,
    places: new Set(cards.map((c) => c.placeName).filter(Boolean)).size,
    contributors: tally(cards.map((c) => c.uploaderName).filter((n): n is string => Boolean(n))).slice(0, 3),
    busiestMonth: tally(cards.map((c) => monthOf(c.takenAt ?? c.createdAt)))[0] ?? null,
    topPlace: tally(cards.map((c) => c.placeName).filter((n): n is string => Boolean(n)))[0] ?? null,
    loved: loved.slice(0, 6),
    highlights,
  };
}
