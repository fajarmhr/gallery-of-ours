"use client";

import { LoaderCircle, Pencil, Send, Sparkles, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
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
  loadError = false,
  onChanged,
  onClose,
}: {
  item: MediaCard;
  social: MediaSocial | null;
  loadError?: boolean;
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
  const [saving, setSaving] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(item.caption ?? "");
  /** The reaction just added, whose emoji floats up once. */
  const [popped, setPopped] = useState<{ kind: string; key: number } | null>(null);

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));
  const aiText = locale === "id" ? item.aiCaption?.id : item.aiCaption?.en;

  async function react(kind: string) {
    if (!social || reacting) return;
    setReacting(true);
    if (!social?.reactions.find((reaction) => reaction.kind === kind)?.mine) {
      setPopped((previous) => ({ kind, key: (previous?.key ?? 0) + 1 }));
    }
    try {
      const result = await toggleReaction(item.id, kind);
      if (!result.ok) return fail(result.error);
      onChanged();
    } catch {
      fail("network");
    } finally {
      setReacting(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim() || sending || !social) return;
    setSending(true);
    try {
      const result = await addComment(item.id, comment);
      if (!result.ok) return fail(result.error);
      setComment("");
      onChanged();
    } catch {
      fail("network");
    } finally {
      setSending(false);
    }
  }

  async function saveCaption() {
    if (saving) return;
    setSaving(true);
    try {
      const result = await updateCaption(item.id, caption);
      if (!result.ok) return fail(result.error);
      toast.success(t("captionSaved"));
      setEditing(false);
      router.refresh();
    } catch {
      fail("network");
    } finally {
      setSaving(false);
    }
  }

  async function removeComment(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      const result = await deleteComment(id);
      if (!result.ok) return fail(result.error);
      onChanged();
    } catch {
      fail("network");
    } finally {
      setDeleting(null);
    }
  }

  const details = [
    [t("taken"), item.takenAt ? format.dateTime(new Date(item.takenAt), { dateStyle: "long", timeStyle: "short" }) : t("undated")],
    [t("place"), item.placeName],
    [t("dimensions"), `${item.width} × ${item.height}`],
    [t("size"), item.sizeBytes ? formatBytes(item.sizeBytes) : null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-card px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))] lg:pt-[max(.5rem,env(safe-area-inset-top))]">
        <p className="font-display text-lg font-bold">{t("info")}</p>
        <button type="button" onClick={onClose} aria-label={tc("close")} className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-foreground/5">
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-w-0 flex-col gap-5 px-[max(1rem,env(safe-area-inset-left))] py-4 pr-[max(1rem,env(safe-area-inset-right))]">
        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm">
            <p className="flex-1">{te("network")}</p>
            <Button variant="outline" onClick={onChanged}>{tc("retry")}</Button>
          </div>
        ) : !social ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{tc("loading")}</p>
        ) : null}
        <section>
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} aria-label={t("caption")} placeholder={t("captionPlaceholder")} className="text-base" maxLength={500} rows={3} disabled={saving} autoFocus />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={saveCaption} disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : null}{tc("save")}</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className={cn("min-w-0 flex-1 break-words font-display text-xl font-bold leading-snug", !item.caption && "text-muted-foreground")}>
                {item.caption ?? (social?.canEdit ? t("addCaption") : "")}
              </p>
              {social?.canEdit ? (
                <button type="button" onClick={() => setEditing(true)} aria-label={t("addCaption")} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5">
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
              <dd className="min-w-0 break-words font-medium">{value}</dd>
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
                  disabled={reacting}
                  className={cn(
                    "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-sm font-semibold transition-colors disabled:opacity-60",
                    reaction.mine ? "border-primary bg-accent text-accent-foreground" : "bg-background hover:bg-foreground/5",
                  )}
                >
                  <span aria-hidden="true">{REACTION_EMOJI[reaction.kind]}</span>
                  {reaction.count > 0 ? <span className="tabular-nums">{reaction.count}</span> : null}
                  {popped?.kind === reaction.kind ? (
                    <motion.span
                      key={popped.key}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 text-center text-lg"
                      initial={{ y: 0, opacity: 1, scale: 0.8 }}
                      animate={{ y: -38, opacity: 0, scale: 1.6 }}
                      transition={{ duration: 0.75, ease: "easeOut" }}
                    >
                      {REACTION_EMOJI[reaction.kind]}
                    </motion.span>
                  ) : null}
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
                    <span className="text-muted-foreground">{format.relativeTime(new Date(c.createdAt), new Date(social.now))}</span>
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                </div>
                {c.canDelete ? (
                  <button
                    type="button"
                    aria-label={t("deleteComment")}
                    onClick={() => removeComment(c.id)}
                    disabled={deleting !== null}
                    className="grid size-11 shrink-0 place-items-center self-center rounded-lg text-muted-foreground transition-opacity hover:text-destructive disabled:opacity-50 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    {deleting === c.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-auto flex shrink-0 gap-2 border-t bg-card px-[max(.75rem,env(safe-area-inset-left))] pb-[max(.75rem,env(safe-area-inset-bottom))] pr-[max(.75rem,env(safe-area-inset-right))] pt-3">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("writeComment")}
          aria-label={t("writeComment")}
          enterKeyHint="send"
          disabled={sending || !social}
          maxLength={1000}
          className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
        />
        <Button type="submit" size="icon-lg" disabled={sending || !comment.trim() || !social} aria-label={t("send")} className="size-11 shrink-0 rounded-lg">
          {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}
