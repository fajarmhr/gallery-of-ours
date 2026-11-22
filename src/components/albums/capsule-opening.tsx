"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Dialog as DialogPrimitive } from "radix-ui";
import { SealedEnvelope } from "@/components/polaroid";

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
 * The first visit after a capsule opens, once per device: a quiet envelope reveal before the album.
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
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) breakSeal(); }}>
      <DialogPrimitive.Content asChild aria-describedby={undefined}>
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/98 px-[max(1.5rem,env(safe-area-inset-left))] py-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: breaking ? 0 : 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      onAnimationComplete={() => {
        if (breaking) setPhase("done");
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center rounded-xl border bg-card px-6 py-8 sm:p-10">
        <p className="text-sm font-medium text-primary">{t("openingNote")}</p>
        <DialogPrimitive.Title className="mt-4 max-w-[20ch] break-words text-balance font-display text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{title}</DialogPrimitive.Title>
        {note ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p> : null}

        <button type="button" onClick={breakSeal} disabled={breaking} aria-label={t("breakSeal")} className="mt-8 block w-52 max-w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <motion.span className="block" animate={breaking ? { y: -8, opacity: 0 } : { y: 0, opacity: 1 }} transition={{ duration: 0.35, ease: EASE }}>
            <SealedEnvelope />
          </motion.span>
        </button>
        <p className="mt-6 text-sm text-muted-foreground">{t("breakSealHint")}</p>
      </div>
    </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>,
    document.body,
  );
}
