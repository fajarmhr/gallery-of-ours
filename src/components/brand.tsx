import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Brand({ className, since }: { className?: string; since?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg aria-hidden="true" viewBox="0 0 36 40" className="h-9 w-8 shrink-0 text-primary" fill="none">
        <rect x="4" y="5" width="25" height="31" rx="2" transform="rotate(-7 4 5)" stroke="currentColor" strokeWidth="1.5" />
        <rect x="9" y="3" width="25" height="31" rx="2" fill="var(--background)" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 23V9h15v14H14Z" fill="currentColor" opacity=".12" />
        <path d="M18 16c-3-3 1-5 3-2 2-3 6-1 3 2l-3 3-3-3Z" fill="currentColor" />
        <path d="M18 28h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="inline-flex flex-col">
        <span className="font-display text-[1.35rem] font-medium leading-none tracking-[-0.035em] sm:text-[1.45rem]">Gallery of Ours</span>
        {since ? <span className="mt-1.5 text-xs leading-none tracking-wide text-muted-foreground">{since}</span> : null}
      </span>
    </span>
  );
}

export function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-9", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
