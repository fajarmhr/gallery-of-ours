import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { editGrants } from "@/db/schema";

export type Role = "superadmin" | "admin" | "member";
export type Status = "pending" | "active" | "rejected";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayUsername: string | null;
  image: string | null;
  role: Role;
  status: Status;
  locale: "en" | "id";
  emailVerified: boolean;
}

export class PermissionError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "PermissionError";
  }
}

export const asRole = (value: string): Role =>
  value === "superadmin" || value === "admin" ? value : "member";
export const asStatus = (value: string): Status =>
  value === "active" || value === "rejected" ? value : "pending";

export const isAdmin = (user: Pick<AppUser, "role">) => user.role === "admin" || user.role === "superadmin";
export const isSuperadmin = (user: Pick<AppUser, "role">) => user.role === "superadmin";

export function assertAdmin(user: AppUser) {
  if (!isAdmin(user)) throw new PermissionError();
}

export function assertSuperadmin(user: AppUser) {
  if (!isSuperadmin(user)) throw new PermissionError();
}

export async function activeGrants(userId: string) {
  return db
    .select()
    .from(editGrants)
    .where(
      and(
        eq(editGrants.userId, userId),
        isNull(editGrants.revokedAt),
        or(isNull(editGrants.expiresAt), gt(editGrants.expiresAt, new Date())),
      ),
    );
}

/** Albums a member may edit: "all" or a list of album ids. Admins always get "all". */
export async function editableScope(user: AppUser): Promise<"all" | string[]> {
  if (isAdmin(user)) return "all";
  const grants = await activeGrants(user.id);
  if (grants.some((g) => g.albumId === null)) return "all";
  return grants.map((g) => g.albumId!).filter(Boolean);
}

export async function canEditAlbum(user: AppUser, albumId: string) {
  const scope = await editableScope(user);
  return scope === "all" || scope.includes(albumId);
}

export async function canCreateAlbum(user: AppUser) {
  return (await editableScope(user)) === "all";
}

export async function assertCanEditAlbum(user: AppUser, albumId: string) {
  if (!(await canEditAlbum(user, albumId))) throw new PermissionError();
}

/** A time capsule stays closed for everyone except the person who made it. */
export function isAlbumLocked(album: { unlockAt: Date | null; createdById: string | null }, viewerId: string | null) {
  return Boolean(album.unlockAt && album.unlockAt.getTime() > Date.now() && album.createdById !== viewerId);
}
