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
import { Dialog as DialogPrimitive } from "radix-ui";
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
import { ZoomableImage } from "./zoomable-image";

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
  const [socialErrorId, setSocialErrorId] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [favoriting, setFavoriting] = useState(false);
  const [videoLoadedId, setVideoLoadedId] = useState<string | null>(null);
  const [videoErrorId, setVideoErrorId] = useState<string | null>(null);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
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
      if (event.defaultPrevented || locationOpen || (event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable], [role=menu]")) return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, locationOpen]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const overlay = dialog.current;
    if (!viewport || !overlay) return;
    // Mobile keyboards resize the visual viewport without always resizing fixed-position elements.
    const resize = () => {
      overlay.style.height = `${viewport.height}px`;
      overlay.style.top = `${viewport.offsetTop}px`;
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Safari otherwise zooms the whole page on a pinch. In here only the photo is allowed to grow.
    const refuse = (event: Event) => event.preventDefault();
    const gestures = ["gesturestart", "gesturechange", "gestureend"];
    for (const gesture of gestures) document.addEventListener(gesture, refuse, { passive: false });
    return () => {
      document.body.style.overflow = previous;
      for (const gesture of gestures) document.removeEventListener(gesture, refuse);
    };
  }, []);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    getMediaSocial(item.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSocialState({ id: item.id, data: result.data });
        setSocialErrorId(null);
      } else setSocialErrorId(item.id);
    }).catch(() => {
      if (!cancelled) setSocialErrorId(item.id);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, readOnly, socialVersion]);

  const reloadSocial = useCallback(() => {
    setSocialErrorId(null);
    setSocialVersion((v) => v + 1);
  }, []);

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
    if (!social || favoriting) return;
    setFavoriting(true);
    // The heart bursts straight away; the server catches up.
    if (!social.favorited) setBurst((n) => n + 1);
    try {
      const result = await toggleFavorite(item.id);
      if (!result.ok) return fail(result.error);
      setSocialState((s) => (s && s.id === item.id ? { ...s, data: { ...s.data, favorited: result.data.favorited } } : s));
    } catch {
      fail("network");
    } finally {
      setFavoriting(false);
    }
  }

  /** A double tap on a photo favorites it. It never removes a favorite, so another double tap only bursts again. */
  function onPhotoDoubleTap() {
    if (readOnly || !social) return;
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
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal container={document.body}>
        <DialogPrimitive.Content
          asChild
          aria-describedby={undefined}
          onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null; }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
          }}
        >
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={caption ?? item.albumTitle ?? t("info")}
      className="fixed inset-x-0 top-0 z-50 flex h-dvh overflow-hidden bg-[#211e1b] text-[#f2e9df] outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <DialogPrimitive.Title className="sr-only">{caption ?? item.albumTitle ?? t("info")}</DialogPrimitive.Title>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-[max(.5rem,env(safe-area-inset-left))] pb-2 pt-[max(.5rem,env(safe-area-inset-top))] pr-[max(.5rem,env(safe-area-inset-right))] sm:pb-3">
          <ViewerButton label={tc("close")} onClick={onClose}>
            <X />
          </ViewerButton>
          <span className="px-1 text-sm tabular-nums text-white/75">
            {index + 1} / {items.length}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {!readOnly ? (
              <ViewerButton label={social?.favorited ? t("unfavorite") : t("favorite")} onClick={onFavorite} disabled={!social || favoriting}>
                <Heart className={cn(social?.favorited && "fill-[#ff8f7a] text-[#ff8f7a]")} />
              </ViewerButton>
            ) : null}
            {!readOnly ? (
              <ViewerButton label={t("comments")} onClick={() => setPanelOpen((open) => !open)} active={panelOpen}>
                <MessageCircle />
                {commentCount > 0 ? (
                  <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-xs font-medium leading-4 text-primary-foreground">
                    {commentCount}
                  </span>
                ) : null}
              </ViewerButton>
            ) : null}
            <a
              href={mediaUrl(item.id, "download", shareToken)}
              aria-label={t("downloadOriginal")}
              title={t("downloadOriginal")}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/10 [&_svg]:size-5"
            >
              <Download />
            </a>
            {social?.canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={tc("more")} className="grid size-11 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/10 [&_svg]:size-5">
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

        <div className="relative flex flex-1 touch-none items-center justify-center overflow-hidden">
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
              className="h-full w-full"
            >
              {item.type === "video" ? (
                <div className="flex h-full w-full items-center justify-center px-[max(.5rem,env(safe-area-inset-left))] pr-[max(.5rem,env(safe-area-inset-right))] pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] sm:pl-[max(3.5rem,env(safe-area-inset-left))] sm:pr-[max(3.5rem,env(safe-area-inset-right))] landscape:pb-[calc(5rem+env(safe-area-inset-bottom))] landscape:pt-[calc(4rem+env(safe-area-inset-top))]">
                  <video
                    key={videoAttempt}
                    src={mediaUrl(item.id, "original", shareToken)}
                    poster={mediaUrl(item.id, "large", shareToken)}
                    controls
                    autoPlay
                    playsInline
                    onLoadedData={() => {
                      setVideoLoadedId(item.id);
                      setVideoErrorId((errorId) => errorId === item.id ? null : errorId);
                    }}
                    onError={() => setVideoErrorId(item.id)}
                    className="max-h-full max-w-full rounded-lg bg-black"
                  />
                  {videoErrorId === item.id ? (
                    <div role="alert" className="absolute flex max-w-xs flex-col items-center gap-3 rounded-xl bg-[#211e1b] p-5 text-center text-sm">
                      <p>{te("unknown")}</p>
                      <button type="button" className="min-h-11 rounded-lg border border-white/25 px-4 hover:bg-white/10" onClick={() => {
                        setVideoErrorId(null);
                        setVideoLoadedId(null);
                        setVideoAttempt((attempt) => attempt + 1);
                      }}>{tc("retry")}</button>
                    </div>
                  ) : videoLoadedId !== item.id ? <p role="status" className="pointer-events-none absolute text-sm text-white/75">{tc("loading")}</p> : null}
                </div>
              ) : (
                <ZoomableImage
                  layoutId={item.id === morphId ? `media-${item.id}` : undefined}
                  src={mediaUrl(item.id, "large", shareToken)}
                  alt={caption ?? item.originalName ?? item.albumTitle ?? t("info")}
                  aspectRatio={`${item.width} / ${item.height}`}
                  poster={thumbhashDataUrl(item.thumbhash)}
                  onDoubleTap={onPhotoDoubleTap}
                  onSwipe={go}
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

        <div className="glass absolute bottom-[max(.75rem,env(safe-area-inset-bottom))] left-[max(.75rem,env(safe-area-inset-left))] right-[max(.75rem,env(safe-area-inset-right))] z-10 max-h-[24%] touch-pan-y overflow-y-auto overscroll-contain rounded-xl px-4 py-3 text-white sm:left-[max(1.5rem,env(safe-area-inset-left))] sm:right-[max(1.5rem,env(safe-area-inset-right))] landscape:max-h-[20%] landscape:py-2">
          {takenAt ? (
            <p className="date-stamp mb-0.5 text-xs sm:text-sm">
              {format.dateTime(takenAt, { dateStyle: "medium" })} · {format.relativeTime(takenAt, now)}
            </p>
          ) : null}
          {caption ? <p className="break-words font-display text-2xl font-medium leading-snug">{caption}</p> : null}
          {meta ? <p className="break-words text-sm text-white/85">{meta}</p> : null}
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
            className="absolute inset-x-0 bottom-0 z-30 max-h-[72%] overflow-y-auto overscroll-contain rounded-t-xl border-t bg-card text-card-foreground [@media(max-height:500px)]:max-h-full lg:static lg:max-h-full lg:w-[min(380px,38vw)] lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0"
          >
            <SocialPanel key={item.id} item={item} social={social} loadError={socialErrorId === item.id} onChanged={reloadSocial} onClose={() => setPanelOpen(false)} />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {social?.canEdit ? (
        <LocationDialog target={{ kind: "media", id: item.id }} open={locationOpen} onOpenChange={setLocationOpen} onSaved={() => router.refresh()} />
      ) : null}
    </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** A big heart that pops over the photo while small ones fly out around it. */
function HeartBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <motion.span
        className="col-start-1 row-start-1 text-[#dc9578]"
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
        "relative grid size-11 shrink-0 place-items-center rounded-lg text-white/90 hover:bg-white/10 disabled:opacity-40 [&_svg]:size-5",
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
        "glass absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-lg text-white [&_svg]:size-6",
        side === "left" ? "left-[max(.75rem,env(safe-area-inset-left))]" : "right-[max(.75rem,env(safe-area-inset-right))]",
      )}
    >
      {children}
    </button>
  );
}
