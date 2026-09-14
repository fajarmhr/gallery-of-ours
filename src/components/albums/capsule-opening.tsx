"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { WaxSeal } from "@/components/polaroid";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const storageKey = (albumId: string) => `capsule-opened:${albumId}`;
const noSubscription = () => () => undefined;

function openedBefore(albumId: string) {
  try {
    return window.localStorage.getItem(storageKey(albumId)) !== null;
  } catch {
    // Storage blocked (private mode): skip the moment rather than show it on every visit.
    return true;
  }
}

/**
 * The first visit to a time capsule after its day, once per device: a sealed envelope whose wax seal breaks when
 * tapped, then the album shows through.
 */
export function CapsuleOpening({ albumId, title, note }: { albumId: string; title: string; note: string | null }) {
  const t = useTranslations("capsules");
  // The server never shows it, so hydration matches; the browser then checks whether this device has opened it.
  const opened = useSyncExternalStore(noSubscription, () => openedBefore(albumId), () => true);
  const [phase, setPhase] = useState<"sealed" | "breaking" | "done">("sealed");
  const visible = phase === "breaking" || (phase === "sealed" && !opened);
  const breaking = phase === "breaking";

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  function breakSeal() {
    if (phase !== "sealed") return;
    try {
      window.localStorage.setItem(storageKey(albumId), new Date().toISOString());
    } catch {
      // Without storage it may play again next time, which is harmless.
    }
    setPhase("breaking");
  }

  if (!visible) return null;

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={breakSeal}
      className="fixed inset-0 z-[70] grid place-items-center bg-[#1c120e]/95 px-6 text-center text-[#f2e9df]"
      initial={{ opacity: 0 }}
      animate={{ opacity: breaking ? 0 : 1 }}
      transition={breaking ? { delay: 1.5, duration: 0.6 } : { duration: 0.4 }}
      onAnimationComplete={() => {
        if (breaking) setPhase("done");
      }}
    >
      <div className="flex flex-col items-center">
        <p className="inline-block -rotate-2 font-hand text-3xl text-[#ffd3a8]">{t("openingNote")}</p>
        <h2 className="mt-1 max-w-[18ch] text-balance font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
        {note ? <p className="mt-2 text-sm text-white/70">{note}</p> : null}

        <button type="button" aria-label={t("breakSeal")} className="mt-9 block w-64 max-w-[72vw] rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-[#ffd3a8]/60">
          <span className="relative block aspect-[3/2] [perspective:900px]">
            <span className="polaroid absolute inset-0 rounded-sm" />
            <motion.span
              className="absolute inset-x-0 top-0 h-[60%] origin-top bg-blank [clip-path:polygon(0_0,100%_0,50%_100%)]"
              animate={{ rotateX: breaking ? 180 : 0 }}
              transition={{ delay: 0.45, duration: 0.7, ease: EASE }}
            />
            {/* The seal cracks down the middle and both halves fall away. */}
            {[-1, 1].map((side) => (
              <motion.span
                key={side}
                className="absolute left-1/2 top-[60%] w-[30%] -translate-x-1/2 -translate-y-1/2"
                style={{ clipPath: side < 0 ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" }}
                animate={breaking ? { x: side * 44, y: 96, rotate: side * 38, opacity: 0 } : { rotate: [0, -5, 5, 0] }}
                transition={breaking ? { duration: 0.8, ease: "easeIn" } : { duration: 0.6, repeat: Infinity, repeatDelay: 2.2 }}
              >
                <WaxSeal className="w-full" />
              </motion.span>
            ))}
          </span>
        </button>
        <p className="mt-7 text-sm text-white/75">{t("breakSealHint")}</p>
      </div>
    </motion.div>,
    document.body,
  );
}
