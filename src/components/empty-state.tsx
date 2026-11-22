import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border bg-card px-6 py-16 text-center sm:py-20", className)}>
      <span className="grid size-16 -rotate-6 place-items-center rounded-lg border bg-background text-primary">
        <Icon className="size-7 rotate-6" strokeWidth={1.5} />
      </span>
      <h2 className="mt-6 text-balance font-display text-3xl font-medium tracking-tight">{title}</h2>
      {text ? <p className="mt-2 max-w-[46ch] text-pretty text-muted-foreground">{text}</p> : null}
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b pb-7 sm:mb-10">
      <div className="min-w-0">
        {note ? <p className="mb-2 text-sm font-medium tracking-wide text-note">{note}</p> : null}
        <h1 className="font-display text-[2.6rem] font-normal leading-[1.08] tracking-[-0.035em] sm:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
