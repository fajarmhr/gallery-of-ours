"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  return createPortal(<StoryOverlay {...props} />, document.body);
}

function StoryOverlay({ slides, heading, musicUrl, onClose }: Props) {
  const t = useTranslations("story");
  const tc = useTranslations("common");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(Boolean(musicUrl));
  const audio = useRef<HTMLAudioElement>(null);
  const slide = slides[index]!;

  const next = useCallback(() => {
    if (index < slides.length - 1) setIndex(index + 1);
    else onClose();
  }, [index, slides.length, onClose]);
  const previous = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
      if (event.key === " ") {
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
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-[70] overflow-hidden bg-[#0f0b09] text-[#f2e9df]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#4a2e22,transparent_60%),radial-gradient(circle_at_80%_90%,#2e3120,transparent_55%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0b09]/90 via-[#0f0b09]/10 to-[#0f0b09]/55" />
        </motion.div>
      </AnimatePresence>

      <button type="button" aria-label={tc("previous")} onClick={previous} className="absolute inset-y-0 left-0 z-10 w-1/3" />
      <button type="button" aria-label={tc("next")} onClick={next} className="absolute inset-y-0 right-0 z-10 w-1/3" />

      <div className="absolute inset-x-4 top-3 z-20 flex gap-1">
        {slides.map((s, i) => (
          <span key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            {i < index ? <i className="block h-full w-full bg-white" /> : null}
            {i === index ? (
              <i
                key={`${s.key}-${index}`}
                className="block h-full animate-story-fill bg-white"
                style={{ animationPlayState: paused ? "paused" : "running" }}
                onAnimationEnd={next}
              />
            ) : null}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-4 top-7 z-20 flex items-center gap-2 sm:inset-x-6">
        <p className="mr-auto truncate text-sm font-semibold">{heading}</p>
        {musicUrl ? (
          <button
            type="button"
            onClick={() => setMusicOn((on) => !on)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold"
          >
            {musicOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {musicOn ? t("musicOn") : t("musicOff")}
          </button>
        ) : null}
        <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="size-5" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={slide.key}
          className={cn(
            "pointer-events-none absolute z-20",
            slide.image ? "inset-x-6 bottom-28 sm:inset-x-10" : "inset-x-6 top-1/2 -translate-y-1/2 text-center sm:inset-x-10",
          )}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {slide.note ? <p className="mb-1 inline-block -rotate-2 font-hand text-3xl text-[#ffd3a8]">{slide.note}</p> : null}
          {slide.stamp ? <p className="date-stamp mb-2 text-lg">{slide.stamp}</p> : null}
          <h2
            className={cn(
              "text-balance font-display font-extrabold leading-[0.98] tracking-tight",
              slide.image ? "max-w-[18ch] text-4xl sm:text-6xl" : "mx-auto max-w-[16ch] text-5xl sm:text-7xl",
            )}
          >
            {slide.title}
          </h2>
          {slide.meta ? <p className="mt-3 text-sm text-white/80 sm:text-base">{slide.meta}</p> : null}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-3">
        <StoryControl label={tc("previous")} onClick={previous}>
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
  );
}

function StoryControl({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-12 place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 [&_svg]:size-5"
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
        className={cn("h-10 rounded-xl px-4", variant === "glass" && "glass text-white hover:bg-white/25 hover:text-white", className)}
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
