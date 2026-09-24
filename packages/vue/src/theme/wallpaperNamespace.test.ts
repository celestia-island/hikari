import { beforeEach, describe, expect, it } from "vitest";

import { configureWallpaper } from "./useWallpaper";
import {
  DEFAULT_PRESETS,
  DEFAULT_WALLPAPER_ID,
  addCustomWallpaper,
  configureWallpaperStorage,
  getDisplaySettings,
  isWallpaperSource,
  loadActiveWallpaperId,
  loadCachedGeolocation,
  loadCustomWallpapers,
  loadDisplaySettings,
  registerWallpaperPack,
  saveActiveWallpaperId,
  saveCachedGeolocation,
  setDisplaySettings,
  wallpaperStorageKey,
  type CustomWallpaper,
} from "./wallpaper";

/**
 * Namespace gate.
 *
 * Two applications served from one origin share a localStorage profile, so
 * identical wallpaper keys mean each app silently overwrites the other's
 * active wallpaper, custom list, geolocation cache and display settings —
 * which is exactly what happened when a second app reused the first app's
 * `shittim-*` keys. The prefix is therefore an explicit registration, and
 * this file pins the property that matters: distinct prefixes cannot read or
 * write each other's state.
 */

const chestArt: CustomWallpaper = {
  id: "custom-chest",
  name: "Chest art",
  source: { type: "image", url: "https://example.com/chest.png" },
  addedAt: 1,
};

beforeEach(() => {
  localStorage.clear();
  // No pack unless a test registers one, so DEFAULT_WALLPAPER_ID is the
  // degenerate fallback and the namespace assertions read literally.
  registerWallpaperPack(null);
  configureWallpaperStorage({ storagePrefix: "chest" });
});

describe("storage namespaces", () => {
  it("maps every slot onto the configured prefix", () => {
    expect(wallpaperStorageKey("active")).toBe("chest-wallpaper");
    expect(wallpaperStorageKey("custom")).toBe("chest-custom-wallpapers");
    expect(wallpaperStorageKey("geolocation")).toBe("chest-geolocation");
    expect(wallpaperStorageKey("display")).toBe("chest-wallpaper-display");
  });

  it("two prefixes never read or write each other's state (the P59 collision)", () => {
    // App A ("chest") writes a full state set.
    saveActiveWallpaperId("chest-art");
    addCustomWallpaper(chestArt);
    saveCachedGeolocation(52.52, 13.405);
    setDisplaySettings("chest-art", { brightness: 20, effect: "frosted" });

    // App B ("erp") shares the origin but not the namespace: it must observe
    // a virgin store, not A's values.
    configureWallpaperStorage({ storagePrefix: "erp" });
    expect(DEFAULT_WALLPAPER_ID).toBe("solid");
    expect(loadActiveWallpaperId()).toBe(DEFAULT_WALLPAPER_ID);
    expect(loadCustomWallpapers()).toEqual([]);
    expect(loadCachedGeolocation()).toBeNull();
    expect(loadDisplaySettings()).toEqual({});
    expect(getDisplaySettings("chest-art")).toEqual({
      position: "center",
      scale: "cover",
      effect: "none",
      brightness: 0,
    });

    // B writes its own state; A's keys stay byte-identical.
    saveActiveWallpaperId("erp-art");
    addCustomWallpaper({ ...chestArt, id: "custom-erp", name: "Erp art" });
    expect(localStorage.getItem("chest-wallpaper")).toBe("chest-art");
    expect(localStorage.getItem("erp-wallpaper")).toBe("erp-art");
    expect(localStorage.getItem("chest-custom-wallpapers")).toBe(JSON.stringify([chestArt]));
    expect(localStorage.getItem("erp-custom-wallpapers")).toContain("custom-erp");

    // And A still reads its own state back unchanged.
    configureWallpaperStorage({ storagePrefix: "chest" });
    expect(loadActiveWallpaperId()).toBe("chest-art");
    expect(loadCustomWallpapers()).toEqual([chestArt]);
    expect(loadCachedGeolocation()).toEqual({ lat: 52.52, lng: 13.405 });
    expect(getDisplaySettings("chest-art")).toMatchObject({ brightness: 20, effect: "frosted" });
  });

  it("adopts a declared legacy key on read without ever writing into it", () => {
    // The old namespace, written by an earlier build.
    localStorage.setItem("shittim-wallpaper", "omphalos");

    // Adoption is opt-in: with no legacyKeys declared, the old key is invisible.
    expect(loadActiveWallpaperId()).toBe(DEFAULT_WALLPAPER_ID);
    expect(loadActiveWallpaperId()).not.toBe("omphalos");

    configureWallpaperStorage({
      storagePrefix: "chest",
      legacyKeys: { active: "shittim-wallpaper" },
    });
    expect(loadActiveWallpaperId()).toBe("omphalos");

    // The first write lands in the new namespace and leaves the legacy key —
    // another app may still own it — untouched.
    saveActiveWallpaperId("chest-art");
    expect(localStorage.getItem("chest-wallpaper")).toBe("chest-art");
    expect(localStorage.getItem("shittim-wallpaper")).toBe("omphalos");
    // The namespaced key now wins over the legacy fallback.
    expect(loadActiveWallpaperId()).toBe("chest-art");
  });
});

