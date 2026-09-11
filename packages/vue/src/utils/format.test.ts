import { describe, expect, it } from "vitest";

import { formatRelativeTime, type RelativeTimeT } from "./format";

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

  it("falls to the absolute-date path at >= 30d", () => {
    const d = ago(30 * DAY);
    // Do not pin a locale-specific rendering; assert the value comes
    // from the same Date's toLocaleDateString().
    expect(formatRelativeTime(d)).toBe(d.toLocaleDateString());
    expect(formatRelativeTime(d).length).toBeGreaterThan(0);
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

  it("keeps absolute dates away from the translator", () => {
    const { t, calls } = makeCaptureT();
    const d = ago(45 * DAY);
    expect(formatRelativeTime(d, t)).toBe(d.toLocaleDateString());
    expect(calls).toHaveLength(0);
  });
});
