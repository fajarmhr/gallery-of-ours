import { ImageIcon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const SPRING = "transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]";

const PILE_POSES = [
  "-rotate-[7deg] group-hover:-translate-x-[30%] group-hover:-rotate-[13deg] group-focus-visible:-translate-x-[30%] group-focus-visible:-rotate-[13deg]",
  "rotate-[5deg] group-hover:translate-x-[30%] group-hover:rotate-[11deg] group-focus-visible:translate-x-[30%] group-focus-visible:rotate-[11deg]",
  "-rotate-[1.5deg] group-hover:-translate-y-[7%] group-hover:rotate-0 group-focus-visible:-translate-y-[7%] group-focus-visible:rotate-0",
];

/** Three stacked prints that fan out when their `group` parent is hovered or focused. Cover goes on top. */
export function AlbumPile({ covers, locked, className }: { covers: string[]; locked?: boolean; className?: string }) {
  const prints = [covers[2] ?? covers[1] ?? covers[0], covers[1] ?? covers[0], covers[0]];
  return (
    <span className={cn("relative block aspect-[1/1.12]", className)}>
      {prints.map((src, i) => (
        <span key={i} className={cn("polaroid absolute inset-0 p-[5%] pb-[22%]", SPRING, PILE_POSES[i])}>
          {locked ? (
            <span className="grid h-full w-full place-items-center bg-blank text-[#a08e7a]">
              <Lock className="size-6" />
            </span>
          ) : src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center bg-blank text-[#a08e7a]">
              <ImageIcon className="size-6" />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Empty prints with locks: the visitor page shows no family photos at all. */
export function BlankPolaroids({ captions, className }: { captions: [string, string, string]; className?: string }) {
  const layout = [
    "left-[4%] top-[6%] -rotate-[9deg]",
    "left-[40%] top-0 rotate-[6deg]",
    "left-[20%] top-[34%] -rotate-[2deg]",
  ];
  return (
    <div className={cn("relative mx-auto w-full max-w-[460px]", className)} aria-hidden="true">
      {captions.map((caption, i) => (
        <div key={caption} className={cn("polaroid absolute flex w-[42%] flex-col p-[3%] pb-0", layout[i])}>
          <div className="grid aspect-[4/4.2] place-items-center bg-blank text-[#a08e7a]">
            <Lock className="size-7" />
          </div>
          <p className="py-[7%] text-center font-hand text-lg font-bold text-[#5e4a3a] sm:text-xl">{caption}</p>
        </div>
      ))}
    </div>
  );
}
