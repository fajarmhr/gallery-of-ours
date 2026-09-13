"use client";

import { motion } from "motion/react";
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
};

/** Shows the blurred thumbhash instantly and fades the real image in once it loads. */
export function ThumbhashImage({ src, thumbhash, alt = "", className, imgClassName, style, layoutId, eager }: Props) {
  const placeholder = useMemo(() => thumbhashDataUrl(thumbhash), [thumbhash]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(Boolean(ref.current?.complete && ref.current.naturalWidth));
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
          onLoad={() => setLoaded(true)}
          className={cn("h-full w-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", imgClassName)}
        />
      ) : null}
    </span>
  );
}
