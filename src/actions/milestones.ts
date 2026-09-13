"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { run, UserError } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { assertAdmin } from "@/lib/permissions";
import { actionUser } from "@/lib/session";

const MilestoneInput = z.object({
  title: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["birthday", "anniversary", "other"]),
  repeatsYearly: z.boolean(),
});

export type MilestoneInputValues = z.input<typeof MilestoneInput>;

function parse(input: MilestoneInputValues) {
  const parsed = MilestoneInput.safeParse(input);
  if (!parsed.success) throw new UserError("invalid_input");
  return parsed.data;
}

const refresh = () => {
  revalidatePath("/milestones");
  revalidatePath("/home");
};

export async function createMilestone(input: MilestoneInputValues) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    const [created] = await db.insert(milestones).values({ ...parse(input), createdById: current.id }).returning({ id: milestones.id });
    await logActivity(current.id, "milestone.create", "milestone", created!.id);
    refresh();
    return { id: created!.id };
  });
}

export async function updateMilestone(id: string, input: MilestoneInputValues) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db.update(milestones).set(parse(input)).where(eq(milestones.id, id));
    refresh();
    return null;
  });
}

export async function deleteMilestone(id: string) {
  return run(async () => {
    const current = await actionUser();
    assertAdmin(current);
    await db.delete(milestones).where(eq(milestones.id, id));
    await logActivity(current.id, "milestone.delete", "milestone", id);
    refresh();
    return null;
  });
}
