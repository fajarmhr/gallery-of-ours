"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { isLocale, LOCALE_COOKIE } from "@/i18n/request";
import { run, UserError } from "@/lib/action";
import { actionUser, getCurrentUser } from "@/lib/session";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const current = await getCurrentUser();
  if (current) await db.update(user).set({ locale }).where(eq(user.id, current.id));
  revalidatePath("/", "layout");
}

export async function updateProfile(input: { name: string }) {
  return run(async () => {
    const current = await actionUser();
    const name = input.name.trim();
    if (name.length < 1 || name.length > 60) throw new UserError("invalid_input");
    await db.update(user).set({ name }).where(eq(user.id, current.id));
    revalidatePath("/", "layout");
    return null;
  });
}
