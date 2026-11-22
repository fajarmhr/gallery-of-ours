import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
  className,
  headingLevel = 2,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: React.ReactNode;
  className?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center rounded-xl border bg-card px-6 py-14 text-center sm:py-20", className)}>
      <span className="grid size-14 place-items-center rounded-lg bg-accent/60 text-primary">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <Heading className={cn("mt-5 text-balance font-display font-medium leading-tight tracking-tight", headingLevel === 1 ? "text-4xl sm:text-5xl" : "text-3xl")}>{title}</Heading>
      {text ? <p className="mt-3 max-w-[46ch] text-pretty text-base leading-relaxed text-muted-foreground">{text}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
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
    <header data-slot="page-header" className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b pb-7 sm:mb-10">
      <div className="min-w-0">
        {note ? <p className="mb-2 text-sm font-medium tracking-wide text-note">{note}</p> : null}
        <h1 className="font-display text-[2.6rem] font-normal leading-[1.08] tracking-[-0.035em] sm:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </header>
  );
}

export function PageSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section data-slot="page-section" className={cn("min-w-0", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-medium leading-tight tracking-tight">{title}</h2>
          {description ? <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
