"use client";

import { motion } from "motion/react";
import { ImageOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { thumbHashToDataURL } from "thumbhash";
import { cn } from "@/lib/utils";

export function thumbhashDataUrl(hash: string | null | undefined) {
  if (!hash) return undefined;
  try {
    const bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
    return thumbHashToDataURL(bytes);
  } catch {
    return undefined;
  }
}

type Props = {
  src?: string;
  thumbhash?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  layoutId?: string;
  eager?: boolean;
  fallback?: React.ReactNode;
};

/** Shows the blurred thumbhash instantly and fades the real image in once it loads. */
export function ThumbhashImage({ src, thumbhash, alt = "", className, imgClassName, style, layoutId, eager, fallback }: Props) {
  const placeholder = useMemo(() => thumbhashDataUrl(thumbhash), [thumbhash]);
  const [loaded, setLoaded] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const current = ref.current;
    const complete = Boolean(current?.complete);
    const succeeded = complete && Boolean(current?.naturalWidth);
    setLoaded(succeeded);
    // A cached/SSR image can fail before hydration attaches React's error handler.
    setFailedSrc(complete && !succeeded && src ? src : undefined);
  }, [src]);

  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", className)}
      style={{ ...style, ...(placeholder ? { backgroundImage: `url(${placeholder})`, backgroundSize: "cover", backgroundPosition: "center" } : null) }}
    >
      {src ? (
        <motion.img
          ref={ref}
          layoutId={layoutId}
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => {
            setLoaded(true);
            setFailedSrc(undefined);
          }}
          onError={() => {
            setLoaded(false);
            setFailedSrc(src);
          }}
          className={cn("h-full w-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      ) : null}
      {(!src || failedSrc === src) ? (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-muted p-3 text-muted-foreground">
          {fallback ?? <ImageOff className="size-6" strokeWidth={1.5} />}
        </span>
      ) : null}
    </span>
  );
}
