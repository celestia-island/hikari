// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * SSR gate for the wallpaper logic layer.
 *
 * The ported layer read `localStorage` at MODULE SCOPE (`ref(loadActiveWallpaperId())`
 * and friends). On a server that is not a degraded value, it is a hard crash:
 * evaluating the module throws `ReferenceError: localStorage is not defined`,
 * so any host that imports the barrel — even one that never renders a
 * wallpaper — dies before its first byte of output.
 *
 * This file deliberately runs in the `node` environment (no DOM, no
 * localStorage) and pins three separate facts:
 *   1. importing all three modules succeeds with no storage at all,
 *   2. importing them touches no key in the wallpaper namespace, even when a
 *      storage object IS present — so a `typeof localStorage` guard around a
 *      module-scope read cannot pass this gate,
 *   3. the store and the composable degrade to defaults instead of throwing
 *      when the store is absent.
 */

/** Keys this layer owns under the default prefix. */
const WALLPAPER_KEY = /^hikari-(wallpaper|wallpaper-display|custom-wallpapers|geolocation)$/;

/** Theme-module keys — useTheme/presets read their own eagerly, by design. */
const THEME_KEY = /^hikari-(theme|theme-mode|custom-themes)$/;

/** The first import of a cold module graph costs seconds in a loaded worker;
 *  this gate is about *what* the import does, never about how fast. */
const IMPORT_TIMEOUT_MS = 30_000;

const installed: string[] = [];

afterEach(() => {
  for (const key of installed) {
    delete (globalThis as unknown as Record<string, unknown>)[key];
  }
  installed.length = 0;
  vi.resetModules();
});

describe("wallpaper logic layer — SSR import contract", () => {
  it(
    "imports all three modules with no DOM and no localStorage at all",
    async () => {
      expect(typeof globalThis.localStorage).toBe("undefined");
      expect(typeof globalThis.document).toBe("undefined");
      expect(typeof globalThis.window).toBe("undefined");

      await expect(import("./wallpaper")).resolves.toBeTruthy();
      await expect(import("./wallpaperDisplay")).resolves.toBeTruthy();
      await expect(import("./useWallpaper")).resolves.toBeTruthy();
    },
    IMPORT_TIMEOUT_MS,
  );

  it(
    "touches no wallpaper key while importing, even with storage present",
    async () => {
      const touched: string[] = [];
      const shim: Storage = {
        getItem: (key: string) => {
          touched.push(key);
          return null;
        },
        setItem: (key: string) => {
          touched.push(key);
        },
        removeItem: (key: string) => {
          touched.push(key);
        },
        clear: () => undefined,
        key: () => null,
        length: 0,
      };
      (globalThis as unknown as Record<string, unknown>).localStorage = shim;
      installed.push("localStorage");

      vi.resetModules();
      await import("./wallpaper");
      await import("./wallpaperDisplay");
      await import("./useWallpaper");

      // Anti-vacuity: the spy must have seen the module graph re-evaluate —
      // otherwise "no wallpaper key" would also be true of an import that
      // never happened.
      expect(touched.length).toBeGreaterThan(0);
      // The gate itself: nothing in this layer's namespace is read or written
      // while the three modules are being evaluated.
      expect(touched.filter((key) => WALLPAPER_KEY.test(key))).toEqual([]);
      // Every touch that did happen belongs to the theme module, which reads
      // its own keys eagerly on purpose.
      for (const key of touched) {
        expect(THEME_KEY.test(key), `unexpected key touched at import: ${key}`).toBe(true);
      }
    },
    IMPORT_TIMEOUT_MS,
  );

  it("degrades to defaults instead of throwing when the store is absent", async () => {
    const wallpaper = await import("./wallpaper");
    const { useWallpaper } = await import("./useWallpaper");

    expect(wallpaper.loadActiveWallpaperId()).toBe(wallpaper.DEFAULT_WALLPAPER_ID);
    expect(wallpaper.hasStoredWallpaperId()).toBe(false);
    expect(wallpaper.loadCustomWallpapers()).toEqual([]);
    expect(wallpaper.loadCachedGeolocation()).toBeNull();
    expect(wallpaper.loadDisplaySettings()).toEqual({});
    expect(() => wallpaper.saveActiveWallpaperId("ghost")).not.toThrow();
    expect(() => wallpaper.saveCustomWallpapers([])).not.toThrow();
    expect(() => wallpaper.saveCachedGeolocation(1, 2)).not.toThrow();
    expect(() => wallpaper.saveDisplaySettings({})).not.toThrow();
    expect(() => wallpaper.removeCustomWallpaper("ghost")).not.toThrow();

    // The composable itself is callable headlessly (a server render reaches
    // it through the barrel): it resolves the degenerate solid wallpaper.
    const wp = useWallpaper();
    expect(wp.activeWallpaperId.value).toBe(wallpaper.DEFAULT_WALLPAPER_ID);
    expect(wp.wallpaperType.value).toBe("solid");
    expect(wp.activeWallpaper.value?.id).toBe(wallpaper.FALLBACK_WALLPAPER_ID);
  });
});
