"use client";

import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Safari's pinch events, which the DOM typings still do not describe. */
type GestureEvent = Event & { scale: number; clientX: number; clientY: number };

type Point = { x: number; y: number };

const MAX_SCALE = 6;
/** Past this the photo counts as zoomed in rather than sitting at its normal size. */
const ZOOMED_IN = 1.01;
/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 320;
/** A pointer that stayed within this many pixels was a tap, not a drag. */
const TAP_SLOP = 10;
/** How far a sideways drag has to travel before it turns to the next photo. */
const SWIPE_MIN = 80;
const SPRING = { type: "spring", stiffness: 420, damping: 40 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type Props = {
  src: string;
  alt: string;
  layoutId?: string;
  aspectRatio: string;
  poster?: string;
  /** Fires on a double tap while the photo sits at its normal size; zoomed in, a double tap zooms back out instead. */
  onDoubleTap: () => void;
  /** Asks for the next (1) or previous (-1) photo after a sideways drag. */
  onSwipe: (delta: 1 | -1) => void;
};

/**
 * The photo, and only the photo, zooms: a pinch, a wheel or Safari's trackpad gesture scales the image itself instead
 * of letting the browser blow up the whole page — header, captions and all — around it.
 */
export function ZoomableImage({ src, alt, layoutId, aspectRatio, poster, onDoubleTap, onSwipe }: Props) {
  const t = useTranslations("media");
  const surface = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const [level, setLevel] = useState(1);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<"none" | "tap" | "pan" | "swipe" | "pinch">("none");
  const origin = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const pinch = useRef({ span: 0, mid: { x: 0, y: 0 } });
  const lastTap = useRef(0);

  /**
   * Where the photo rests, and the stage it has to stay inside. Scaling happens around the frame's own centre, so the
   * translation is the only thing that moves that centre.
   */
  const measure = useCallback(() => {
    const box = surface.current?.getBoundingClientRect();
    const rect = frame.current?.getBoundingClientRect();
    const img = image.current;
    if (!box || !rect || !img) return null;
    return {
      box,
      centre: { x: rect.left + rect.width / 2 - x.get(), y: rect.top + rect.height / 2 - y.get() },
      width: img.offsetWidth,
      height: img.offsetHeight,
    };
  }, [x, y]);

  const apply = useCallback(
    (next: number, tx: number, ty: number) => {
      const value = clamp(next, 1, MAX_SCALE);
      const spot = measure();
      if (spot) {
        // Bigger than the stage, the photo may only pan within its own edges; smaller, it stays where it was laid out.
        const room = {
          x: Math.max(0, (spot.width * value - spot.box.width) / 2),
          y: Math.max(0, (spot.height * value - spot.box.height) / 2),
        };
        const drift = {
          x: spot.centre.x - (spot.box.left + spot.box.width / 2),
          y: spot.centre.y - (spot.box.top + spot.box.height / 2),
        };
        tx = clamp(tx, Math.min(0, -room.x - drift.x), Math.max(0, room.x - drift.x));
        ty = clamp(ty, Math.min(0, -room.y - drift.y), Math.max(0, room.y - drift.y));
      }
      scale.set(value);
      x.set(tx);
      y.set(ty);
      setLevel(Math.round(value * 10) / 10);
    },
    [measure, scale, x, y],
  );

  /** Zooms towards a point on screen, so whatever sits under the cursor or between the fingers stays put. */
  const zoomAround = useCallback(
    (next: number, anchor: Point) => {
      const spot = measure();
      if (!spot) return;
      const from = scale.get();
      const ratio = clamp(next, 1, MAX_SCALE) / from;
      const dx = anchor.x - spot.centre.x;
      const dy = anchor.y - spot.centre.y;
      apply(from * ratio, dx - ratio * (dx - x.get()), dy - ratio * (dy - y.get()));
    },
    [apply, measure, scale, x, y],
  );

  const reset = useCallback(() => {
    animate(x, 0, SPRING);
    animate(y, 0, SPRING);
    animate(scale, 1, SPRING);
    setLevel(1);
  }, [scale, x, y]);

  // A different photo comes up at its normal size on its own: the viewer keys this component by media id, so it remounts.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    // Refusing these keeps the browser from zooming the page around the photo; the photo takes the gesture instead.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
      zoomAround(scale.get() * step, { x: event.clientX, y: event.clientY });
    };
    let from = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      from = scale.get();
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const pinched = event as GestureEvent;
      zoomAround(from * pinched.scale, { x: pinched.clientX, y: pinched.clientY });
    };
    const onGestureEnd = (event: Event) => event.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart, { passive: false });
    el.addEventListener("gesturechange", onGestureChange, { passive: false });
    el.addEventListener("gestureend", onGestureEnd, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
  }, [scale, zoomAround]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    try {
      // A finger already lifted again refuses to be captured, and that must not cost us the rest of the gesture.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const [a, b] = [...pointers.current.values()];
    if (a && b) {
      gesture.current = "pinch";
      pinch.current = { span: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    } else if (a) {
      gesture.current = "tap";
      origin.current = { x: event.clientX, y: event.clientY, tx: x.get(), ty: y.get() };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.current === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const span = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const spot = measure();
      if (spot && pinch.current.span > 0) {
        const from = scale.get();
        const ratio = clamp(from * (span / pinch.current.span), 1, MAX_SCALE) / from;
        // Whatever the fingers held on to travels with them, so the photo follows the pinch as it grows.
        apply(
          from * ratio,
          mid.x - spot.centre.x - ratio * (pinch.current.mid.x - spot.centre.x - x.get()),
          mid.y - spot.centre.y - ratio * (pinch.current.mid.y - spot.centre.y - y.get()),
        );
      }
      pinch.current = { span, mid };
      return;
    }

    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    if (gesture.current === "tap" && Math.hypot(dx, dy) > TAP_SLOP) {
      gesture.current = scale.get() > ZOOMED_IN ? "pan" : Math.abs(dx) > Math.abs(dy) ? "swipe" : "none";
    }
    if (gesture.current === "pan") apply(scale.get(), origin.current.tx + dx, origin.current.ty + dy);
    else if (gesture.current === "swipe") x.set(dx * 0.55);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    const kind = gesture.current;

    if (kind === "pinch") {
      const [rest] = [...pointers.current.values()];
      pinch.current = { span: 0, mid: { x: 0, y: 0 } };
      // A finger still down carries on as a pan, so the photo does not jump when the other one lifts.
      gesture.current = rest ? "pan" : "none";
      if (rest) origin.current = { x: rest.x, y: rest.y, tx: x.get(), ty: y.get() };
      if (scale.get() <= ZOOMED_IN) reset();
      return;
    }

    gesture.current = "none";
    if (kind === "swipe") {
      const dx = event.clientX - origin.current.x;
      animate(x, 0, SPRING);
      if (Math.abs(dx) > SWIPE_MIN) onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (kind !== "tap") return;
    const now = Date.now();
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = isDouble ? 0 : now;
    if (!isDouble) return;
    // Zoomed in, a second tap is how you come back out; at its normal size it is still how you love the photo.
    if (scale.get() > ZOOMED_IN) reset();
    else onDoubleTap();
  }

  function onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (gesture.current === "swipe") animate(x, 0, SPRING);
    gesture.current = "none";
  }

  const zoomed = level > 1;

  return (
    <div
      ref={surface}
      className="relative flex h-full w-full touch-none items-center justify-center px-2 pb-28 pt-16 sm:px-14"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <motion.div ref={frame} style={{ x, y, scale }} className="flex h-full w-full items-center justify-center">
        <motion.img
          ref={image}
          layoutId={layoutId}
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            "max-h-full max-w-full select-none rounded-md object-contain shadow-2xl",
            zoomed ? "cursor-grab" : "cursor-zoom-in",
          )}
          style={{ aspectRatio, backgroundImage: poster ? `url(${poster})` : undefined, backgroundSize: "cover" }}
        />
      </motion.div>

      <AnimatePresence>
        {zoomed ? (
          <motion.button
            key="zoom"
            type="button"
            aria-label={t("zoomReset")}
            title={t("zoomReset")}
            onClick={reset}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: -8, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -8, x: "-50%" }}
            className="glass absolute left-1/2 top-16 z-20 rounded-full px-3 py-1 text-xs tabular-nums text-white"
          >
            {level}&times;
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
