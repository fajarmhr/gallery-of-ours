"use client";

import { Check, ChevronDown, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getLocation, setLocation, type AlbumUsage, type LocationTarget, type PlaceSummary } from "@/actions/location";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PlaceSearchResult, ReverseAddress } from "@/lib/geocode";
import {
  emptyPick,
  loadDistricts,
  loadProvinces,
  loadRegencies,
  loadVillages,
  pickFromAddress,
  pickFromCode,
  type RegionOption,
  type RegionPick,
} from "@/lib/regions";
import { cn } from "@/lib/utils";

type Level = keyof RegionPick;
type Spot = { lat: number; lng: number; name: string; country: string | null; inIndonesia: boolean };

const LEVELS: Level[] = ["province", "regency", "district", "village"];
const noOptions = (): Record<Level, RegionOption[]> => ({ province: [], regency: [], district: [], village: [] });

/** The list one level below `level`, e.g. the regencies of a province. */
const loadChildren = (level: Level, code: string): Promise<RegionOption[]> =>
  level === "province" ? loadRegencies(code) : level === "regency" ? loadDistricts(code) : level === "district" ? loadVillages(code) : Promise.resolve([]);

/** Sets where an album or one photo happened: search for a named place, or choose province, city, district and village. */
export function LocationDialog({
  target,
  open,
  onOpenChange,
  onSaved,
}: {
  target: LocationTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("location");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">{t("title")}</DialogTitle>
          <DialogDescription>{target.kind === "album" ? t("albumHint") : t("mediaHint")}</DialogDescription>
        </DialogHeader>
        {/* Radix unmounts the content when the dialog closes, so every opening starts with a fresh form. */}
        <LocationForm
          target={target}
          onDone={() => {
            onOpenChange(false);
            onSaved?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function LocationForm({ target, onDone }: { target: LocationTarget; onDone: () => void }) {
  const t = useTranslations("location");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [saved, setSaved] = useState<{ own: PlaceSummary | null; album: PlaceSummary | null; usage: AlbumUsage | null } | null>(null);
  const [pick, setPick] = useState<RegionPick>(emptyPick);
  const [options, setOptions] = useState(noOptions);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [replaceOwn, setReplaceOwn] = useState(false);
  const [busy, setBusy] = useState<"search" | "resolve" | "save" | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchRun = useRef(0);

  const fail = (code: string) => toast.error(te.has(code) ? te(code) : te("unknown"));

  /** Shows a pick with the dropdown lists it needs already loaded. */
  async function showPick(next: RegionPick) {
    const [regency, district, village] = await Promise.all([
      next.province ? loadRegencies(next.province.code) : Promise.resolve([]),
      next.regency ? loadDistricts(next.regency.code) : Promise.resolve([]),
      next.district ? loadVillages(next.district.code) : Promise.resolve([]),
    ]);
    setOptions((previous) => ({ ...previous, regency, district, village }));
    setPick(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [provinces, current] = await Promise.all([loadProvinces(), getLocation(target)]);
        if (cancelled) return;
        setOptions((previous) => ({ ...previous, province: provinces }));
        if (!current.ok) {
          fail(current.error);
          return;
        }
        setSaved(current.data);
        const code = current.data.own?.regionCode;
        if (code) {
          const restored = await pickFromCode(code);
          if (!cancelled) await showPick(restored);
        }
      } catch {
        if (!cancelled) fail("network");
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(searchTimer.current);
    };
    // Runs once: the form mounts fresh every time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(searchTimer.current);
    const run = ++searchRun.current;
    const text = value.trim();
    if (text.length < 3) {
      setResults(null);
      setBusy((current) => (current === "search" ? null : current));
      return;
    }
    setBusy("search");
    searchTimer.current = setTimeout(async () => {
      let found: PlaceSearchResult[] = [];
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(text)}`);
        if (response.ok) found = (await response.json()) as PlaceSearchResult[];
      } catch {
        // Offline or the search service is down; the dropdowns still work.
      }
      if (run !== searchRun.current) return;
      setResults(found);
      setBusy(null);
    }, 400);
  }

  async function chooseResult(result: PlaceSearchResult) {
    searchRun.current += 1;
    clearTimeout(searchTimer.current);
    setResults(null);
    setQuery(result.name);
    const inIndonesia = result.countryCode === "ID";
    setSpot({ lat: result.lat, lng: result.lng, name: result.name, country: result.country, inIndonesia });
    if (!inIndonesia) {
      setPick(emptyPick());
      setBusy(null);
      return;
    }
    setBusy("resolve");
    try {
      const response = await fetch(`/api/places/reverse?lat=${result.lat}&lng=${result.lng}`);
      const found = response.ok ? ((await response.json()) as ReverseAddress | null) : null;
      if (found) await showPick(await pickFromAddress(found.address));
    } catch {
      // The spot stays chosen; its area can still be picked by hand.
    }
    setBusy(null);
  }

  async function choose(level: Level, option: RegionOption | null) {
    const index = LEVELS.indexOf(level);
    const next: RegionPick = { ...pick, [level]: option };
    for (const deeper of LEVELS.slice(index + 1)) next[deeper] = null;
    // A searched spot survives small corrections, but not a different province or city.
    if (index <= 1 && spot) {
      setSpot(null);
      setQuery("");
    }
    setPick(next);
    const child = LEVELS[index + 1];
    if (!child) return;
    const list = option ? await loadChildren(level, option.code).catch(() => []) : [];
    setOptions((previous) => {
      const updated = { ...previous, [child]: list };
      for (const deeper of LEVELS.slice(index + 2)) updated[deeper] = [];
      return updated;
    });
  }

  const deepest = pick.village ?? pick.district ?? pick.regency ?? pick.province;
  const canSave = spot ? true : Boolean(pick.province && pick.regency);
  const usage = saved?.usage ?? null;
  const withOwnLocation = usage ? usage.total - usage.inherited : 0;

  async function save() {
    setBusy("save");
    const result = await setLocation(
      target,
      {
        regionCode: deepest?.code ?? null,
        province: pick.province?.name ?? null,
        regency: pick.regency?.name ?? null,
        district: pick.district?.name ?? null,
        village: pick.village?.name ?? null,
        point: spot ? { lat: spot.lat, lng: spot.lng, name: spot.name, country: spot.country } : null,
      },
      { replaceOwn },
    );
    setBusy(null);
    if (!result.ok) return fail(result.error);
    toast.success(t("saved"));
    onDone();
  }

  async function remove() {
    setBusy("save");
    const result = await setLocation(target, null);
    setBusy(null);
    if (!result.ok) return fail(result.error);
    toast.success(t("removed"));
    onDone();
  }

  const own = saved?.own ?? null;
  const fallback = own ? null : (saved?.album ?? null);

  return (
    <>
      {own || fallback ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className={cn("block", own ? "font-semibold" : "text-muted-foreground")}>
              {own ? t("now", { name: own.name }) : t("usesAlbum", { name: fallback!.name })}
            </span>
            {(own ?? fallback)!.detail ? <span className="block text-xs text-muted-foreground">{(own ?? fallback)!.detail}</span> : null}
          </span>
        </p>
      ) : null}
      {usage && usage.total > 0 ? (
        <p className="-mt-2 px-1 text-xs text-muted-foreground">{t("albumUsage", { inherited: usage.inherited, total: usage.total })}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="location-search" className="text-sm font-semibold">
          {t("search")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="location-search"
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 rounded-xl pl-9 pr-9"
          />
          {busy === "search" || busy === "resolve" ? (
            <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {results ? (
          results.length ? (
            <ul className="max-h-56 overflow-y-auto overscroll-contain rounded-xl border bg-card p-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => chooseResult(result)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{result.name}</span>
                      {result.detail ? <span className="block truncate text-xs text-muted-foreground">{result.detail}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">{t("noResults")}</p>
          )
        ) : null}

        {spot ? (
          <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{spot.name}</span>
              <span className="block truncate text-xs opacity-80">
                {spot.inIndonesia ? t("exactSpot") : t("outsideIndonesia", { country: spot.country ?? "" })}
              </span>
            </span>
            <button
              type="button"
              aria-label={t("clearSpot")}
              onClick={() => {
                setSpot(null);
                setQuery("");
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-foreground/10"
            >
              <X className="size-4" />
            </button>
          </p>
        ) : null}
      </div>

      {!spot || spot.inIndonesia ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-semibold">{spot ? t("checkArea") : t("orChoose")}</span>
            <span className="text-xs text-muted-foreground">{t("indonesia")}</span>
          </div>
          {LEVELS.map((level, index) => (
            <RegionSelect
              key={level}
              label={t(level)}
              optional={index >= 2}
              options={options[level]}
              value={pick[level]}
              disabled={index > 0 && !pick[LEVELS[index - 1]!]}
              onChange={(option) => choose(level, option)}
            />
          ))}
        </div>
      ) : null}

      {withOwnLocation > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border px-3 py-2.5">
          <Checkbox id="location-replace-own" checked={replaceOwn} onCheckedChange={(checked) => setReplaceOwn(checked === true)} className="mt-0.5" />
          <label htmlFor="location-replace-own" className="text-sm leading-snug">
            {t("replaceOwn", { count: withOwnLocation })}
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("replaceOwnHint")}</span>
          </label>
        </div>
      ) : null}

      <DialogFooter>
        {own ? (
          <Button variant="ghost" onClick={remove} disabled={busy === "save"} className="text-destructive hover:text-destructive sm:mr-auto">
            {t("remove")}
          </Button>
        ) : null}
        <Button onClick={save} disabled={!canSave || busy === "save" || busy === "resolve"} className="min-w-24">
          {busy === "save" ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </>
  );
}

function RegionSelect({
  label,
  optional,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  optional: boolean;
  options: RegionOption[];
  value: RegionOption | null;
  disabled: boolean;
  onChange: (option: RegionOption | null) => void;
}) {
  const t = useTranslations("location");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return text ? options.filter((option) => option.name.toLowerCase().includes(text)) : options;
  }, [filter, options]);

  const close = () => {
    setOpen(false);
    setFilter("");
  };
  const select = (option: RegionOption | null) => {
    onChange(option);
    close();
  };

  return (
    <div className={cn("rounded-xl border bg-background", disabled && "opacity-50")}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="w-24 shrink-0 text-xs font-bold leading-tight text-muted-foreground sm:w-28">
          {label}
          {optional ? <span className="block font-normal">{tc("optional")}</span> : null}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-sm", value ? "font-semibold" : "text-muted-foreground")}>{value?.name ?? t("choose")}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="border-t p-2">
          {options.length > 8 ? (
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("filter")} aria-label={t("filter")} className="mb-2 h-9 rounded-lg" />
          ) : null}
          <ul className="max-h-56 overflow-y-auto overscroll-contain">
            {optional && value ? (
              <li>
                <button type="button" onClick={() => select(null)} className="w-full rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted">
                  {t("clearLevel")}
                </button>
              </li>
            ) : null}
            {shown.map((option) => (
              <li key={option.code}>
                <button
                  type="button"
                  onClick={() => select(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                    option.code === value?.code && "font-semibold",
                  )}
                >
                  {option.name}
                  {option.code === value?.code ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </button>
              </li>
            ))}
            {shown.length === 0 ? <li className="px-2 py-2 text-sm text-muted-foreground">{options.length ? t("noMatch") : tc("loading")}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
