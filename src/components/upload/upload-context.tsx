"use client";

import { CircleAlert, CircleCheck, ImageIcon, LoaderCircle, Play, RotateCcw, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { cancelUpload, finishUpload, startUploads } from "@/actions/upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isSupportedFile, postWithProgress, prepareFile, putWithProgress, type PreparedFile } from "./prepare-file";

type Stage = "reading" | "converting" | "uploading" | "finishing" | "done" | "failed";
type QueueItem = { clientId: string; name: string; stage: Stage; progress: number; prepared?: PreparedFile; error?: string };
type Job = { clientId: string; file: File; albumId: string; storageId: string };
type UploadAlbum = { id: string; title: string };
/** A Cloudinary account files can be stored in instead of R2. */
export type StorageOption = { id: string; label: string };
/** What a finished round of uploads brought in, shown as a small stack of prints. */
type Arrival = { id: number; count: number; albumId: string; title: string; previews: string[] };

const UploadContext = createContext<{ open: (albumId?: string) => void } | null>(null);

export function useUpload() {
  const value = useContext(UploadContext);
  if (!value) throw new Error("useUpload must be used inside UploadProvider");
  return value;
}

/** Transfers can overlap, but full-resolution decoding is serialized to fit phone memory. */
const CONCURRENCY = 3;
/** R2, the default storage. */
const PRIMARY_STORAGE = "primary";

export function UploadProvider({
  albums,
  canCreateAlbum,
  storageOptions,
  children,
}: {
  albums: UploadAlbum[];
  canCreateAlbum: boolean;
  storageOptions: StorageOption[];
  children: React.ReactNode;
}) {
  const t = useTranslations("upload");
  const ts = useTranslations("storage");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const albumFieldId = useId();
  const storageFieldId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);

  const [isOpen, setOpen] = useState(false);
  const [albumId, setAlbumId] = useState("");
  const [storageId, setStorageId] = useState(PRIMARY_STORAGE);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const jobs = useRef<Job[]>([]);
  const running = useRef(0);
  const preparation = useRef<Promise<void>>(Promise.resolve());
  const previewUrls = useRef(new Set<string>());
  const retryJobs = useRef(new Map<string, Job>());
  const arrivals = useRef(0);
  /** Files finished since the last arrival, with the album they went to. */
  const batch = useRef<{ albumId: string; preview: string | null }[]>([]);

  const open = useCallback(
    (preselect?: string) => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      if (preselect && albums.some((a) => a.id === preselect)) setAlbumId(preselect);
      else setAlbumId((current) => (albums.some((a) => a.id === current) ? current : (albums[0]?.id ?? "")));
      setOpen(true);
    },
    [albums],
  );

  useEffect(() => {
    const urls = previewUrls.current;
    const retries = retryJobs.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      retries.clear();
    };
  }, []);

  const update = (clientId: string, patch: Partial<QueueItem>) =>
    setQueue((items) => items.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));

  async function runJob({ clientId, file, albumId: target, storageId: store }: Job) {
    let pendingMediaId: string | null = null;
    try {
      const task = preparation.current.then(() => prepareFile(
        file,
        (stage) => update(clientId, { stage }),
        { portableDisplay: store === PRIMARY_STORAGE },
      ));
      preparation.current = task.then(() => undefined, () => undefined);
      const prepared = await task;
      if (prepared.previewUrl) previewUrls.current.add(prepared.previewUrl);
      update(clientId, { prepared, stage: "uploading", progress: 0 });

      const started = await startUploads(
        target,
        [
          {
            clientId,
            name: prepared.name,
            mime: prepared.mime,
            size: prepared.size,
            type: prepared.type,
            width: prepared.width,
            height: prepared.height,
            durationSec: prepared.durationSec,
            takenAt: prepared.takenAt,
            lat: prepared.lat,
            lng: prepared.lng,
            thumbhash: prepared.thumbhash,
            hasDisplay: Boolean(prepared.display),
            hasPoster: Boolean(prepared.poster),
          },
        ],
        store,
      );
      if (!started.ok) throw new Error(started.error);
      const targets = started.data[0]!;
      pendingMediaId = targets.mediaId;

      let uploaded: { publicId: string } | undefined;
      if (targets.cloudinary) {
        const answer = await postWithProgress(targets.cloudinary, file, (fraction) =>
          update(clientId, { progress: Math.min(99, Math.round(fraction * 100)) }),
        );
        uploaded = { publicId: typeof answer.public_id === "string" ? answer.public_id : "" };
      } else {
        const total = file.size + (prepared.display?.size ?? 0) + (prepared.poster?.size ?? 0);
        let sent = 0;
        const send = async (to: { url: string; headers: Record<string, string> } | undefined, blob: Blob | null) => {
          if (!to || !blob) return;
          await putWithProgress(to, blob, (fraction) =>
            update(clientId, { progress: Math.min(99, Math.round(((sent + fraction * blob.size) / total) * 100)) }),
          );
          sent += blob.size;
        };
        await send(targets.poster, prepared.poster);
        await send(targets.display, prepared.display);
        await send(targets.original, file);
      }

      update(clientId, { stage: "finishing", progress: 100 });
      const done = await finishUpload(targets.mediaId, uploaded);
      if (!done.ok) throw new Error(done.error);
      // Keep just the small preview in the queue, rather than retaining each converted photo.
      update(clientId, { stage: "done", prepared: { ...prepared, display: null, poster: null } });
      retryJobs.current.delete(clientId);
      batch.current.push({ albumId: target, preview: prepared.previewUrl ?? null });
    } catch (error) {
      if (pendingMediaId) await cancelUpload(pendingMediaId).catch(() => undefined);
      const code = error instanceof Error ? error.message : "unknown";
      retryJobs.current.set(clientId, { clientId, file, albumId: target, storageId: store });
      setQueue((items) => items.map((item) =>
        item.clientId === clientId && item.prepared
          ? { ...item, prepared: { ...item.prepared, display: null, poster: null } }
          : item,
      ));
      update(clientId, { stage: "failed", error: te.has(code) ? te(code) : te("unknown") });
    }
  }

  /** Everything finished: show what arrived, in the album most of it went to. */
  function celebrate() {
    const added = batch.current;
    batch.current = [];
    const perAlbum = new Map<string, number>();
    for (const entry of added) perAlbum.set(entry.albumId, (perAlbum.get(entry.albumId) ?? 0) + 1);
    const target = [...perAlbum.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    setArrival({
      id: ++arrivals.current,
      count: added.length,
      albumId: target,
      title: albums.find((album) => album.id === target)?.title ?? "",
      previews: added.flatMap((entry) => (entry.preview ? [entry.preview] : [])).slice(-3),
    });
    router.refresh();
  }

  function pump() {
    while (running.current < CONCURRENCY && jobs.current.length) {
      const job = jobs.current.shift()!;
      running.current += 1;
      void runJob(job).finally(() => {
        running.current -= 1;
        if (running.current === 0 && jobs.current.length === 0 && batch.current.length > 0) celebrate();
        pump();
      });
    }
  }

  function addFiles(files: FileList | File[]) {
    if (!albumId) {
      toast.error(t("pickAlbum"));
      return;
    }
    const accepted = Array.from(files).filter(isSupportedFile);
    if (accepted.length === 0) {
      toast.error(te("unsupported_file"));
      return;
    }
    if (accepted.length > 200) {
      toast.error(te("too_many_files"));
      return;
    }
    if (accepted.some((file) => file.size > 5 * 1024 * 1024 * 1024)) {
      toast.error(te("file_too_large"));
      return;
    }
    const store = storageOptions.some((option) => option.id === storageId) ? storageId : PRIMARY_STORAGE;
    // crypto.randomUUID only exists on https and localhost, not when the dev server is opened over Tailscale or the LAN.
    const newId = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    const items = accepted.map((file) => ({ clientId: newId(), name: file.name, stage: "reading" as Stage, progress: 0 }));
    setQueue((current) => [...items, ...current]);
    accepted.forEach((file, i) => jobs.current.push({ clientId: items[i]!.clientId, file, albumId, storageId: store }));
    pump();
  }

  function removePreview(item: QueueItem) {
    const url = item.prepared?.previewUrl;
    if (url) {
      URL.revokeObjectURL(url);
      previewUrls.current.delete(url);
    }
  }

  function retry(item: QueueItem) {
    const job = retryJobs.current.get(item.clientId);
    if (!job) return;
    retryJobs.current.delete(item.clientId);
    removePreview(item);
    update(item.clientId, { prepared: undefined, error: undefined, stage: "reading", progress: 0 });
    jobs.current.push(job);
    pump();
  }

  const closeArrival = useCallback(() => setArrival(null), []);
  const openArrival = () => {
    if (!arrival) return;
    router.push(`/albums/${arrival.albumId}`);
    setArrival(null);
    setOpen(false);
  };

  const busy = queue.some((item) => !["done", "failed"].includes(item.stage));

  const stageLabel = (item: QueueItem) =>
    ({
      reading: t("reading"),
      converting: t("converting"),
      uploading: `${t("uploading")} ${item.progress}%`,
      finishing: t("finishing"),
      done: t("done"),
      failed: item.error ?? t("failed"),
    })[item.stage];

  return (
    <UploadContext.Provider value={{ open }}>
      {children}
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
          }}
          className="gap-0 overflow-y-auto overscroll-contain data-[side=right]:w-full sm:data-[side=right]:max-w-lg"
        >
          <SheetHeader className="sticky top-0 z-10 shrink-0 border-b bg-popover pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-start gap-3">
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-display text-3xl font-medium tracking-tight">{t("title")}</SheetTitle>
                <SheetDescription>{t("footer")}</SheetDescription>
              </div>
              <SheetClose asChild>
                <Button type="button" size="icon-lg" variant="ghost" aria-label={tc("close")} className="size-11 shrink-0"><X /></Button>
              </SheetClose>
            </div>
          </SheetHeader>

          <div className="flex min-w-0 flex-col gap-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {arrival ? <ArrivalCard key={arrival.id} arrival={arrival} onOpen={openArrival} onClose={closeArrival} /> : null}

            {albums.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{canCreateAlbum ? t("noAlbums") : t("noAccess")}</p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={albumFieldId} className="text-sm font-semibold">{t("addTo")}</label>
                  <Select value={albumId} onValueChange={setAlbumId}>
                    <SelectTrigger id={albumFieldId} className="h-11 w-full min-w-0 rounded-lg">
                      <SelectValue placeholder={t("pickAlbum")} />
                    </SelectTrigger>
                    <SelectContent>
                      {albums.map((album) => (
                        <SelectItem key={album.id} value={album.id}>
                          {album.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {storageOptions.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={storageFieldId} className="text-sm font-semibold">{ts("label")}</label>
                    <Select value={storageId} onValueChange={setStorageId}>
                      <SelectTrigger id={storageFieldId} className="h-11 w-full min-w-0 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={PRIMARY_STORAGE}>{ts("r2")}</SelectItem>
                        {storageOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {storageId !== PRIMARY_STORAGE ? <p className="text-xs text-muted-foreground">{ts("cloudinaryHint")}</p> : null}
                  </div>
                ) : null}

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    addFiles(event.dataTransfer.files);
                  }}
                  className={cn(
                    "flex flex-col items-center rounded-2xl border-2 border-dashed border-input bg-card px-5 py-7 text-center transition-colors",
                    dragging && "border-primary bg-accent",
                  )}
                >
                  <Upload className="size-8 text-primary" />
                  <p className="mt-2 font-semibold">{t("drop")}</p>
                  <p className="text-sm text-muted-foreground">{t("types")}</p>
                  <Button type="button" className="mt-4 h-11 rounded-lg px-5" onClick={() => inputRef.current?.click()}>
                    {t("choose")}
                  </Button>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.heic,.heif,.hif,.mov,.mp4,.m4v"
                    aria-label={t("choose")}
                    tabIndex={-1}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files) addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>

                {busy ? <p role="status" className="text-sm text-muted-foreground">{t("keepOpen")}</p> : null}

                {queue.length > 0 ? (
                  <ul className="flex min-w-0 flex-col gap-2">
                    {queue.map((item) => {
                      const p = item.prepared;
                      return (
                        <li key={item.clientId} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card p-2">
                          <span className="grid size-[52px] place-items-center overflow-hidden rounded-xl bg-muted">
                            {p?.previewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.previewUrl} alt="" className="size-full object-cover" />
                            ) : item.stage === "done" ? (
                              p?.type === "video" ? <Play className="size-5 text-muted-foreground" /> : <ImageIcon className="size-5 text-muted-foreground" />
                            ) : item.stage === "failed" ? (
                              <CircleAlert className="size-5 text-destructive" />
                            ) : (
                              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{item.name}</span>
                            {p ? (
                              <span className="mt-1 flex flex-wrap gap-1">
                                {p.type === "video" ? (
                                  <Tag>{t("videoLength", { duration: formatDuration(p.durationSec) })}</Tag>
                                ) : (
                                  <>
                                    <Tag>{p.takenAt ? t("takenOn", { date: format.dateTime(new Date(p.takenAt), { dateStyle: "medium" }) }) : t("noDate")}</Tag>
                                    {p.lat === null ? <Tag warn>{t("noLocation")}</Tag> : null}
                                  </>
                                )}
                              </span>
                            ) : null}
                            {item.stage === "uploading" ? <Progress value={item.progress} className="mt-2 h-1.5" /> : null}
                            <span role={item.stage === "failed" ? "alert" : undefined} className={cn("mt-1 block break-words text-xs text-muted-foreground", item.stage === "failed" && "text-destructive")}>
                              {stageLabel(item)}
                            </span>
                          </span>
                          <span className="pr-1">
                            {item.stage === "done" ? (
                              <CircleCheck className="size-5 text-olive" />
                            ) : item.stage === "failed" ? (
                              <span className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  aria-label={`${tc("retry")}: ${item.name}`}
                                  onClick={() => retry(item)}
                                  className="grid size-11 place-items-center rounded-lg hover:bg-foreground/5"
                                >
                                  <RotateCcw className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={t("remove")}
                                  onClick={() => {
                                    retryJobs.current.delete(item.clientId);
                                    removePreview(item);
                                    setQueue((q) => q.filter((i) => i.clientId !== item.clientId));
                                  }}
                                  className="grid size-11 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-4" />
                                </button>
                              </span>
                            ) : item.stage === "uploading" || item.stage === "finishing" ? null : (
                              <CircleAlert className="size-5 opacity-0" />
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* With the sheet closed, the arrival floats over the page instead (the open sheet blocks clicks outside it). */}
      <AnimatePresence>
        {arrival && !isOpen ? <ArrivalCard key={arrival.id} arrival={arrival} floating onOpen={openArrival} onClose={closeArrival} /> : null}
      </AnimatePresence>
    </UploadContext.Provider>
  );
}

const PRINT_POSES = [
  { x: -16, rotate: -9 },
  { x: 14, rotate: 7 },
  { x: 0, rotate: -2 },
];

/** Uploads finished: the new photos drop in as a little stack of prints. A floating card steps aside after 10 seconds. */
function ArrivalCard({ arrival, floating = false, onOpen, onClose }: { arrival: Arrival; floating?: boolean; onOpen: () => void; onClose: () => void }) {
  const t = useTranslations("upload");
  const tc = useTranslations("common");

  useEffect(() => {
    if (!floating) return;
    const timer = setTimeout(onClose, 10_000);
    return () => clearTimeout(timer);
  }, [floating, onClose]);

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "flex items-center gap-3 overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground",
        floating ? "fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] max-h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] sm:left-auto sm:right-[max(1.5rem,env(safe-area-inset-right))] sm:w-[380px] lg:bottom-[max(1.5rem,env(safe-area-inset-bottom))]" : "",
      )}
    >
      <span className="grid size-16 shrink-0 place-items-center sm:size-20">
        {arrival.previews.length ? (
          arrival.previews.map((src, i) => {
            const pose = PRINT_POSES[i + PRINT_POSES.length - arrival.previews.length]!;
            return (
              <motion.span
                key={src}
                className="polaroid col-start-1 row-start-1 block size-14 p-1 pb-3"
                initial={{ y: -70, opacity: 0, rotate: 0, x: 0 }}
                animate={{ y: 0, opacity: 1, rotate: pose.rotate, x: pose.x }}
                transition={{ delay: 0.15 + i * 0.14, type: "spring", stiffness: 260, damping: 18 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </motion.span>
            );
          })
        ) : (
          <CircleCheck className="size-10 text-olive" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="-rotate-1 font-hand text-xl leading-none text-note">{t("arrivedNote")}</p>
        <p className="mt-1 font-display text-lg font-bold leading-tight">{t("allDone", { count: arrival.count })}</p>
        {arrival.title ? <p className="truncate text-sm text-muted-foreground">{t("arrivedIn", { album: arrival.title })}</p> : null}
        <Button type="button" size="sm" onClick={onOpen} className="mt-2 rounded-lg">
          {t("openAlbum")}
        </Button>
      </div>
      <button type="button" aria-label={tc("close")} onClick={onClose} className="grid size-11 shrink-0 place-items-center self-start rounded-lg hover:bg-foreground/5">
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={cn("max-w-full break-words rounded-full px-2 py-0.5 text-xs font-semibold", warn ? "bg-accent text-accent-foreground" : "bg-olive-soft text-olive")}>
      {children}
    </span>
  );
}
