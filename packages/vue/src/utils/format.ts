/**
 * Canonical display-format helpers for the chat kit.
 * (Upstreamed from shittim-chest's plana-legacy layer.)
 *
 * Consolidates the hand-rolled copies previously scattered across
 * arona (formatDate/formatUptime/formatNumber) and shittim-chest
 * (formatTokenCount/formatMediaTime).
 *
 * Every locale-sensitive formatter resolves its locale through the
 * hikari i18n state (activeLocale()), NOT the browser default: the app
 * selects its language explicitly (setLocale on switch), and dates that
 * follow the browser while every word around them follows the app read
 * as mixed-language output (2026-09-15 user report: "9月 13" headings
 * under a zh-Hans app on an en browser). */
import { activeLocale } from "../i18n/context";

/** "1234" -> "1.2k", "2500000" -> "2.5M". */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** "1234" -> "1.2k". */
export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** "512" -> "512B", "1536" -> "1.5KB", "2621440" -> "2.5MB", "3221225472" -> "3.0GB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  if (bytes < 1024) return `${Math.floor(bytes)}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/** USD amount -> "$0.10" / "$1.5" / "$120". Negative/NaN clamp to 0. */
export function formatPriceUsd(n: number, currency = "$"): string {
  if (!Number.isFinite(n) || n < 0) n = 0;
  if (n >= 100) return `${currency}${Math.round(n)}`;
  if (n >= 1) return `${currency}${n.toFixed(1)}`;
  return `${currency}${n.toFixed(2)}`;
}

/** Timestamp -> "Just now" / "5m ago" / "3h ago" / "2d ago" / "2w ago" /
 *  locale date. */
export type RelativeTimeT = (
  key: string,
  fallback: string,
  named?: Record<string, unknown>,
) => string;

/** Relative-time formatting ("just now / {n} min ago / …").
 *  Pass an optional translator for localized variants; defaults to
 *  compact English text. Tiers: <1min justNow, <60min minutes,
 *  <24h hours, <7d days, <30d weeks, otherwise an absolute
 *  locale-rendered date (the app-selected hikari locale, like
 *  formatDateTime).
 *  The translator owns {n} interpolation — hikari's own useI18n().t
 *  does NOT interpolate named params, so wrap it (the canonical key
 *  set lives in the per-locale i18n time bundles). */
export function formatRelativeTime(
  input: string | number | Date,
  t?: RelativeTimeT,
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  // Clamp future timestamps to "just now" — no negative weeks/days.
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return t?.("common.time.justNow", "Just now") ?? "Just now";
  if (mins < 60) return t?.("common.time.minutesAgo", "{n} min ago", { n: mins }) ?? `${mins}m ago`;
  if (hours < 24) return t?.("common.time.hoursAgo", "{n} h ago", { n: hours }) ?? `${hours}h ago`;
  if (days < 7) return t?.("common.time.daysAgo", "{n} d ago", { n: days }) ?? `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return (
      t?.("common.time.weeksAgo", "{n} w ago", { n: weeks }) ?? `${weeks}w ago`
    );
  }
  return d.toLocaleDateString(activeLocale());
}

// Media timestamps ("m:ss") already live on the media-player kit — one
// definition, re-exported so `../utils/format` is the single import site.
export { formatMediaTime } from "../components/HkMediaControlBar";

/** Absolute timestamp formatting with a shared locale-aware renderer.
 *  Follows the app-selected hikari locale (see activeLocale). */
export function formatDateTime(
  input: string | number | Date,
  opts?: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" | "medium" },
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(activeLocale(), {
    dateStyle: opts?.dateStyle ?? "medium",
    timeStyle: opts?.timeStyle ?? "short",
  });
}

/** Date-only rendering (no time), following the app-selected hikari
 *  locale. `opts` is the raw Intl.DateTimeFormatOptions passthrough —
 *  omit it for the locale's whole-date default, or scope to a slice
 *  (e.g. { month: "short", day: "numeric" } for day-group headings). */
export function formatDate(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(activeLocale(), opts);
}

/** Time-only rendering (no date), following the app-selected hikari
 *  locale. `opts` is the raw Intl.DateTimeFormatOptions passthrough —
 *  omit it for the locale's default (en "3:24 PM", zh "15:24"). */
export function formatTime(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(activeLocale(), opts);
}

/** Milliseconds for latency/duration displays: sub-second keeps one
 *  decimal, >=1s switches to whole seconds (and beyond to minutes).
 *  Thousands-grouped for the rare large value. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "-";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms * 10) / 10} ms`;
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s * 10) / 10} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m}m ${rs}s`;
}
