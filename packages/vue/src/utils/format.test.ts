import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatRelativeTime, formatTime, type RelativeTimeT } from "./format";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

interface CapturedCall {
  key: string;
  fallback: string;
  named?: Record<string, unknown>;
}

/** Fake translator: records every lookup and renders the {n} slot so
 *  injection can be asserted end-to-end. */
function makeCaptureT(): { t: RelativeTimeT; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const t: RelativeTimeT = (key, fallback, named) => {
    calls.push({ key, fallback, named });
    return fallback.replace("{n}", String(named?.n ?? ""));
  };
  return { t, calls };
}

describe("formatRelativeTime", () => {
  it("returns an empty string for missing input", () => {
    expect(formatRelativeTime("")).toBe("");
    expect(formatRelativeTime(0)).toBe("");
  });

  it("returns an empty string for unparseable input", () => {
    expect(formatRelativeTime("not-a-date")).toBe("");
    expect(formatRelativeTime(Number.NaN)).toBe("");
  });

  it("renders the compact English fallback per tier", () => {
    expect(formatRelativeTime(ago(59_000))).toBe("Just now");
    expect(formatRelativeTime(ago(MIN))).toBe("1m ago");
    expect(formatRelativeTime(ago(59 * MIN))).toBe("59m ago");
    expect(formatRelativeTime(ago(HOUR))).toBe("1h ago");
    expect(formatRelativeTime(ago(23 * HOUR))).toBe("23h ago");
    expect(formatRelativeTime(ago(DAY))).toBe("1d ago");
    expect(formatRelativeTime(ago(6 * DAY))).toBe("6d ago");
  });

  it("adds the weeks tier from 7d up to (excluding) 30d", () => {
    expect(formatRelativeTime(ago(7 * DAY))).toBe("1w ago");
    expect(formatRelativeTime(ago(13 * DAY))).toBe("1w ago");
    expect(formatRelativeTime(ago(14 * DAY))).toBe("2w ago");
    expect(formatRelativeTime(ago(29 * DAY))).toBe("4w ago");
  });

  it("falls to the absolute-date path at >= 30d, in the app locale", async () => {
    const d = ago(30 * DAY);
    // The absolute tier must follow the app-selected hikari locale (the
    // R2 sweep found the old assertion compared the BROWSER default,
    // which proves nothing about locale-following).
    const { setLocale } = await import("../i18n/context");
    await setLocale("zh-Hans");
    expect(formatRelativeTime(d)).toBe(d.toLocaleDateString("zh-Hans"));
    await setLocale("en");
    expect(formatRelativeTime(d)).toBe(d.toLocaleDateString("en"));
  });

  it("clamps future timestamps into the justNow tier", () => {
    expect(formatRelativeTime(ago(-5 * MIN))).toBe("Just now");
    expect(formatRelativeTime(ago(-2 * DAY))).toBe("Just now");
  });

  it("passes the documented keys with injected {n} to the translator", () => {
    const { t, calls } = makeCaptureT();

    expect(formatRelativeTime(ago(30_000), t)).toBe("Just now");
    expect(calls[0]).toEqual({
      key: "common.time.justNow",
      fallback: "Just now",
      named: undefined,
    });

    expect(formatRelativeTime(ago(5 * MIN), t)).toBe("5 min ago");
    expect(calls[1]).toEqual({
      key: "common.time.minutesAgo",
      fallback: "{n} min ago",
      named: { n: 5 },
    });

    expect(formatRelativeTime(ago(3 * HOUR), t)).toBe("3 h ago");
    expect(calls[2]).toEqual({
      key: "common.time.hoursAgo",
      fallback: "{n} h ago",
      named: { n: 3 },
    });

    expect(formatRelativeTime(ago(2 * DAY), t)).toBe("2 d ago");
    expect(calls[3]).toEqual({
      key: "common.time.daysAgo",
      fallback: "{n} d ago",
      named: { n: 2 },
    });

    expect(formatRelativeTime(ago(8 * DAY), t)).toBe("1 w ago");
    expect(calls[4]).toEqual({
      key: "common.time.weeksAgo",
      fallback: "{n} w ago",
      named: { n: 1 },
    });
  });

  it("keeps absolute dates away from the translator", async () => {
    const { t, calls } = makeCaptureT();
    const d = ago(45 * DAY);
    const { activeLocale } = await import("../i18n/context");
    expect(formatRelativeTime(d, t)).toBe(d.toLocaleDateString(activeLocale()));
    expect(calls).toHaveLength(0);
  });
});

// ── Locale awareness (2026-09-15) ────────────────────────────────────
// Every locale-sensitive formatter must follow the app-selected hikari
// locale (setLocale), not the browser default: a zh-Hans app on an en
// browser used to render dates as "9/13/2026" next to zh words.

describe("locale-aware date formatting", () => {
  it("formatDate composes the locale's full day label", async () => {
    const { setLocale } = await import("../i18n/context");
    const d = new Date(2026, 8, 13);
    await setLocale("zh-Hans");
    expect(formatDate(d, { month: "short", day: "numeric" })).toBe("9月13日");
    await setLocale("en");
    expect(formatDate(d, { month: "short", day: "numeric" })).toBe("Sep 13");
    // Whole-date default: no opts = the locale's own date format.
    expect(formatDate(d)).toContain("2026");
  });

  it("formatTime follows the locale's clock convention", async () => {
    const { setLocale } = await import("../i18n/context");
    const d = new Date(2026, 8, 13, 15, 24);
    await setLocale("en");
    expect(formatTime(d)).toMatch(/3:24/);
    await setLocale("zh-Hans");
    expect(formatTime(d)).toMatch(/15:24/);
  });

  it("formatDateTime renders through the app locale", async () => {
    const { setLocale } = await import("../i18n/context");
    await setLocale("ja");
    const out = formatDateTime(new Date(2026, 8, 13, 15, 24));
    expect(out).toMatch(/2026/);
    // ja month rendering carries the 月 particle from the ja locale data.
    expect(out).toMatch(/9月13日|9\/13/);
    await setLocale("en");
  });

  it("formatDate/formatTime return empty for missing or invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("nope")).toBe("");
    expect(formatTime(0)).toBe("");
    expect(formatTime("junk")).toBe("");
  });
});
