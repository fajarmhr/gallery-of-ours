import { PermissionError } from "@/lib/permissions";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** An expected problem the person can fix. `code` maps to a translated message under `errors`. */
export class UserError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "UserError";
  }
}

export async function run<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof PermissionError) return { ok: false, error: error.message };
    if (error instanceof UserError) return { ok: false, error: error.code };
    console.error(error);
    return { ok: false, error: "unknown" };
  }
}
