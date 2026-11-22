"use client";

import { CloudDownload, Download, Ellipsis, MapPin, Music, Pencil, Share2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { finishAlbumMusicUpload, removeAlbumMusic, startAlbumMusicUpload, trashAlbum } from "@/actions/albums";
import { LocationDialog } from "@/components/location/location-dialog";
import { ThumbhashImage } from "@/components/media/thumbhash-image";
import { StoryButton, type StorySlide } from "@/components/story/story-player";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpload } from "@/components/upload/upload-context";
import { putWithProgress } from "@/components/upload/prepare-file";
import { mediaUrl } from "@/lib/format";
import { AlbumFormDialog } from "./album-form-dialog";
import { CloudinaryImportDialog, type CloudinaryAccountOption } from "./cloudinary-import-dialog";
import { ShareDialog } from "./share-dialog";

type Props = {
  album: {
    id: string;
    title: string;
    note: string | null;
    description: string | null;
    category: "trips" | "celebrations" | "everyday" | "other";
    startDate: string | null;
    endDate: string | null;
    unlockAt: string | null;
    hasMusic: boolean;
  };
  coverId: string | null;
  meta: string;
  /** Where the album happened, used for its photos without a location of their own. */
  placeName: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  itemCount: number;
  slides: StorySlide[];
  /** Cloudinary accounts a superadmin can import from; empty for everyone else. */
  cloudinaryAccounts: CloudinaryAccountOption[];
};

export function AlbumHeader({ album, coverId, meta, placeName, canEdit, isAdmin, itemCount, slides, cloudinaryAccounts }: Props) {
  const t = useTranslations("albums");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tcl = useTranslations("cloudinary");
  const tl = useTranslations("location");
  const router = useRouter();
  const { open: openUpload } = useUpload();
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const musicInput = useRef<HTMLInputElement>(null);
  const canImport = canEdit && cloudinaryAccounts.length > 0;

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  async function uploadMusic(file: File) {
    const started = await startAlbumMusicUpload(album.id, file.name, file.type, file.size);
    if (!started.ok) return fail(started.error);
    try {
      await putWithProgress(started.data, file, () => undefined);
    } catch {
      return fail("upload_missing");
    }
    const finished = await finishAlbumMusicUpload(album.id, started.data.key);
    if (!finished.ok) return fail(finished.error);
    toast.success(t("musicAdded"));
    router.refresh();
  }

  return (
    <header className="mb-10 overflow-hidden rounded-xl border bg-card">
      <div className={coverId ? "grid lg:grid-cols-[1.1fr_.9fr]" : "grid"}>
      <div className="flex min-w-0 flex-col p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-primary">{t(album.category)}</span>
          <div className="flex items-center gap-1">
          {isAdmin ? (
            <HeaderIcon label={t("shareLink")} onClick={() => setShareOpen(true)}>
              <Share2 />
            </HeaderIcon>
          ) : null}
          {itemCount > 0 ? (
            <a href={`/api/albums/${album.id}/zip`} aria-label={t("downloadZip")} title={t("downloadZip")} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-[18px]">
              <Download />
            </a>
          ) : null}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("settings")} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-[18px]">
                  <Ellipsis />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil />
                  {t("editTitle")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocationOpen(true)}>
                  <MapPin />
                  {tl("button")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => musicInput.current?.click()}>
                  <Music />
                  {album.hasMusic ? t("replaceMusic") : t("addMusic")}
                </DropdownMenuItem>
                {album.hasMusic ? (
                  <DropdownMenuItem
                    onSelect={async () => {
                      const result = await removeAlbumMusic(album.id);
                      if (!result.ok) return fail(result.error);
                      toast.success(t("musicRemoved"));
                      router.refresh();
                    }}
                  >
                    <Music />
                    {t("removeMusic")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setTrashOpen(true)}>
                  <Trash2 />
                  {t("moveToTrash")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          </div>
        </div>

        <div className="my-6 min-w-0 max-w-2xl [overflow-wrap:anywhere] sm:my-8">
          {album.note ? <p className="mb-3 text-sm leading-relaxed text-note">{album.note}</p> : null}
          <h1 className="text-balance font-display text-4xl font-normal leading-[1.08] tracking-tight sm:text-5xl">{album.title}</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{meta}</p>
          {placeName ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {placeName}
            </p>
          ) : null}
          {album.description ? <p className="mt-4 max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">{album.description}</p> : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t pt-5">
          <StoryButton slides={slides} heading={album.title} musicUrl={album.hasMusic ? `/api/albums/${album.id}/music` : null} label={t("story")} variant="outline" className="h-11 rounded-lg px-4" />
        {canEdit ? (
          <>
            <Button onClick={() => openUpload(album.id)} className="h-11 rounded-lg px-4">
              <Upload />
              {t("addPhotos")}
            </Button>
            {placeName ? null : (
              <Button variant="ghost" onClick={() => setLocationOpen(true)} className="h-11 rounded-lg px-4">
                <MapPin />
                {tl("button")}
              </Button>
            )}
            {canImport ? (
              <Button variant="ghost" onClick={() => setCloudinaryOpen(true)} className="h-11 rounded-lg px-4">
                <CloudDownload />
                {tcl("button")}
              </Button>
            ) : null}
          </>
        ) : null}
        </div>
      </div>
      {coverId ? <ThumbhashImage src={mediaUrl(coverId, "large")} alt={album.title} className="aspect-[4/3] border-t lg:aspect-auto lg:min-h-[360px] lg:border-l lg:border-t-0" eager /> : null}
      </div>

      <input
        ref={musicInput}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadMusic(file);
          event.target.value = "";
        }}
      />

      {canEdit ? (
        <AlbumFormDialog
          albumId={album.id}
          open={editOpen}
          onOpenChange={setEditOpen}
          canSeal={isAdmin}
          initial={{
            title: album.title,
            note: album.note ?? "",
            description: album.description ?? "",
            category: album.category,
            startDate: album.startDate ?? "",
            endDate: album.endDate ?? "",
            unlockAt: album.unlockAt ? album.unlockAt.slice(0, 10) : "",
          }}
        />
      ) : null}
      {canEdit ? (
        <LocationDialog target={{ kind: "album", id: album.id }} open={locationOpen} onOpenChange={setLocationOpen} onSaved={() => router.refresh()} />
      ) : null}
      {isAdmin ? <ShareDialog albumId={album.id} open={shareOpen} onOpenChange={setShareOpen} /> : null}
      {canImport ? <CloudinaryImportDialog albumId={album.id} accounts={cloudinaryAccounts} open={cloudinaryOpen} onOpenChange={setCloudinaryOpen} /> : null}

      <AlertDialog open={trashOpen} onOpenChange={setTrashOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trashTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("trashText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const result = await trashAlbum(album.id);
                if (!result.ok) return fail(result.error);
                toast.success(t("trashed"));
                router.push("/albums");
              }}
            >
              {t("moveToTrash")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

function HeaderIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-[18px]">
      {children}
    </button>
  );
}
