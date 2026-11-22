import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const fieldClass = "h-12 rounded-lg bg-background/70 px-3.5 text-base shadow-none";

export function FormHeading({
  title,
  lead,
  icon,
  className,
}: {
  title: string;
  lead?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {icon ? <span className="mb-5 grid size-12 place-items-center rounded-lg border bg-background text-primary [&_svg]:size-6 [&_svg]:stroke-[1.5]">{icon}</span> : null}
      <h1 className="text-balance font-display text-[2.4rem] font-normal leading-[1.12] tracking-[-0.025em] [overflow-wrap:anywhere]">{title}</h1>
      {lead ? <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{lead}</p> : null}
    </div>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium leading-relaxed">{label}</Label>
      {children}
      {hint ? <span id={`${id}-hint`} className="text-sm leading-relaxed text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function FormMessage({ children, error = false, id }: { children: ReactNode; error?: boolean; id?: string }) {
  return (
    <p
      id={id}
      role={error ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed [overflow-wrap:anywhere]",
        error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-border bg-muted/60 text-foreground",
      )}
    >
      {children}
    </p>
  );
}
