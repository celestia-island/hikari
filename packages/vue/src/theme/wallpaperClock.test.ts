import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Clock-bus gate.
 *
 * The wallpaper solar clock must ride hikari's visibility-aware interval bus
 * (paused while the tab is hidden, one catch-up tick on return), NOT the
 * rAF-driven animation bus: rAF suspends entirely in a background tab, so
 * after a day/night flip behind a hidden page the wallpaper period could lag
 * a full cadence behind the theme the user is actually looking at. Two
 * clocks, one fact — this is the test that keeps the port from regressing to
 * the older `scheduleEvery` shape.
 */

const bus = vi.hoisted(() => {
  const handles: Array<{ disconnect: ReturnType<typeof vi.fn> }> = [];
  return {
    handles,
    scheduleInterval: vi.fn((_cb: () => void, _ms: number) => {
      const handle = { disconnect: vi.fn() };
      handles.push(handle);
      return handle;
    }),
  };
});

vi.mock("../runtime/intervalBus", () => ({
  scheduleInterval: bus.scheduleInterval,
  scheduleIntervalAfter: vi.fn(),
}));

const geoMock = vi.hoisted(() => vi.fn());
vi.mock("./useSolarTime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useSolarTime")>();
  return { ...actual, getGeolocation: () => geoMock() };
});

import { destroyWallpaper, initWallpaper } from "./useWallpaper";

beforeEach(() => {
  localStorage.clear();
  bus.handles.length = 0;
  bus.scheduleInterval.mockClear();
  geoMock.mockReset();
  geoMock.mockResolvedValue({ lat: 52.52, lng: 13.405 });
});

describe("wallpaper solar clock", () => {
  it("schedules the day/night refresh on the interval bus and disconnects it", () => {
    initWallpaper();

    expect(bus.scheduleInterval).toHaveBeenCalledTimes(1);
    const [callback, intervalMs] = bus.scheduleInterval.mock.calls[0];
    expect(typeof callback).toBe("function");
    expect(intervalMs).toBe(60_000);
    expect(bus.handles).toHaveLength(1);

    destroyWallpaper();
    expect(bus.handles[0].disconnect).toHaveBeenCalledTimes(1);

    // Idempotent re-init replaces the clock instead of stacking a second one.
    initWallpaper();
    initWallpaper();
    expect(bus.handles).toHaveLength(3);
    expect(bus.handles[1].disconnect).toHaveBeenCalledTimes(1);
    destroyWallpaper();
  });

  it("imports no rAF scheduler and no animation bus", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const file of ["wallpaper.ts", "wallpaperDisplay.ts", "useWallpaper.ts"]) {
      const source = readFileSync(resolve(here, file), "utf8");
      expect(source, file).not.toMatch(/scheduleEvery/);
      expect(source, file).not.toMatch(/from "\.\.\/runtime\/animationBus"/);
    }
    expect(readFileSync(resolve(here, "useWallpaper.ts"), "utf8")).toMatch(
      /from "\.\.\/runtime\/intervalBus"/,
    );
  });
});
