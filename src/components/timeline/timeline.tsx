import Link from "next/link";
import { cn } from "@/lib/utils";

export type TimelineMode = "years" | "months" | "days";

export function TimelineModes({ current, labels }: { current: TimelineMode; labels: Record<TimelineMode, string> }) {
  return (
    <div role="group" className="inline-flex rounded-xl border bg-card p-1">
      {(["years", "months", "days"] as const).map((mode) => (
        <Link
          key={mode}
          href={mode === "months" ? "/timeline" : `/timeline?g=${mode}`}
          aria-current={current === mode ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            current === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[mode]}
        </Link>
      ))}
    </div>
  );
}

export function YearRail({ anchors }: { anchors: { year: string; id: string }[] }) {
  if (anchors.length < 2) return null;
  return (
    <nav className="sticky top-24 hidden h-fit flex-col items-end gap-0.5 lg:flex" aria-label="Years">
      {anchors.map((anchor) => (
        <a
          key={anchor.year}
          href={`#${anchor.id}`}
          className="rounded-lg px-2 py-1 text-sm font-bold tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {anchor.year}
        </a>
      ))}
    </nav>
  );
}
