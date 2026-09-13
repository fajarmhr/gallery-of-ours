import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

/* ───────────── Better Auth core tables (+ username plugin + our fields) ───────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: text("role").default("member").notNull(),
  status: text("status").default("pending").notNull(),
  locale: text("locale").default("en").notNull(),
  relationNote: text("relation_note"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ───────────── Gallery tables ───────────── */

export type MediaVariant = { key: string; width: number; height: number };
export type MediaVariants = Partial<Record<"thumb" | "medium" | "large", MediaVariant>>;
export type BilingualText = { en: string; id: string };

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const albums = pgTable(
  "albums",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    note: text("note"),
    category: text("category").default("everyday").notNull(),
    coverMediaId: uuid("cover_media_id"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    unlockAt: timestamp("unlock_at", { withTimezone: true }),
    musicKey: text("music_key"),
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("albums_deleted_idx").on(t.deletedAt)],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    status: text("status").default("uploading").notNull(),
    originalKey: text("original_key").notNull(),
    originalName: text("original_name"),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    displayKey: text("display_key"),
    posterKey: text("poster_key"),
    variants: jsonb("variants").$type<MediaVariants>().default({}).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSec: doublePrecision("duration_sec"),
    thumbhash: text("thumbhash"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    caption: text("caption"),
    aiCaption: jsonb("ai_caption").$type<BilingualText>(),
    aiTags: jsonb("ai_tags").$type<string[]>(),
    isDemo: boolean("is_demo").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("media_album_idx").on(t.albumId),
    index("media_taken_idx").on(t.takenAt),
    index("media_place_idx").on(t.placeId),
    index("media_deleted_idx").on(t.deletedAt),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mediaId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("comments_media_idx").on(t.mediaId)],
);

export const REACTION_KINDS = ["heart", "laugh", "wow", "touched", "clap"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const reactions = pgTable(
  "reactions",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.userId, t.kind] })],
);

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  albumId: uuid("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  viewCount: integer("view_count").default(0).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const editGrants = pgTable(
  "edit_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    albumId: uuid("album_id").references(() => albums.id, { onDelete: "cascade" }),
    grantedById: text("granted_by_id").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("edit_grants_user_idx").on(t.userId)],
);

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  kind: text("kind").default("other").notNull(),
  repeatsYearly: boolean("repeats_yearly").default(true).notNull(),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt)],
);

/* ───────────── Relations ───────────── */

export const albumsRelations = relations(albums, ({ many, one }) => ({
  media: many(media),
  createdBy: one(user, { fields: [albums.createdById], references: [user.id] }),
  shareLinks: many(shareLinks),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
  album: one(albums, { fields: [media.albumId], references: [albums.id] }),
  uploader: one(user, { fields: [media.uploaderId], references: [user.id] }),
  place: one(places, { fields: [media.placeId], references: [places.id] }),
  comments: many(comments),
  reactions: many(reactions),
  favorites: many(favorites),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  media: one(media, { fields: [comments.mediaId], references: [media.id] }),
  user: one(user, { fields: [comments.userId], references: [user.id] }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  media: one(media, { fields: [reactions.mediaId], references: [media.id] }),
  user: one(user, { fields: [reactions.userId], references: [user.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  media: one(media, { fields: [favorites.mediaId], references: [media.id] }),
  user: one(user, { fields: [favorites.userId], references: [user.id] }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  album: one(albums, { fields: [shareLinks.albumId], references: [albums.id] }),
}));

export const editGrantsRelations = relations(editGrants, ({ one }) => ({
  user: one(user, { fields: [editGrants.userId], references: [user.id] }),
  album: one(albums, { fields: [editGrants.albumId], references: [albums.id] }),
}));

export const placesRelations = relations(places, ({ many }) => ({
  media: many(media),
}));
