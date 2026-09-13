import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Brand({ className, since }: { className?: string; since?: string }) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="font-display text-lg font-extrabold tracking-tight">Gallery of Ours</span>
      {since ? <span className="mt-0.5 origin-left -rotate-2 font-hand text-lg text-note">{since}</span> : null}
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
