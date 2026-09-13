const read = (name: string) => {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
};

export const env = {
  appUrl: read("NEXT_PUBLIC_APP_URL") ?? read("BETTER_AUTH_URL") ?? "http://localhost:3000",
  timeZone: read("APP_TIMEZONE") ?? "Asia/Jakarta",
  superadminEmail: read("SUPERADMIN_EMAIL")?.toLowerCase(),
  trustedOrigins: (read("TRUSTED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean),

  r2: {
    accountId: read("R2_ACCOUNT_ID"),
    accessKeyId: read("R2_ACCESS_KEY_ID"),
    secretAccessKey: read("R2_SECRET_ACCESS_KEY"),
    bucket: read("R2_BUCKET"),
  },
  localStorageDir: read("LOCAL_STORAGE_DIR") ?? ".data/uploads",

  resendApiKey: read("RESEND_API_KEY"),
  emailFrom: read("EMAIL_FROM") ?? "Gallery of Ours <onboarding@resend.dev>",

  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  aiDailyCaptionLimit: Number(read("AI_DAILY_CAPTION_LIMIT") ?? "300"),

  signingSecret: read("BETTER_AUTH_SECRET") ?? "dev-only-insecure-secret",
};

export const hasR2 = () =>
  Boolean(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.bucket);
export const hasResend = () => Boolean(env.resendApiKey);
export const hasAI = () => Boolean(env.anthropicApiKey);
