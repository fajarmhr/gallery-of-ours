import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { emails, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { approveInvitedAccount, INVITE_CODE_MINUTES, inviteSignup, isInvitedAccount, sendCodeEmail } from "@/lib/invites";

const localeOf = (user: object) => ("locale" in user && user.locale === "id" ? "id" : "en");

export const auth = betterAuth({
  appName: "Gallery of Ours",
  baseURL: env.appUrl,
  trustedOrigins: (request) => {
    const origins = [...env.trustedOrigins];
    // `pnpm dev` is also opened from other devices (a phone over Tailscale or the LAN): trust the address that served the page.
    const host = request?.headers.get("host");
    if (process.env.NODE_ENV === "development" && host) origins.push(`http://${host}`, `https://${host}`);
    return origins;
  },
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
      // Invite sign-ups get a code instead (actions/invites.ts), sent once the account is tied to the link.
      if (user.emailVerified || inviteSignup.getStore()) return;
      const invited = await isInvitedAccount(user.id);
      await sendEmail(user.email, emails.verify(localeOf(user), user.name, url, invited));
    },
    // An invite link stands in for an admin's approval, so confirming the email (code or link) is the last step.
    afterEmailVerification: async (user) => {
      await approveInvitedAccount(user.id);
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
  // The email code plugin is only used from server actions (invite sign-ups), so its HTTP routes stay closed.
  disabledPaths: [
    "/email-otp/send-verification-otp",
    "/email-otp/check-verification-otp",
    "/email-otp/verify-email",
    "/sign-in/email-otp",
    "/email-otp/request-password-reset",
    "/email-otp/reset-password",
    "/forget-password/email-otp",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ],
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    emailOTP({
      otpLength: 6,
      expiresIn: INVITE_CODE_MINUTES * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === "email-verification") await sendCodeEmail(email, otp);
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
