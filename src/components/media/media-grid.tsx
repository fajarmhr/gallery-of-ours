"use client";

import "react-photo-album/rows.css";
import { LoaderCircle, Play } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RowsPhotoAlbum, type Photo } from "react-photo-album";
import { formatDuration, mediaUrl } from "@/lib/format";
import type { MediaCard } from "@/lib/queries";
import { MediaViewer } from "./media-viewer";
import { ThumbhashImage } from "./thumbhash-image";

export type MediaGroup = { key: string; title?: string; subtitle?: string; divider?: string; items: MediaCard[] };
export type MoveTarget = { id: string; title: string };

type GridPhoto = Photo & { card: MediaCard };

export function MediaGallery({
  groups,
  shareToken,
  readOnly = false,
  moveTargets,
}: {
  groups: MediaGroup[];
  shareToken?: string;
  readOnly?: boolean;
  moveTargets?: MoveTarget[];
}) {
  const router = useRouter();
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const offsets = useMemo(
    () => groups.map((_, i) => groups.slice(0, i).reduce((sum, g) => sum + g.items.length, 0)),
    [groups],
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const processing = flat.some((item) => item.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [processing, router]);

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-9">
        {groups.map((group, groupIndex) => (
          <section key={group.key} id={`group-${group.key}`} className="scroll-mt-20">
            {group.divider ? (
              <h2 className="sticky top-16 z-10 -mx-1 mb-4 border-b bg-background/90 px-1 py-2 font-display text-3xl font-extrabold tracking-tight backdrop-blur">
                {group.divider}
              </h2>
            ) : null}
            {group.title ? (
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-0.5">
                <h3 className="font-display text-lg font-bold tracking-tight">{group.title}</h3>
                {group.subtitle ? <span className="text-sm text-muted-foreground">{group.subtitle}</span> : null}
              </div>
            ) : null}
            <RowsPhotoAlbum<GridPhoto>
              photos={group.items.map((card) => ({
                key: card.id,
                src: mediaUrl(card.id, "thumb", shareToken),
                width: card.width,
                height: card.height,
                alt: card.caption ?? card.aiCaption?.en ?? "",
                card,
              }))}
              targetRowHeight={(width) => (width < 480 ? 118 : width < 900 ? 170 : 220)}
              spacing={(width) => (width < 480 ? 4 : 6)}
              rowConstraints={{ singleRowMaxHeight: 300 }}
              onClick={({ index, photo }) => {
                setOpenedId(photo.card.id);
                setOpenIndex(offsets[groupIndex]! + index);
              }}
              componentsProps={{
                button: {
                  style: { position: "relative", overflow: "hidden", borderRadius: 8 },
                  className: "group/tile outline-none focus-visible:ring-3 focus-visible:ring-ring",
                },
              }}
              render={{
                image: (props, { photo }) => (
                  <ThumbhashImage
                    src={typeof props.src === "string" ? props.src : undefined}
                    alt={props.alt}
                    thumbhash={photo.card.thumbhash}
                    layoutId={`media-${photo.card.id}`}
                    style={props.style}
                    className="h-full w-full"
                    imgClassName="transition-[filter,transform] duration-300 group-hover/tile:brightness-105"
                  />
                ),
                extras: (_, { photo }) => <TileBadges card={photo.card} />,
              }}
            />
          </section>
        ))}
      </div>

      <AnimatePresence>
        {openIndex !== null && flat[openIndex] ? (
          <MediaViewer
            key="viewer"
            items={flat}
            index={openIndex}
            morphId={openedId}
            onIndexChange={setOpenIndex}
            onClose={() => setOpenIndex(null)}
            shareToken={shareToken}
            readOnly={readOnly}
            moveTargets={moveTargets}
          />
        ) : null}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function TileBadges({ card }: { card: MediaCard }) {
  return (
    <>
      {card.type === "video" ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
          <Play className="size-3 fill-current" />
          {formatDuration(card.durationSec)}
        </span>
      ) : null}
      {card.status === "processing" ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/15">
          <LoaderCircle className="size-6 animate-spin text-white drop-shadow" />
        </span>
      ) : null}
    </>
  );
}