describe("retired vocabulary", () => {
  it("drops entries stored under the pre-rename \"slang\" spelling", () => {
    configureWallpaperStorage({ storagePrefix: "shittim" });
    const stored: Array<Record<string, unknown>> = [
      { id: "custom-slang", name: "Slang era", addedAt: 1, source: { type: "slang", preset: "omphalos" } },
      { id: "custom-model", name: "Model era", addedAt: 2, source: { type: "model", url: "https://x/m.glb" } },
      { id: "custom-solid", name: "Solid", addedAt: 3, source: { type: "solid", color: "auto" } },
      { id: "custom-image", name: "Image", addedAt: 4, source: { type: "image", url: "https://x/a.png" } },
      { id: "custom-video", name: "Video", addedAt: 5, source: { type: "video", url: "https://x/a.mp4" } },
      { id: "custom-pipeline", name: "Pipeline", addedAt: 6, source: { type: "pipeline", preset: "omphalos" } },
    ];
    localStorage.setItem("shittim-custom-wallpapers", JSON.stringify(stored));

    // Exactly the current four-word vocabulary survives: no aliasing of
    // "slang" → "pipeline", no drop-on-the-floor of the real types.
    expect(loadCustomWallpapers().map((w) => w.id)).toEqual([
      "custom-solid",
      "custom-image",
      "custom-video",
      "custom-pipeline",
    ]);
    expect(isWallpaperSource({ type: "slang", preset: "omphalos" })).toBe(false);
    expect(isWallpaperSource({ type: "model", url: "https://x/m.glb" })).toBe(false);
    expect(isWallpaperSource({ type: "pipeline", preset: "omphalos" })).toBe(true);
  });

  it("keeps the manifest display block on registered pack entries", () => {
    // display.overlay is a live chest semantic (a manifest-declared scrim)
    // and must survive the move into hikari; modeRestriction (erp-only,
    // product-undecided) is deliberately NOT part of this layer.
    configureWallpaper({
      storagePrefix: "shittim",
      presets: [
        {
          id: "art",
          name: "Art",
          default: true,
          source: { type: "image", url: "/res/wallpapers/art.webp" },
          display: { overlay: 0.42 },
        },
      ],
    });

    // The pack reaches the preset list through the live DEFAULT_PRESETS /
    // DEFAULT_WALLPAPER_ID bindings (a pack is registered after module
    // evaluation, so both are readable, never snapshotted).
    expect(DEFAULT_WALLPAPER_ID).toBe("art");
    expect(DEFAULT_PRESETS.map((w) => w.id)).toEqual(["art", "solid"]);
    expect(DEFAULT_PRESETS.find((w) => w.id === "art")?.display).toEqual({ overlay: 0.42 });
  });
});
