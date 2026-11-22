"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StorySlide = {
  key: string;
  image?: string;
  title: string;
  meta?: string;
  stamp?: string;
  note?: string;
};

type Props = {
  slides: StorySlide[];
  heading: string;
  musicUrl?: string | null;
  onClose: () => void;
};

/**
 * Rendered into <body>: an ancestor with backdrop-filter or transform (like the album header's glass panel) would
 * otherwise become the containing block of this fixed overlay and shrink it to that ancestor's box.
 */
export function StoryPlayer(props: Props) {
  if (props.slides.length === 0) return null;
  return createPortal(<StoryOverlay {...props} />, document.body);
}

function StoryOverlay({ slides, heading, musicUrl, onClose }: Props) {
  const t = useTranslations("story");
  const tc = useTranslations("common");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(Boolean(musicUrl));
  const audio = useRef<HTMLAudioElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const contentPointer = useRef<{ x: number; y: number } | null>(null);
  const slide = slides[Math.min(index, slides.length - 1)]!;

  const next = useCallback(() => {
    if (index < slides.length - 1) setIndex(index + 1);
    else onClose();
  }, [index, slides.length, onClose]);
  const previous = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
      if (event.key === " ") {
        if ((event.target as HTMLElement)?.closest("button, a")) return;
        event.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, previous, onClose]);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (musicOn && !paused) void el.play().catch(() => setMusicOn(false));
    else el.pause();
  }, [musicOn, paused]);

  useEffect(() => {
    for (const s of [slides[index + 1], slides[index + 2]]) if (s?.image) new Image().src = s.image;
  }, [index, slides]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
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
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-x-0 top-0 z-[70] h-dvh overflow-hidden bg-[#211e1b] text-[#f2e9df] outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <DialogPrimitive.Title className="sr-only">{heading}</DialogPrimitive.Title>
      {musicUrl ? <audio ref={audio} src={musicUrl} loop preload="auto" /> : null}

      <AnimatePresence mode="sync">
        <motion.div
          key={slide.key}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
        >
          {slide.image ? (
            <motion.img
              src={slide.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ scale: 1.04, x: "0%" }}
              animate={paused ? undefined : { scale: 1.16, x: index % 2 ? "-2%" : "2%" }}
              transition={{ duration: 7, ease: "linear" }}
            />
          ) : (
            <div className="absolute inset-0 bg-[#342e28]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0b09]/90 via-[#0f0b09]/10 to-[#0f0b09]/55" />
        </motion.div>
      </AnimatePresence>

      <button type="button" tabIndex={-1} aria-hidden="true" disabled={index === 0} onClick={previous} className="absolute inset-y-0 left-0 z-10 w-1/3" />
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={next} className="absolute inset-y-0 right-0 z-10 w-1/3" />

      <div className="absolute left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] top-[calc(.75rem+env(safe-area-inset-top))] z-20 flex gap-1">
        {slides.map((s, i) => (
          <span key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            {i < index ? <i className="block h-full w-full bg-white" /> : null}
            {i === index ? (
              <i
                key={`${s.key}-${index}`}
                className="story-progress block h-full w-full animate-story-fill bg-white"
                style={{ animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={next}
              />
            ) : null}
          </span>
        ))}
      </div>

      <div className="absolute left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] top-[calc(1.75rem+env(safe-area-inset-top))] z-20 flex min-w-0 items-center gap-2">
        <p className="mr-auto min-w-0 truncate text-sm font-semibold">{heading}</p>
        {musicUrl ? (
          <button
            type="button"
            onClick={() => setMusicOn((on) => !on)}
            aria-pressed={musicOn}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold"
          >
            {musicOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {musicOn ? t("musicOn") : t("musicOff")}
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
          <X className="size-5" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.key}
          className={cn(
            "absolute bottom-[calc(6rem+env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] right-[max(1.5rem,env(safe-area-inset-right))] top-[calc(6rem+env(safe-area-inset-top))] z-20 touch-pan-y overflow-y-auto overscroll-contain sm:left-[max(2.5rem,env(safe-area-inset-left))] sm:right-[max(2.5rem,env(safe-area-inset-right))]",
          )}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          onPointerDown={(event) => { contentPointer.current = { x: event.clientX, y: event.clientY }; }}
          onPointerCancel={() => { contentPointer.current = null; }}
          onPointerUp={(event) => {
            const start = contentPointer.current;
            contentPointer.current = null;
            if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
            const box = event.currentTarget.getBoundingClientRect();
            const position = (event.clientX - box.left) / box.width;
            if (position < 1 / 3) previous();
            else if (position > 2 / 3) next();
          }}
        >
          <div className={cn("flex min-h-full flex-col", slide.image ? "justify-end" : "justify-center text-center")}>
          {slide.note ? <p className="mb-3 text-sm font-medium tracking-wide text-[#f0c8a6]">{slide.note}</p> : null}
          {slide.stamp ? <p className="date-stamp mb-3 text-sm">{slide.stamp}</p> : null}
          <h2
            className={cn(
              "shrink-0 break-words text-balance font-display font-normal leading-[0.98] tracking-tight",
              slide.image ? "max-w-[18ch] text-4xl sm:text-5xl landscape:text-3xl landscape:sm:text-4xl" : "mx-auto max-w-[16ch] text-4xl sm:text-6xl landscape:text-3xl landscape:sm:text-4xl",
            )}
          >
            {slide.title}
          </h2>
          {slide.meta ? <p className="mt-3 text-sm text-white/80 sm:text-base">{slide.meta}</p> : null}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center gap-3">
        <StoryControl label={tc("previous")} onClick={previous} disabled={index === 0}>
          <SkipBack />
        </StoryControl>
        <StoryControl label={paused ? tc("play") : tc("pause")} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play /> : <Pause />}
        </StoryControl>
        <StoryControl label={tc("next")} onClick={next}>
          <SkipForward />
        </StoryControl>
      </div>
    </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

function StoryControl({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-12 place-items-center rounded-lg border border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 disabled:opacity-40 [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

/** A button that opens the story player. Safe to render from server components. */
export function StoryButton({
  slides,
  heading,
  musicUrl,
  label,
  className,
  variant = "default",
}: {
  slides: StorySlide[];
  heading: string;
  musicUrl?: string | null;
  label: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "glass";
}) {
  const [open, setOpen] = useState(false);
  if (slides.length === 0) return null;
  return (
    <>
      <Button
        type="button"
        variant={variant === "glass" ? "ghost" : variant}
        onClick={() => setOpen(true)}
        className={cn("h-11 rounded-lg px-4", variant === "glass" && "glass text-white hover:bg-white/25 hover:text-white", className)}
      >
        <Play className="fill-current" />
        {label}
      </Button>
      <AnimatePresence>
        {open ? <StoryPlayer key="story" slides={slides} heading={heading} musicUrl={musicUrl} onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}
