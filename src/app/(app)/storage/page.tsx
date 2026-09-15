import { Cloud, HardDrive, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/empty-state";
import { cloudinarySource, cloudinaryUsage } from "@/lib/cloudinary";
import { env, hasR2 } from "@/lib/env";
import { formatBytes } from "@/lib/format";
import { getMediaCountsBySource } from "@/lib/queries";
import { requireAdminPage } from "@/lib/session";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Storage" };

/** Stored data Cloudflare R2 includes for free each month. */
const R2_FREE_BYTES = 10 * 1024 ** 3;

type Settled<T> = { ok: true; value: T } | { ok: false };

/** One storage failing to answer shouldn't hide the others. */
async function settle<T>(work: () => Promise<T>, label: string): Promise<Settled<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    console.error(`Reading ${label} usage failed`, error);
    return { ok: false };
  }
}

const percentOf = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

export default async function StoragePage() {
  await requireAdminPage();
  const t = await getTranslations("storage");
  const format = await getFormatter();
  const onR2 = hasR2();

  const [counts, primary, clouds] = await Promise.all([
    getMediaCountsBySource(),
    settle(async () => (await storage()).usage(), onR2 ? "R2" : "local storage"),
    Promise.all(env.cloudinary.map((account) => settle(() => cloudinaryUsage(account.cloudName), `Cloudinary ${account.cloudName}`))),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-5">
        <section className="rounded-3xl border bg-card p-5">
          <CardHead
            icon={<HardDrive className="size-5" />}
            title={onR2 ? t("r2Title") : t("localTitle")}
            detail={onR2 ? (env.r2.bucket ?? "") : env.localStorageDir}
            size={primary.ok ? formatBytes(primary.value.bytes) : null}
            kept={t("kept", { count: counts.get("primary") ?? 0 })}
          />
          {primary.ok ? (
            <div className="mt-4 flex flex-col gap-2">
              {onR2 ? (
                <>
                  <Meter percent={percentOf(primary.value.bytes, R2_FREE_BYTES)} />
                  <p className="text-sm text-muted-foreground">
                    {primary.value.bytes > R2_FREE_BYTES ? t("r2Over") : t("r2Free", { percent: percentOf(primary.value.bytes, R2_FREE_BYTES) })}
                  </p>
                </>
              ) : null}
              <p className="text-xs text-muted-foreground">{t("files", { count: primary.value.objects })}</p>
            </div>
          ) : (
            <Unavailable text={t("unavailable")} />
          )}
        </section>

        {env.cloudinary.map((account, index) => {
          const result = clouds[index];
          const usage = result?.ok ? result.value : null;
          return (
            <section key={account.cloudName} className="rounded-3xl border bg-card p-5">
              <CardHead
                icon={<Cloud className="size-5" />}
                title={t("cloudinaryTitle", { number: index + 1 })}
                detail={[account.cloudName, usage?.plan ? t("plan", { plan: usage.plan }) : null].filter(Boolean).join(" · ")}
                size={usage ? formatBytes(usage.storageBytes) : null}
                kept={t("kept", { count: counts.get(cloudinarySource(account.cloudName)) ?? 0 })}
              />
              {usage ? (
                <div className="mt-4 flex flex-col gap-2">
                  {usage.creditsUsed !== null && usage.creditsLimit ? (
                    <>
                      <Meter percent={percentOf(usage.creditsUsed, usage.creditsLimit)} />
                      <p className="text-sm text-muted-foreground">
                        {t("credits", {
                          used: format.number(usage.creditsUsed, { maximumFractionDigits: 2 }),
                          limit: format.number(usage.creditsLimit),
                          percent: percentOf(usage.creditsUsed, usage.creditsLimit),
                        })}
                      </p>
                    </>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {[
                      t("assets", { count: usage.objects }),
                      t("bandwidth", { size: formatBytes(usage.bandwidthBytes) }),
                      usage.updatedAt ? t("counted", { date: format.dateTime(new Date(usage.updatedAt), { dateStyle: "medium" }) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : (
                <Unavailable text={t("unavailable")} />
              )}
            </section>
          );
        })}

        <p className="px-1 text-xs text-muted-foreground">{t("liveNote")}</p>
      </div>
    </div>
  );
}

function CardHead({ icon, title, detail, size, kept }: { icon: React.ReactNode; title: string; detail: string; size: string | null; kept: string }) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        {size ? <p className="shrink-0 font-display text-2xl font-bold tabular-nums">{size}</p> : null}
      </div>
      <p className="mt-2 font-hand text-xl leading-none text-note">{kept}</p>
    </>
  );
}

function Meter({ percent }: { percent: number }) {
  const width = Math.min(100, percent);
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", width >= 90 ? "bg-destructive" : width >= 70 ? "bg-accent-foreground" : "bg-olive")}
        style={{ width: `${Math.max(width, 2)}%` }}
      />
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
      <TriangleAlert className="size-4 shrink-0" />
      {text}
    </p>
  );
}
