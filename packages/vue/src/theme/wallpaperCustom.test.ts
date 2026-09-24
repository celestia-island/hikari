import { beforeEach, describe, expect, it } from "vitest";

import {
  brandDefaultWallpaperFor,
  configureWallpaper,
  registerServerThemeWallpaper,
  resolveThemeFollowSwitch,
  useWallpaper,
} from "./useWallpaper";
import {
  DEFAULT_PRESETS,
  DEFAULT_WALLPAPER_ID,
  addCustomWallpaper,
  hasStoredWallpaperId,
  isTimeAware,
  isWallpaperSource,
  loadActiveWallpaperId,
  loadCachedGeolocation,
  loadCustomWallpapers,
  removeCustomWallpaper,
  saveActiveWallpaperId,
  saveCachedGeolocation,
  updateCustomWallpaper,
  type CustomWallpaper,
} from "./wallpaper";

// Chest's wallpaper pack and its theme-id→wallpaper map were import-time
// constants sourced from that repo. Hikari takes both through the
// registration API, so the ported fixture lives here — the values are
// chest's, which keeps every assertion below byte-identical.
function registerChestFixtures() {
  configureWallpaper({
    // Chest's existing key namespace, so the storage-key literals in the
    // assertions below stay valid.
    storagePrefix: "shittim",
    presets: [
      {
        id: "shittim",
        name: "Shittim",
        default: true,
        source: { type: "image", url: "/res/wallpapers/shittim.png" },
      },
    ],
    brandDefaults: { sc: "shittim" },
  });
}

beforeEach(() => {
  registerChestFixtures();
});

function makeCustom(overrides: Partial<CustomWallpaper> = {}): CustomWallpaper {
  return {
    id: "custom-test",
    name: "Test Wallpaper",
    source: { type: "image", url: "https://example.com/a.png" },
    addedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("custom wallpaper store (wallpaper.ts)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("add → update → remove round trip persists", () => {
    addCustomWallpaper(makeCustom());
    expect(loadCustomWallpapers()).toHaveLength(1);

    expect(
      updateCustomWallpaper(
        makeCustom({ name: "Renamed", source: { type: "video", url: "https://example.com/b.mp4" } }),
      ),
    ).toBe(true);
    const afterUpdate = loadCustomWallpapers();
    expect(afterUpdate).toHaveLength(1);
    expect(afterUpdate[0].name).toBe("Renamed");
    expect(afterUpdate[0].source).toEqual({ type: "video", url: "https://example.com/b.mp4" });
    expect(afterUpdate[0].addedAt).toBe(1_700_000_000_000);

    removeCustomWallpaper("custom-test");
    expect(loadCustomWallpapers()).toHaveLength(0);
  });

  it("updateCustomWallpaper returns false for an unknown id and stores nothing", () => {
    expect(updateCustomWallpaper(makeCustom({ id: "custom-missing" }))).toBe(false);
    expect(loadCustomWallpapers()).toHaveLength(0);
  });

  it("removeCustomWallpaper ignores unknown ids", () => {
    addCustomWallpaper(makeCustom());
    removeCustomWallpaper("custom-nope");
    expect(loadCustomWallpapers()).toHaveLength(1);
  });
});

describe("explicit-choice marker and geolocation cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hasStoredWallpaperId tracks whether a choice was ever stored", () => {
    expect(hasStoredWallpaperId()).toBe(false);
    saveActiveWallpaperId("omphalos");
    expect(hasStoredWallpaperId()).toBe(true);
    // The marker is the key's presence, not resolvability — an unknown id
    // still counts as a stored choice (no first-run re-seeding over it).
    saveActiveWallpaperId("retired-id");
    expect(hasStoredWallpaperId()).toBe(true);
    localStorage.removeItem("shittim-wallpaper");
    expect(hasStoredWallpaperId()).toBe(false);
  });

  it("round-trips the geolocation cache", () => {
    expect(loadCachedGeolocation()).toBeNull();
    saveCachedGeolocation(52.52, 13.405);
    expect(loadCachedGeolocation()).toEqual({ lat: 52.52, lng: 13.405 });
    expect(localStorage.getItem("shittim-geolocation")).toBe(
      JSON.stringify({ lat: 52.52, lng: 13.405 }),
    );
  });

  it("tolerates a corrupt geolocation cache", () => {
    localStorage.setItem("shittim-geolocation", "not-json");
    expect(loadCachedGeolocation()).toBeNull();
  });
});

