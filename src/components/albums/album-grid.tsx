import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AlbumPile } from "@/components/polaroid";
import { formatDateRange, mediaUrl } from "@/lib/format";
import type { AlbumOverview } from "@/lib/queries";

export async function AlbumGrid({ albums }: { albums: AlbumOverview[] }) {
  const t = await getTranslations("albums");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const locale = await getLocale();

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-8 xl:gap-x-12">
      {albums.map((album) => {
        const meta = album.locked
          ? t("lockedTitle", { date: format.dateTime(new Date(album.unlockAt!), { dateStyle: "medium" }) })
          : [formatDateRange(locale, album.startDate, album.endDate), tc("photos", { count: album.itemCount })].filter(Boolean).join(" · ");
        return (
          <Link
            key={album.id}
            href={`/albums/${album.id}`}
            className="group flex min-w-0 flex-col gap-1.5 rounded-lg px-1 pb-3 pt-8 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlbumPile covers={album.covers.map((c) => mediaUrl(c.id, "medium"))} locked={album.locked} className="mx-auto mb-7 w-[82%]" />
            {album.note ? <span className="text-sm leading-relaxed text-note">{album.note}</span> : null}
            <span className="font-display text-[1.4rem] font-medium leading-tight tracking-tight sm:text-[1.7rem]">{album.title}</span>
            <span className="text-xs leading-relaxed text-muted-foreground tabular-nums sm:text-sm">{meta}</span>
          </Link>
        );
      })}
    </div>
  );
}
