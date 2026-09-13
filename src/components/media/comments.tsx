"use client";

import { Pencil, Send, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { updateCaption } from "@/actions/media";
import { addComment, deleteComment, toggleReaction, type MediaSocial } from "@/actions/social";
import { UserAvatar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import type { MediaCard } from "@/lib/queries";
import { cn } from "@/lib/utils";

const REACTION_EMOJI: Record<string, string> = { heart: "❤️", laugh: "😂", wow: "😮", touched: "🥹", clap: "👏" };

export function SocialPanel({
  item,
  social,
  onChanged,
  onClose,
}: {
  item: MediaCard;
  social: MediaSocial | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("media");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();

  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(item.caption ?? "");

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));
  const aiText = locale === "id" ? item.aiCaption?.id : item.aiCaption?.en;

  async function react(kind: string) {
    const result = await toggleReaction(item.id, kind);
    if (!result.ok) return fail(result.error);
    onChanged();
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    const result = await addComment(item.id, comment);
    setSending(false);
    if (!result.ok) return fail(result.error);
    setComment("");
    onChanged();
  }

  async function saveCaption() {
    const result = await updateCaption(item.id, caption);
    if (!result.ok) return fail(result.error);
    toast.success(t("captionSaved"));
    setEditing(false);
    router.refresh();
  }

  const details = [
    [t("taken"), item.takenAt ? format.dateTime(new Date(item.takenAt), { dateStyle: "long", timeStyle: "short" }) : t("undated")],
    [t("place"), item.placeName],
    [t("dimensions"), `${item.width} × ${item.height}`],
    [t("size"), item.sizeBytes ? formatBytes(item.sizeBytes) : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <p className="font-display text-lg font-bold">{t("info")}</p>
        <button type="button" onClick={onClose} aria-label={tc("close")} className="grid size-9 place-items-center rounded-lg hover:bg-foreground/5">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <section>
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("captionPlaceholder")} maxLength={500} rows={3} autoFocus />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={saveCaption}>{tc("save")}</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className={cn("flex-1 font-display text-xl font-bold leading-snug", !item.caption && "text-muted-foreground")}>
                {item.caption ?? (social?.canEdit ? t("addCaption") : "")}
              </p>
              {social?.canEdit ? (
                <button type="button" onClick={() => setEditing(true)} aria-label={t("addCaption")} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5">
                  <Pencil className="size-4" />
                </button>
              ) : null}
            </div>
          )}
          {aiText ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-foreground" />
              <span>
                <span className="font-semibold text-accent-foreground">{t("aiCaption")}:</span> {aiText}
              </span>
            </p>
          ) : null}
        </section>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-wrap gap-1.5">
          {(social?.reactions ?? []).map((reaction) => (
            <Tooltip key={reaction.kind}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => react(reaction.kind)}
                  aria-pressed={reaction.mine}
                  aria-label={t(`reactions.${reaction.kind}`)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-semibold transition-colors",
                    reaction.mine ? "border-primary bg-accent text-accent-foreground" : "bg-background hover:bg-foreground/5",
                  )}
                >
                  <span aria-hidden="true">{REACTION_EMOJI[reaction.kind]}</span>
                  {reaction.count > 0 ? <span className="tabular-nums">{reaction.count}</span> : null}
                </button>
              </TooltipTrigger>
              <TooltipContent>{reaction.names.length ? reaction.names.join(", ") : t(`reactions.${reaction.kind}`)}</TooltipContent>
            </Tooltip>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-display text-base font-bold">{t("comments")}</h3>
          {social && social.comments.length === 0 ? <p className="text-sm text-muted-foreground">{t("noComments")}</p> : null}
          <ul className="flex flex-col gap-3">
            {social?.comments.map((c) => (
              <li key={c.id} className="group flex gap-2.5">
                <UserAvatar name={c.name} image={c.image} className="size-8" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                  <p className="text-xs">
                    <span className="font-bold">{c.name}</span>{" "}
                    <span className="text-muted-foreground">{format.relativeTime(new Date(c.createdAt))}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                </div>
                {c.canDelete ? (
                  <button
                    type="button"
                    aria-label={t("deleteComment")}
                    onClick={async () => {
                      const result = await deleteComment(c.id);
                      if (!result.ok) return fail(result.error);
                      onChanged();
                    }}
                    className="grid size-8 shrink-0 place-items-center self-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-auto flex gap-2 border-t bg-card p-3">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("writeComment")}
          maxLength={1000}
          className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />
        <Button type="submit" size="icon-lg" disabled={sending || !comment.trim()} aria-label={t("send")} className="size-10 rounded-xl">
          <Send />
        </Button>
      </form>
    </div>
  );
}
