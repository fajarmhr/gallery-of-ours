import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { emails, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const localeOf = (user: object) => ("locale" in user && user.locale === "id" ? "id" : "en");

export const auth = betterAuth({
  appName: "Gallery of Ours",
  baseURL: env.appUrl,
  trustedOrigins: env.trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, emails.reset(localeOf(user), user.name, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(user.email, emails.verify(localeOf(user), user.name, url));
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "member", input: false },
      status: { type: "string", defaultValue: "pending", input: false },
      locale: { type: "string", defaultValue: "en", required: false },
      relationNote: { type: "string", required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (env.superadminEmail && user.email.toLowerCase() === env.superadminEmail) {
            return { data: { ...user, role: "superadmin", status: "active" } };
          }
          return { data: user };
        },
      },
    },
  },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
