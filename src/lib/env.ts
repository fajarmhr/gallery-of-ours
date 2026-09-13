const read = (name: string) => {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
};

export type CloudinaryAccount = { cloudName: string; apiKey: string; apiSecret: string };

/** CLOUDINARY_URL_1, CLOUDINARY_URL_2, … as `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. The first entry per cloud wins. */
const readCloudinaryAccounts = () => {
  const accounts = new Map<string, CloudinaryAccount>();
  const names = Object.keys(process.env)
    .filter((name) => /^CLOUDINARY_URL_\d+$/.test(name))
    .sort((a, b) => Number(a.slice(15)) - Number(b.slice(15)));
  for (const name of names) {
    try {
      const url = new URL(read(name) ?? "");
      const account = { cloudName: url.hostname, apiKey: decodeURIComponent(url.username), apiSecret: decodeURIComponent(url.password) };
      if (url.protocol === "cloudinary:" && account.cloudName && account.apiKey && account.apiSecret && !accounts.has(account.cloudName)) {
        accounts.set(account.cloudName, account);
      }
    } catch {
      console.warn(`${name} is not a valid cloudinary:// URL, skipping it.`);
    }
  }
  return [...accounts.values()];
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

  cloudinary: readCloudinaryAccounts(),

  signingSecret: read("BETTER_AUTH_SECRET") ?? "dev-only-insecure-secret",
};

export const hasR2 = () =>
  Boolean(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.bucket);
export const hasResend = () => Boolean(env.resendApiKey);
export const hasAI = () => Boolean(env.anthropicApiKey);