describe("isTimeAware", () => {
  const source = { type: "image", url: "https://x/a.png" } as const;

  it("detects period-keyed source maps, never plain sources", () => {
    expect(isTimeAware({ day: source, dusk: source, night: source })).toBe(true);
    // Every plain source vocabulary entry stays a plain source.
    expect(isTimeAware({ type: "image", url: "https://x/a.png" })).toBe(false);
    expect(isTimeAware({ type: "video", url: "https://x/a.mp4" })).toBe(false);
    expect(isTimeAware({ type: "solid", color: "auto" })).toBe(false);
    expect(isTimeAware({ type: "pipeline", preset: "omphalos" })).toBe(false);
  });

  it("any period slot makes the map time-aware; a null slot does not", () => {
    // Dusk/night-only art is still time-aware (2026-09-09 fix — the old
    // day-only probe missed it and resolveSource passed the raw map
    // through as a "source").
    expect(isTimeAware({ dusk: source, night: source } as never)).toBe(true);
    expect(isTimeAware({ night: source } as never)).toBe(true);
    // typeof null === "object": a null slot is not a period (same fix).
    expect(isTimeAware({ day: null, dusk: source } as never)).toBe(true);
    expect(isTimeAware({ day: null } as never)).toBe(false);
    expect(isTimeAware(null as never)).toBe(false);
  });
});

describe("stored-shape filtering (no legacy aliasing)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accepts only current source types", () => {
    expect(isWallpaperSource({ type: "image", url: "https://x/a.png" })).toBe(true);
    expect(isWallpaperSource({ type: "pipeline", preset: "omphalos" })).toBe(true);
    // Retired spellings are NOT aliased anymore — the panel is unreleased
    // and carries no compatibility debt.
    expect(isWallpaperSource({ type: "slang", preset: "omphalos" })).toBe(false);
    expect(isWallpaperSource({ type: "model", url: "https://x/m.glb" })).toBe(false);
    expect(isWallpaperSource({ type: "weird" })).toBe(false);
    expect(isWallpaperSource({})).toBe(false);
  });

  it("loadCustomWallpapers drops retired-shape entries instead of mapping them", () => {
    const stored: Array<Record<string, unknown>> = [
      { id: "custom-slang", name: "Slang era", addedAt: 1, source: { type: "slang", preset: "omphalos" } },
      { id: "custom-model", name: "Model era", addedAt: 2, source: { type: "model", url: "https://x/m.glb" } },
      { id: "custom-img", name: "Image", addedAt: 3, source: { type: "image", url: "https://x/a.png" } },
    ];
    localStorage.setItem("shittim-custom-wallpapers", JSON.stringify(stored));
    const loaded = loadCustomWallpapers();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("custom-img");
  });
});

describe("builtin presets from the resource pack", () => {
  it("derives built-ins and the default id from the generated manifest", () => {
    expect(DEFAULT_WALLPAPER_ID).toBe("shittim");
    // The preset pipelines (omphalos / endfield) retired 2026-09-10 —
    // the bundled line is the shittim art plus the solid degenerate.
    const ids = DEFAULT_PRESETS.map((w) => w.id);
    expect(ids).toEqual(["shittim", "solid"]);
    const shittim = DEFAULT_PRESETS.find((w) => w.id === "shittim");
    expect(shittim?.sources).toEqual({ type: "image", url: expect.stringContaining("shittim") });
  });
});

