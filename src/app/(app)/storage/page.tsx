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
    <div className="max-w-4xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-6">
        <section className="paper-panel">
          <CardHead
            icon={<HardDrive className="size-5" />}
            title={onR2 ? t("r2Title") : t("localTitle")}
            detail={onR2 ? (env.r2.bucket ?? "") : env.localStorageDir}
            size={primary.ok ? formatBytes(primary.value.bytes) : null}
            kept={t("kept", { count: counts.get("primary") ?? 0 })}
          />
          {primary.ok ? (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4">
              {onR2 ? (
                <>
                  <Meter percent={percentOf(primary.value.bytes, R2_FREE_BYTES)} label={t("r2Title")} />
                  <p className="text-sm leading-relaxed text-muted-foreground">
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
            <section key={account.cloudName} className="paper-panel">
              <CardHead
                icon={<Cloud className="size-5" />}
                title={t("cloudinaryTitle", { number: index + 1 })}
                detail={[account.cloudName, usage?.plan ? t("plan", { plan: usage.plan }) : null].filter(Boolean).join(" · ")}
                size={usage ? formatBytes(usage.storageBytes) : null}
                kept={t("kept", { count: counts.get(cloudinarySource(account.cloudName)) ?? 0 })}
              />
              {usage ? (
                <div className="mt-6 flex flex-col gap-3 border-t pt-4">
                  {usage.creditsUsed !== null && usage.creditsLimit ? (
                    <>
                      <Meter percent={percentOf(usage.creditsUsed, usage.creditsLimit)} label={t("cloudinaryTitle", { number: index + 1 })} />
                      <p className="text-sm leading-relaxed text-muted-foreground">
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

        <p className="max-w-[65ch] px-1 text-sm leading-relaxed text-muted-foreground">{t("liveNote")}</p>
      </div>
    </div>
  );
}

function CardHead({ icon, title, detail, size, kept }: { icon: React.ReactNode; title: string; detail: string; size: string | null; kept: string }) {
  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-medium leading-tight tracking-tight [overflow-wrap:anywhere]">{title}</h2>
          {detail ? <p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>{detail}</p> : null}
        </div>
        {size ? <p className="w-full shrink-0 pl-14 font-display text-3xl font-medium leading-tight tracking-tight tabular-nums sm:w-auto sm:pl-0">{size}</p> : null}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{kept}</p>
    </>
  );
}

function Meter({ percent, label }: { percent: number; label: string }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-valuetext={`${percent}%`} className="h-2 overflow-hidden rounded-lg bg-muted">
      <div
        className={cn("h-full rounded-lg", width >= 90 ? "bg-destructive" : width >= 70 ? "bg-accent-foreground" : "bg-olive")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <p className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/15 bg-destructive/5 p-4 text-sm leading-relaxed text-destructive">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}
