import { ArrowLeft, Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { AlbumHeader } from "@/components/albums/album-header";
import { CapsuleOpening } from "@/components/albums/capsule-opening";
import { EmptyState } from "@/components/empty-state";
import { MediaGallery, type MediaGroup } from "@/components/media/media-grid";
import { SealedEnvelope } from "@/components/polaroid";
import type { StorySlide } from "@/components/story/story-player";
import { cloudinaryAccountOptions } from "@/lib/cloudinary";
import { env } from "@/lib/env";
import { dayKey, daysBetween, filmStamp, formatDateRange, mediaUrl } from "@/lib/format";
import { canEditAlbum, isAdmin, isAlbumLocked, isSuperadmin } from "@/lib/permissions";
import { getAlbum, getAlbumMedia, listAlbumsForMove, type MediaCard } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/albums/[albumId]">): Promise<Metadata> {
  const { albumId } = await params;
  if (!UUID.test(albumId)) return {};
  const row = await getAlbum(albumId);
  return { title: row?.album.title ?? "Album" };
}

export default async function AlbumPage({ params }: PageProps<"/albums/[albumId]">) {
  const user = await requireActiveUser();
  const { albumId } = await params;
  if (!UUID.test(albumId)) notFound();
  const row = await getAlbum(albumId);
  if (!row || row.album.deletedAt) notFound();

  const { album } = row;
  const t = await getTranslations("albums");
  const tc = await getTranslations("common");
  const tm = await getTranslations("media");
  const ts = await getTranslations("story");
  const tcap = await getTranslations("capsules");
  const format = await getFormatter();
  const locale = await getLocale();
  const timeZone = env.timeZone;

  const back = (
    <Link href="/albums" className="mb-4 inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" />
      {t("title")}
    </Link>
  );

  if (isAlbumLocked(album, user.id)) {
    const days = Math.max(1, daysBetween(new Date(), album.unlockAt!));
    return (
      <>
        {back}
        <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
          <SealedEnvelope className="mb-8 w-48 -rotate-3 sm:w-56" />
          <h1 className="text-balance font-display text-3xl font-extrabold tracking-tight">{album.title}</h1>
          <p className="mt-2 font-semibold">{t("lockedTitle", { date: format.dateTime(album.unlockAt!, { dateStyle: "long" }) })}</p>
          <p className="mt-1 max-w-[46ch] text-pretty text-muted-foreground">{t("lockedText", { count: days })}</p>
          {row.createdByName ? <p className="mt-4 inline-block -rotate-2 font-hand text-2xl text-note">{tcap("sealedBy", { name: row.createdByName })}</p> : null}
        </div>
      </>
    );
  }

  const [items, canEdit] = await Promise.all([getAlbumMedia(album.id), canEditAlbum(user, album.id)]);
  const moveTargets = canEdit ? await listAlbumsForMove() : undefined;
  const openedCapsule = album.unlockAt !== null && album.unlockAt <= new Date();

  const groups: MediaGroup[] = [];
  for (const item of items) {
    const key = dayKey(item.takenAt ?? item.createdAt, timeZone);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  const sameYear = new Set(groups.map((g) => g.key.slice(0, 4))).size === 1;
  for (const group of groups) {
    const date = new Date(`${group.key}T12:00:00`);
    group.title = format.dateTime(date, { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
    const placesInDay = [...new Set(group.items.map((i) => i.placeName).filter(Boolean))].slice(0, 3);
    group.subtitle = [...placesInDay, tc("photos", { count: group.items.length })].join(" · ");
  }

  const cover = items.find((i) => i.id === album.coverMediaId) ?? items.find((i) => i.type === "photo" && i.status === "ready");
  const contributors = new Set(items.map((i) => i.uploaderName).filter(Boolean)).size;
  const dateLabel = formatDateRange(locale, album.startDate, album.endDate);
  const meta = [dateLabel, tc("items", { count: items.length }), contributors ? tc("familyMembers", { count: contributors }) : null]
    .filter(Boolean)
    .join(" · ");

  const captionOf = (item: MediaCard) => item.caption ?? (locale === "id" ? item.aiCaption?.id : item.aiCaption?.en) ?? null;
  const storyItems = items.filter((i) => i.status === "ready").slice(0, 60);
  const slides: StorySlide[] = storyItems.length
    ? [
        { key: "intro", title: album.title, note: album.note ?? undefined, meta: dateLabel ?? undefined, image: cover ? mediaUrl(cover.id, "large") : undefined },
        ...storyItems.map((item) => ({
          key: item.id,
          image: mediaUrl(item.id, "large"),
          title: captionOf(item) ?? item.placeName ?? album.title,
          stamp: filmStamp(item.takenAt ?? item.createdAt, timeZone),
          meta: [item.placeName, item.uploaderName ? tm("uploadedBy", { name: item.uploaderName }) : null].filter(Boolean).join(" · "),
        })),
        { key: "outro", title: ts("toBeContinued"), meta: ts("photosInAlbum", { count: items.length }) },
      ]
    : [];

  return (
    <>
      {openedCapsule ? (
        <CapsuleOpening
          albumId={album.id}
          title={album.title}
          note={row.createdByName ? tcap("sealedByOn", { name: row.createdByName, date: format.dateTime(album.createdAt, { dateStyle: "long" }) }) : null}
        />
      ) : null}
      {back}
      <AlbumHeader
        album={{
          id: album.id,
          title: album.title,
          note: album.note,
          description: album.description,
          category: (["trips", "celebrations", "everyday", "other"].includes(album.category) ? album.category : "other") as "trips",
          startDate: album.startDate,
          endDate: album.endDate,
          unlockAt: album.unlockAt?.toISOString() ?? null,
          hasMusic: Boolean(album.musicKey),
        }}
        coverId={cover?.id ?? null}
        placeName={row.placeName}
        meta={meta}
        canEdit={canEdit}
        isAdmin={isAdmin(user)}
        itemCount={items.length}
        cloudinaryAccounts={isSuperadmin(user) ? cloudinaryAccountOptions() : []}
        slides={slides}
      />
      {items.length === 0 ? (
        <EmptyState icon={Images} title={t("emptyAlbumTitle")} text={canEdit ? t("emptyAlbumText") : t("noEditAccess")} />
      ) : (
        <>
          <MediaGallery groups={groups} moveTargets={moveTargets} />
          {!canEdit ? <p className="mt-10 text-center text-sm text-muted-foreground">{t("noEditAccess")}</p> : null}
        </>
      )}
    </>
  );
}
