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
    <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 sm:gap-x-4 xl:grid-cols-4">
      {albums.map((album) => {
        const meta = album.locked
          ? t("lockedTitle", { date: format.dateTime(new Date(album.unlockAt!), { dateStyle: "medium" }) })
          : [formatDateRange(locale, album.startDate, album.endDate), tc("photos", { count: album.itemCount })].filter(Boolean).join(" · ");
        return (
          <Link
            key={album.id}
            href={`/albums/${album.id}`}
            className="group flex flex-col gap-1 rounded-3xl px-2.5 pb-4 pt-7 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring sm:px-4"
          >
            <AlbumPile covers={album.covers.map((c) => mediaUrl(c.id, "thumb"))} locked={album.locked} className="mx-auto mb-6 w-[70%] sm:w-[62%]" />
            {album.note ? <span className="font-hand text-lg leading-tight text-note">{album.note}</span> : null}
            <span className="font-display text-base font-bold leading-snug tracking-tight sm:text-lg">{album.title}</span>
            <span className="text-xs text-muted-foreground tabular-nums sm:text-sm">{meta}</span>
          </Link>
        );
      })}
    </div>
  );
}
