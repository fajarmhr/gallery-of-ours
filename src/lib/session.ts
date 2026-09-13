import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { asRole, asStatus, isAdmin, PermissionError, type AppUser } from "@/lib/permissions";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Reads role and status fresh from the database so approvals and role changes apply immediately. */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const [row] = await db.select().from(userTable).where(eq(userTable.id, session.user.id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username,
    displayUsername: row.displayUsername,
    image: row.image,
    role: asRole(row.role),
    status: asStatus(row.status),
    locale: row.locale === "id" ? "id" : "en",
    emailVerified: row.emailVerified,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireActiveUser() {
  const user = await requireUser();
  if (user.status !== "active") redirect("/pending");
  return user;
}

export async function requireAdminPage() {
  const user = await requireActiveUser();
  if (!isAdmin(user)) redirect("/home");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function actionUser() {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") throw new PermissionError("unauthorized");
  return user;
}