describe("theme ↔ wallpaper follow switch", () => {
  it("brandDefaultWallpaperFor maps brands and falls back to the pack default", () => {
    expect(brandDefaultWallpaperFor("sc")).toBe("shittim");
    expect(brandDefaultWallpaperFor("custom-theme-1")).toBe(DEFAULT_WALLPAPER_ID);
  });

  it("resolveThemeFollowSwitch re-binds only follow-state selections", () => {
    // A server-registered binding gives a second theme a default to
    // switch to (the endfield brand retired 2026-09-10).
    registerServerThemeWallpaper("srv-brand", "solid");
    // Following the source theme's default → switches with the theme.
    expect(resolveThemeFollowSwitch("solid", "srv-brand", "sc")).toBe("shittim");
    expect(resolveThemeFollowSwitch("shittim", "sc", "srv-brand")).toBe("solid");
    // User-picked wallpapers survive theme switches.
    expect(resolveThemeFollowSwitch("omphalos", "srv-brand", "sc")).toBeNull();
    expect(resolveThemeFollowSwitch("custom-1", "sc", "srv-brand")).toBeNull();
    // Unknown/custom themes resolve through the pack default.
    expect(resolveThemeFollowSwitch(DEFAULT_WALLPAPER_ID, "custom-theme-1", "custom-theme-2"))
      .toBe(DEFAULT_WALLPAPER_ID);
  });
});

// The composable keeps module-level refs (singletons per test file), so
// these tests drive the shared state explicitly and clean up after
// themselves; each starts from cleared localStorage.
describe("useWallpaper composable", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addCustomWallpaper returns the generated id and refreshes the ref", () => {
    const wp = useWallpaper();
    const id = wp.addCustomWallpaper("Fresh", {
      type: "image",
      url: "https://example.com/fresh.png",
    });
    expect(id).toMatch(/^custom-/);
    expect(wp.customWallpapers.value.some((w) => w.id === id)).toBe(true);
    wp.removeCustomWallpaper(id);
    expect(wp.customWallpapers.value.some((w) => w.id === id)).toBe(false);
  });

  it("updateCustomWallpaper hot-swaps name/source in the store ref", () => {
    const wp = useWallpaper();
    const id = wp.addCustomWallpaper("Editable", {
      type: "image",
      url: "https://example.com/old.png",
    });
    expect(
      wp.updateCustomWallpaper({
        id,
        name: "Edited",
        source: { type: "pipeline", preset: "omphalos" },
        addedAt: 42,
      }),
    ).toBe(true);
    const updated = wp.customWallpapers.value.find((w) => w.id === id);
    expect(updated?.name).toBe("Edited");
    expect(updated?.source).toEqual({ type: "pipeline", preset: "omphalos" });
    wp.removeCustomWallpaper(id);
  });

  it("removing the active custom wallpaper falls back to the default", () => {
    const wp = useWallpaper();
    const id = wp.addCustomWallpaper("Active", {
      type: "image",
      url: "https://example.com/active.png",
    });
    wp.setActiveWallpaper(id);
    expect(wp.activeWallpaperId.value).toBe(id);

    wp.removeCustomWallpaper(id);
    expect(wp.activeWallpaperId.value).toBe(DEFAULT_WALLPAPER_ID);
    expect(localStorage.getItem("shittim-wallpaper")).toBe(DEFAULT_WALLPAPER_ID);
  });

  it("a stored id is adopted verbatim — no legacy aliasing", () => {
    localStorage.setItem("shittim-wallpaper", "omphalos");
    expect(loadActiveWallpaperId()).toBe("omphalos");
    // Retired spellings pass through unresolved; resolution back-fills the
    // default at the consumer (the picker), not here.
    localStorage.setItem("shittim-wallpaper", "slang-omphalos");
    expect(loadActiveWallpaperId()).toBe("slang-omphalos");
  });
});

