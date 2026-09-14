"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  FolderInput,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setAlbumCover } from "@/actions/albums";
import { moveMedia, trashMedia } from "@/actions/media";
import { getMediaSocial, toggleFavorite, type MediaSocial } from "@/actions/social";
import { LocationDialog } from "@/components/location/location-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mediaUrl } from "@/lib/format";
import type { MediaCard } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { SocialPanel } from "./comments";
import type { MoveTarget } from "./media-grid";
import { thumbhashDataUrl } from "./thumbhash-image";

type Props = {
  items: MediaCard[];
  index: number;
  morphId: string | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  shareToken?: string;
  readOnly: boolean;
  moveTargets?: MoveTarget[];
};

const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Directions the small hearts of a burst fly out in. */
const SPARKS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 320;

export function MediaViewer({ items, index, morphId, onIndexChange, onClose, shareToken, readOnly, moveTargets }: Props) {
  const item = items[index]!;
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const ta = useTranslations("albums");
  const te = useTranslations("errors");
  const tl = useTranslations("location");
  const format = useFormatter();
  const now = useNow();
  const locale = useLocale();
  const router = useRouter();

  const [direction, setDirection] = useState(0);
  const [panelOpen, setPanelOpen] = useState(() => !readOnly && window.matchMedia("(min-width: 1024px)").matches);
  const [locationOpen, setLocationOpen] = useState(false);
  const [socialState, setSocialState] = useState<{ id: string; data: MediaSocial } | null>(null);
  const [socialVersion, setSocialVersion] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const social = socialState?.id === item.id ? socialState.data : null;

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= items.length) return;
      setDirection(delta);
      onIndexChange(next);
    },
    [index, items.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The location dialog handles its own keys, including Escape.
      if (locationOpen || (event.target as HTMLElement)?.closest("input, textarea")) return;
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, locationOpen]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    getMediaSocial(item.id).then((result) => {
      if (!cancelled && result.ok) setSocialState({ id: item.id, data: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, readOnly, socialVersion]);

  const reloadSocial = useCallback(() => setSocialVersion((v) => v + 1), []);

  useEffect(() => {
    for (const neighbour of [items[index + 1], items[index - 1]]) {
      if (neighbour?.type === "photo") new Image().src = mediaUrl(neighbour.id, "large", shareToken);
    }
  }, [index, items, shareToken]);

  const caption = item.caption ?? (locale === "id" ? item.aiCaption?.id : item.aiCaption?.en) ?? null;
  const takenAt = item.takenAt ? new Date(item.takenAt) : null;
  const meta = [takenAt ? null : t("undated"), item.placeName, item.uploaderName ? t("uploadedBy", { name: item.uploaderName }) : null]
    .filter(Boolean)
    .join(" · ");
  // Everyone who reacted, you first: "Loved by you, Mama and 2 others".
  const people = social ? [...(social.reactions.some((r) => r.mine) ? [t("you")] : []), ...social.reactedBy] : [];
  const lovedBy =
    people.length === 0
      ? null
      : people.length <= 3
        ? t("lovedBy", { names: format.list(people) })
        : t("lovedByMore", { names: people.slice(0, 2).join(", "), count: people.length - 2 });

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  async function onFavorite() {
    if (!social) return;
    // The heart bursts straight away; the server catches up.
    if (!social.favorited) setBurst((n) => n + 1);
    const result = await toggleFavorite(item.id);
    if (!result.ok) return fail(result.error);
    setSocialState((s) => (s && s.id === item.id ? { ...s, data: { ...s.data, favorited: result.data.favorited } } : s));
  }

  /** A double tap on a photo favorites it. It never removes a favorite, so another double tap only bursts again. */
  function onPhotoTap() {
    const time = Date.now();
    const isDouble = time - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = isDouble ? 0 : time;
    if (!isDouble || readOnly || !social) return;
    if (social.favorited) setBurst((n) => n + 1);
    else void onFavorite();
  }

  async function onCover() {
    const result = await setAlbumCover(item.albumId, item.id);
    if (!result.ok) return fail(result.error);
    toast.success(ta("coverSet"));
    router.refresh();
  }

  async function onMove(target: MoveTarget) {
    const result = await moveMedia([item.id], target.id);
    if (!result.ok) return fail(result.error);
    toast.success(t("moved", { count: 1 }));
    onClose();
    router.refresh();
  }

  async function onTrash() {
    if (!window.confirm(t("trashConfirm", { count: 1 }))) return;
    const result = await trashMedia([item.id]);
    if (!result.ok) return fail(result.error);
    toast.success(t("trashed", { count: 1 }));
    onClose();
    router.refresh();
  }

  const commentCount = social?.comments.length ?? 0;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={caption ?? item.albumTitle ?? t("info")}
      className="fixed inset-0 z-50 flex bg-[#0f0b09] text-[#f2e9df]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent p-2 sm:p-3">
          <ViewerButton label={tc("close")} onClick={onClose}>
            <X />
          </ViewerButton>
          <span className="px-1 text-sm tabular-nums text-white/75">
            {index + 1} / {items.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {!readOnly ? (
              <ViewerButton label={social?.favorited ? t("unfavorite") : t("favorite")} onClick={onFavorite} disabled={!social}>
                <Heart className={cn(social?.favorited && "fill-[#ff8f7a] text-[#ff8f7a]")} />
              </ViewerButton>
            ) : null}
            {!readOnly ? (
              <ViewerButton label={t("comments")} onClick={() => setPanelOpen((open) => !open)} active={panelOpen}>
                <MessageCircle />
                {commentCount > 0 ? (
                  <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                    {commentCount}
                  </span>
                ) : null}
              </ViewerButton>
            ) : null}
            <a
              href={mediaUrl(item.id, "download", shareToken)}
              aria-label={t("downloadOriginal")}
              title={t("downloadOriginal")}
              className="grid size-10 place-items-center rounded-full text-white/90 hover:bg-white/10 [&_svg]:size-5"
            >
              <Download />
            </a>
            {social?.canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={tc("more")} className="grid size-10 place-items-center rounded-full text-white/90 hover:bg-white/10 [&_svg]:size-5">
                    <Ellipsis />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[60] w-56">
                  {item.type === "photo" ? (
                    <DropdownMenuItem onSelect={onCover}>
                      <ImagePlus />
                      {ta("setCover")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => setLocationOpen(true)}>
                    <MapPin />
                    {tl("button")}
                  </DropdownMenuItem>
                  {moveTargets && moveTargets.length > 1 ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput />
                        {t("moveTo")}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="z-[60] max-h-72 overflow-y-auto">
                        {moveTargets
                          .filter((target) => target.id !== item.albumId)
                          .map((target) => (
                            <DropdownMenuItem key={target.id} onSelect={() => onMove(target)}>
                              {target.title}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onTrash}>
                    <Trash2 />
                    {t("trash")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={item.id}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? 90 : d < 0 ? -90 : 0, opacity: d === 0 ? 1 : 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d > 0 ? -90 : 90, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
              drag={item.type === "photo" ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) go(1);
                else if (info.offset.x > 80) go(-1);
              }}
              onTap={item.type === "photo" ? onPhotoTap : undefined}
              className="flex h-full w-full items-center justify-center px-2 pb-28 pt-16 sm:px-14"
            >
              {item.type === "video" ? (
                <video
                  src={mediaUrl(item.id, "original", shareToken)}
                  poster={mediaUrl(item.id, "large", shareToken)}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-lg bg-black"
                />
              ) : (
                <motion.img
                  layoutId={item.id === morphId ? `media-${item.id}` : undefined}
                  src={mediaUrl(item.id, "large", shareToken)}
                  alt={caption ?? ""}
                  draggable={false}
                  className="max-h-full max-w-full select-none rounded-md object-contain shadow-2xl"
                  style={{
                    aspectRatio: `${item.width} / ${item.height}`,
                    backgroundImage: thumbhashDataUrl(item.thumbhash) ? `url(${thumbhashDataUrl(item.thumbhash)})` : undefined,
                    backgroundSize: "cover",
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {burst > 0 ? <HeartBurst key={burst} /> : null}

          {index > 0 ? (
            <NavArrow side="left" label={tc("previous")} onClick={() => go(-1)}>
              <ChevronLeft />
            </NavArrow>
          ) : null}
          {index < items.length - 1 ? (
            <NavArrow side="right" label={tc("next")} onClick={() => go(1)}>
              <ChevronRight />
            </NavArrow>
          ) : null}
        </div>

        <div className="glass pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-2xl px-4 py-3 text-white sm:inset-x-6 sm:bottom-5">
          {takenAt ? (
            <p className="date-stamp mb-0.5 text-xs sm:text-sm">
              {format.dateTime(takenAt, { dateStyle: "medium" })} · {format.relativeTime(takenAt, now)}
            </p>
          ) : null}
          {caption ? <p className="font-display text-lg font-bold leading-snug">{caption}</p> : null}
          {meta ? <p className="text-sm text-white/85">{meta}</p> : null}
          {lovedBy ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
              <Heart className="size-3.5 shrink-0 fill-[#ff8f7a] text-[#ff8f7a]" />
              {lovedBy}
            </p>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && !readOnly ? (
          <motion.aside
            key="panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-30 max-h-[72dvh] overflow-y-auto rounded-t-3xl border-t bg-card text-card-foreground shadow-2xl lg:static lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-t-0"
          >
            <SocialPanel key={item.id} item={item} social={social} onChanged={reloadSocial} onClose={() => setPanelOpen(false)} />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {social?.canEdit ? (
        <LocationDialog target={{ kind: "media", id: item.id }} open={locationOpen} onOpenChange={setLocationOpen} onSaved={() => router.refresh()} />
      ) : null}
    </motion.div>
  );
}

/** A big heart that pops over the photo while small ones fly out around it. */
function HeartBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <motion.span
        className="col-start-1 row-start-1 text-[#ff8f7a] drop-shadow-lg"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.2, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1, times: [0, 0.3, 0.6, 1], ease: EASE }}
      >
        <Heart className="size-24 fill-current" />
      </motion.span>
      {SPARKS.map((angle) => (
        <motion.span
          key={angle}
          className="col-start-1 row-start-1 text-[#ffb199]"
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
          animate={{ x: Math.cos(angle) * 120, y: Math.sin(angle) * 120, scale: 1, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        >
          <Heart className="size-5 fill-current" />
        </motion.span>
      ))}
    </span>
  );
}

function ViewerButton({
  label,
  onClick,
  children,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative grid size-10 place-items-center rounded-full text-white/90 hover:bg-white/10 disabled:opacity-40 [&_svg]:size-5",
        active && "bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

function NavArrow({ side, label, onClick, children }: { side: "left" | "right"; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "glass absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full text-white sm:grid [&_svg]:size-6",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {children}
    </button>
  );
}
