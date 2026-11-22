import Link from "next/link";
import { cn } from "@/lib/utils";

export type TimelineMode = "years" | "months" | "days";

export function TimelineModes({ current, labels }: { current: TimelineMode; labels: Record<TimelineMode, string> }) {
  return (
    <div role="group" className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {(["years", "months", "days"] as const).map((mode) => (
        <Link
          key={mode}
          href={mode === "months" ? "/timeline" : `/timeline?g=${mode}`}
          aria-current={current === mode ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-colors duration-200",
            current === mode ? "bg-card text-primary" : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          )}
        >
          {labels[mode]}
        </Link>
      ))}
    </div>
  );
}

export function YearRail({ anchors, label = "Years" }: { anchors: { year: string; id: string }[]; label?: string }) {
  if (anchors.length < 2) return null;
  return (
    <nav className="sticky top-[calc(6rem+env(safe-area-inset-top))] hidden h-fit flex-col items-end gap-1 border-l pl-3 lg:flex" aria-label={label}>
      {anchors.map((anchor) => (
        <a
          key={anchor.year}
          href={`#${anchor.id}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {anchor.year}
        </a>
      ))}
    </nav>
  );
}
