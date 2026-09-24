import { beforeEach, describe, expect, it } from "vitest";

import { configureWallpaper } from "./useWallpaper";
import { buildWallpaperFilter } from "./wallpaperDisplay";
import {
  DEFAULT_DISPLAY_SETTINGS,
  getDisplaySettings,
  loadDisplaySettings,
  saveDisplaySettings,
  setDisplaySettings,
} from "./wallpaper";

// Chest's storage namespace (the key literals below), taken through
// hikari's registration API instead of an import-time constant.
const DISPLAY_KEY = "shittim-wallpaper-display";

beforeEach(() => {
  configureWallpaper({ storagePrefix: "shittim" });
});

describe("wallpaper display settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("DEFAULT_DISPLAY_SETTINGS has expected values", () => {
    expect(DEFAULT_DISPLAY_SETTINGS).toEqual({
      position: "center",
      scale: "cover",
      effect: "none",
      brightness: 0,
    });
  });

  it("getDisplaySettings returns defaults for unknown id", () => {
    expect(getDisplaySettings("unknown")).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it("getDisplaySettings merges a stored partial over defaults", () => {
    saveDisplaySettings({ "my-id": { position: "left", brightness: 20 } });
    const s = getDisplaySettings("my-id");
    expect(s.position).toBe("left");
    expect(s.brightness).toBe(20);
    expect(s.scale).toBe("cover");
    expect(s.effect).toBe("none");
  });

  it("getDisplaySettings clamps brightness into [-50, 50]", () => {
    saveDisplaySettings({ hot: { brightness: 999 }, cold: { brightness: -999 } });
    expect(getDisplaySettings("hot").brightness).toBe(50);
    expect(getDisplaySettings("cold").brightness).toBe(-50);
  });

  it("getDisplaySettings rejects invalid enum values", () => {
    localStorage.setItem(
      DISPLAY_KEY,
      JSON.stringify({
        bad: { position: "top", scale: "zoom", effect: "glass", brightness: 10 },
      }),
    );
    const s = getDisplaySettings("bad");
    expect(s.position).toBe("center");
    expect(s.scale).toBe("cover");
    expect(s.effect).toBe("none");
    expect(s.brightness).toBe(10);
  });

  it("setDisplaySettings merges and persists", () => {
    setDisplaySettings("x", { position: "right" });
    setDisplaySettings("x", { brightness: -30 });
    const s = getDisplaySettings("x");
    expect(s.position).toBe("right");
    expect(s.brightness).toBe(-30);
    expect(loadDisplaySettings()["x"]).toMatchObject({ position: "right", brightness: -30 });
  });

  it("loadDisplaySettings returns {} for corrupt storage", () => {
    localStorage.setItem(DISPLAY_KEY, "not-json");
    expect(loadDisplaySettings()).toEqual({});
  });
});

describe("buildWallpaperFilter", () => {
  it("returns none for no effect and zero brightness", () => {
    expect(
      buildWallpaperFilter({ position: "center", scale: "cover", effect: "none", brightness: 0 }),
    ).toBe("none");
  });

  it("returns the frosted blur only", () => {
    expect(buildWallpaperFilter({ ...DEFAULT_DISPLAY_SETTINGS, effect: "frosted" })).toBe(
      "blur(12px)",
    );
  });

  it("returns the acrylic chain only", () => {
    expect(buildWallpaperFilter({ ...DEFAULT_DISPLAY_SETTINGS, effect: "acrylic" })).toBe(
      "blur(8px) saturate(1.5) brightness(1.06)",
    );
  });

  it("composes brightness +30", () => {
    expect(buildWallpaperFilter({ ...DEFAULT_DISPLAY_SETTINGS, brightness: 30 })).toBe(
      "brightness(1.30)",
    );
  });

  it("composes brightness -50", () => {
    expect(buildWallpaperFilter({ ...DEFAULT_DISPLAY_SETTINGS, brightness: -50 })).toBe(
      "brightness(0.50)",
    );
  });

  it("composes frosted effect with brightness", () => {
    expect(
      buildWallpaperFilter({ ...DEFAULT_DISPLAY_SETTINGS, effect: "frosted", brightness: 20 }),
    ).toBe("blur(12px) brightness(1.20)");
  });
});
