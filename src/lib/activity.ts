import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { activity } from "@/db/schema";

export async function logActivity(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await db.insert(activity).values({ actorId, action, entityType, entityId: entityId ?? null, meta: meta ?? null });
  } catch (error) {
    console.warn("Could not write activity log", error);
  }
}

export async function countActivitySince(action: string, since: Date) {
  const [row] = await db
    .select({ value: count() })
    .from(activity)
    .where(and(eq(activity.action, action), gte(activity.createdAt, since)));
  return row?.value ?? 0;
}
