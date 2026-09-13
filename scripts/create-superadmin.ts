import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * Creates (or promotes) the first superadmin without needing email delivery.
 *   pnpm create-superadmin --name "Your Name" --username you --email you@example.com --password "a long password"
 */
async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      username: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
    },
  });
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("--email is required");

  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing) {
    await db.update(user).set({ role: "superadmin", status: "active", emailVerified: true }).where(eq(user.id, existing.id));
    console.log(`Promoted ${existing.name} (${email}) to superadmin.`);
    return;
  }

  if (!values.name || !values.username || !values.password) throw new Error("--name, --username and --password are required for a new account");
  if (values.password.length < 8) throw new Error("Password must be at least 8 characters");

  const context = await auth.$context;
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: values.name,
    email,
    emailVerified: true,
    username: values.username.toLowerCase(),
    displayUsername: values.username,
    role: "superadmin",
    status: "active",
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await context.password.hash(values.password),
  });
  console.log(`Created superadmin ${values.name} (@${values.username.toLowerCase()}).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
