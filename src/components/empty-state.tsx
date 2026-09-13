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
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-7" />
      </span>
      <h2 className="mt-4 text-balance font-display text-2xl font-bold tracking-tight">{title}</h2>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {note ? <p className="inline-block origin-left -rotate-2 font-hand text-2xl text-note">{note}</p> : null}
        <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
