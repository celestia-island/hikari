import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wallpaper layer is a MODULE SINGLETON, and its idempotence is a
 * contract — not an implementation detail.
 *
 * Two layouts (chest mounts the backdrop in its chat layout AND its admin
 * layout) share ONE wallpaper state: `useWallpaper()` reads module-level
 * refs, so both surfaces render the same wallpaper and a switch in one is a
 * switch in both. The boot call `initWallpaper()` may therefore run more
 * than once (a defensive re-init, a hot reload, a host that boots the theme
 * twice) and each extra call must REPLACE, never STACK:
 *
 *   - a stacked interval would poll the solar clock N times per minute;
 *   - a stacked follow watcher would run the theme→wallpaper rebind N times
 *     per theme switch, and its `flush: "sync"` clobber-protection depends
 *     on there being exactly one.
 *
 * `watch()` is wrapped here (the module's own `watch` import) because a
 * leaked watcher is otherwise invisible: its effects are idempotent, so
 * behaviour-only tests cannot see it.
 *
 * The clock source is pinned too: the wallpaper period rides
 * `scheduleInterval` (visibility-aware intervalBus — it pauses while hidden
 * and catches up on return). It must NOT go back to the rAF animationBus,
 * whose loop stops entirely in a background tab and parks under reduced
 * motion, so the period could lag a full cadence behind the theme after a
 * day/night flip while the page was hidden.
 */

const watchTrackers = vi.hoisted(() => [] as Array<{ stopped: boolean }>);
const geoMock = vi.hoisted(() => vi.fn());

vi.mock("vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue")>();
  const watch = ((...args: unknown[]) => {
    const stop = (actual.watch as (...a: unknown[]) => () => void)(...args);
    const tracker = { stopped: false };
    watchTrackers.push(tracker);
    return () => {
      tracker.stopped = true;
      stop();
    };
  }) as typeof actual.watch;
  return { ...actual, watch };
});

// The geolocation cascade is a network capability, not this contract's
// subject; stubbed so init()'s async half never reaches fetch.
vi.mock("./useSolarTime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useSolarTime")>();
  return { ...actual, getGeolocation: () => geoMock() };
});

import { readHkRuntime } from "../runtime/registry";

import { destroyWallpaper, initWallpaper } from "./useWallpaper";

const themeDir = resolve(dirname(fileURLToPath(import.meta.url)));

/** Live slots on the interval bus. `-1` = the bus has never scheduled
 *  anything, so it has not reported itself yet (the registry entry is
 *  created lazily on first schedule). */
function intervalSlots(): number {
  const report = readHkRuntime("intervalBus");
  return typeof report?.slots === "number" ? report.slots : -1;
}

beforeEach(() => {
  watchTrackers.length = 0;
  geoMock.mockReset();
  geoMock.mockResolvedValue({ lat: 0, lng: 0 });
  destroyWallpaper();
});

afterEach(() => {
  destroyWallpaper();
});

describe("initWallpaper idempotence", () => {
  it("is reading the real interval bus (positive control)", () => {
    // Before any schedule there is genuinely no runtime entry — the
    // accessor's -1 is the control that a slot count of 1 below is a real
    // reading rather than a constant.
    expect(intervalSlots()).toBe(-1);
    initWallpaper();
    expect(intervalSlots(), "intervalBus reports a live slot count").toBe(1);
  });

  it("replaces the solar clock instead of stacking one interval per call", () => {
    initWallpaper();
    const one = intervalSlots();
    initWallpaper();
    initWallpaper();
    expect(intervalSlots(), "three init calls, one clock").toBe(one);
  });

  it("replaces the follow watcher instead of stacking one per call", () => {
    const before = watchTrackers.length;
    initWallpaper();
    initWallpaper();

    const created = watchTrackers.slice(before);
    expect(created, "one watcher per init call").toHaveLength(2);
    expect(created.filter((t) => !t.stopped), "only the newest one is live").toHaveLength(1);
  });

  it("stops both the clock and the watcher on destroy", () => {
    const before = watchTrackers.length;
    initWallpaper();
    const live = intervalSlots();
    destroyWallpaper();

    expect(intervalSlots()).toBe(live - 1);
    const created = watchTrackers.slice(before);
    expect(created.every((t) => t.stopped)).toBe(true);
  });
});

describe("clock source contract", () => {
  const source = readFileSync(resolve(themeDir, "useWallpaper.ts"), "utf8");

  it("reads the real module (positive control)", () => {
    expect(source).toContain("export function initWallpaper");
  });

  it("schedules the solar clock on the interval bus, not on rAF", () => {
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    expect(imports, "intervalBus is the clock's home").toContain("../runtime/intervalBus");
    expect(imports, "the animation bus must not come back").not.toContain("../runtime/animationBus");
    expect(source).toContain("scheduleInterval(");
    expect(source).not.toMatch(/\brequestAnimationFrame\b/);
    expect(source).not.toMatch(/\bsetInterval\(/);
  });
});
