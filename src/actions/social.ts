"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { albums, comments, favorites, media, REACTION_KINDS, reactions, user, type ReactionKind } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { canEditAlbum, isAdmin, isAlbumLocked, PermissionError } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

async function visibleMedia(mediaId: string, viewerId: string) {
  const [row] = await db
    .select({ id: media.id, albumId: media.albumId, unlockAt: albums.unlockAt, createdById: albums.createdById })
    .from(media)
    .innerJoin(albums, eq(media.albumId, albums.id))
    .where(and(eq(media.id, mediaId), isNull(media.deletedAt), isNull(albums.deletedAt)))
    .limit(1);
  if (!row) throw new UserError("not_found");
  if (isAlbumLocked(row, viewerId)) throw new PermissionError();
  return row;
}

export type MediaSocial = {
  favorited: boolean;
  canEdit: boolean;
  reactions: { kind: ReactionKind; count: number; mine: boolean; names: string[] }[];
  /** Everyone else who reacted, each name once. */
  reactedBy: string[];
  comments: { id: string; body: string; createdAt: string; userId: string; name: string; image: string | null; canDelete: boolean }[];
  /** Server time when this was fetched — the reference for comment relative times (fetched client-side, after page load). */
  now: string;
};

export async function getMediaSocial(mediaId: string) {
  return run<MediaSocial>(async () => {
    const current = await actionUser();
    const item = await visibleMedia(mediaId, current.id);
    const [favorite] = await db
      .select({ mediaId: favorites.mediaId })
      .from(favorites)
      .where(and(eq(favorites.userId, current.id), eq(favorites.mediaId, mediaId)))
      .limit(1);
    const reactionRows = await db
      .select({ kind: reactions.kind, userId: reactions.userId, name: user.name })
      .from(reactions)
      .innerJoin(user, eq(reactions.userId, user.id))
      .where(eq(reactions.mediaId, mediaId));
    const commentRows = await db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, userId: comments.userId, name: user.name, image: user.image })
      .from(comments)
      .innerJoin(user, eq(comments.userId, user.id))
      .where(and(eq(comments.mediaId, mediaId), isNull(comments.deletedAt)))
      .orderBy(asc(comments.createdAt));

    return {
      now: new Date().toISOString(),
      favorited: Boolean(favorite),
      canEdit: await canEditAlbum(current, item.albumId),
      reactions: REACTION_KINDS.map((kind) => {
        const list = reactionRows.filter((r) => r.kind === kind);
        return { kind, count: list.length, mine: list.some((r) => r.userId === current.id), names: list.map((r) => r.name) };
      }),
      reactedBy: [...new Set(reactionRows.filter((r) => r.userId !== current.id).map((r) => r.name))],
      comments: commentRows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        canDelete: c.userId === current.id || isAdmin(current),
      })),
    };
  });
}

export async function toggleFavorite(mediaId: string) {
  return run(async () => {
    const current = await actionUser();
    await visibleMedia(mediaId, current.id);
    const removed = await db
      .delete(favorites)
      .where(and(eq(favorites.userId, current.id), eq(favorites.mediaId, mediaId)))
      .returning({ mediaId: favorites.mediaId });
    if (removed.length) return { favorited: false };
    await db.insert(favorites).values({ userId: current.id, mediaId }).onConflictDoNothing();
    return { favorited: true };
  });
}

export async function toggleReaction(mediaId: string, kind: string) {
  return run(async () => {
    const current = await actionUser();
    if (!REACTION_KINDS.includes(kind as ReactionKind)) throw new UserError("invalid_input");
    await visibleMedia(mediaId, current.id);
    const removed = await db
      .delete(reactions)
      .where(and(eq(reactions.mediaId, mediaId), eq(reactions.userId, current.id), eq(reactions.kind, kind)))
      .returning({ kind: reactions.kind });
    if (!removed.length) await db.insert(reactions).values({ mediaId, userId: current.id, kind }).onConflictDoNothing();
    return null;
  });
}

export async function addComment(mediaId: string, body: string) {
  return run(async () => {
    const current = await actionUser();
    const text = body.trim();
    if (text.length < 1 || text.length > 1000) throw new UserError("invalid_input");
    await visibleMedia(mediaId, current.id);
    const [created] = await db.insert(comments).values({ mediaId, userId: current.id, body: text }).returning({ id: comments.id });
    await logActivity(current.id, "comment.add", "media", mediaId);
    return { id: created!.id };
  });
}

export async function deleteComment(commentId: string) {
  return run(async () => {
    const current = await actionUser();
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment) return null;
    if (comment.userId !== current.id && !isAdmin(current)) throw new PermissionError();
    await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
    return null;
  });
}
