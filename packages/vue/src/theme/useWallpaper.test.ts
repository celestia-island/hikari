import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

// getGeolocation is hikari's network cascade (browser permission → IP
// lookup → timezone guess) — the only transport seam useWallpaper touches,
// mocked per-test. Everything else (useTheme, themePresets, scheduleInterval,
// getTimePeriod) is the real hikari so the shared module-singleton state in
// BOTH libraries stays coherent with the module under test.
const geoMock = vi.hoisted(() => vi.fn());
vi.mock("./useSolarTime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useSolarTime")>();
  return { ...actual, getGeolocation: () => geoMock() };
});

import { getTimePeriod } from "./useSolarTime";
import { useTheme } from "./useTheme";

import {
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_PRESETS,
  DEFAULT_WALLPAPER_ID,
  getDisplaySettings,
  type TimeAwareWallpaper,
  type WallpaperSource,
} from "./wallpaper";
import {
  brandDefaultWallpaperFor,
  configureWallpaper,
  currentPeriod,
  destroyWallpaper,
  geo,
  initWallpaper,
  registerServerThemeWallpaper,
  resolveThemeFollowSwitch,
  useWallpaper,
} from "./useWallpaper";

// Chest's theme id (its brandPresets.SC_THEME_ID) and its wallpaper pack
// were import-time constants sourced from that repo. Hikari takes both
// through the registration API, so the ported fixture lives here — the
// values are chest's, which keeps every assertion below byte-identical.
const SC_THEME_ID = "sc";

function registerChestFixtures() {
  configureWallpaper({
    // Chest's existing key namespace, so the storage-key assertions below
    // keep their literal form.
    storagePrefix: "shittim",
    presets: [
      {
        id: "shittim",
        name: "Shittim",
        default: true,
        source: { type: "image", url: "/res/wallpapers/shittim.png" },
      },
    ],
    brandDefaults: { [SC_THEME_ID]: "shittim" },
  });
}

// The composable and its helpers keep module-level refs (singletons per
// file), so tests drive the shared state explicitly — each starts from
// cleared storage with the brand line re-registered (which also remaps a
// stale currentTheme back to the default brand).
beforeEach(() => {
  localStorage.clear();
  registerChestFixtures();
});

afterEach(() => {
  destroyWallpaper();
});

describe("resolveSource (time-aware fallback chain)", () => {
  const day: WallpaperSource = { type: "image", url: "day.png" };
  const dusk: WallpaperSource = { type: "image", url: "dusk.png" };
  const night: WallpaperSource = { type: "video", url: "night.mp4" };
  const resolveSource = useWallpaper().resolveSource;

  it("passes a plain source through untouched", () => {
    expect(resolveSource(day)).toBe(day);
  });

  it("picks the current period's source", () => {
    currentPeriod.value = "night";
    expect(resolveSource({ day, dusk, night })).toBe(night);
    currentPeriod.value = "dusk";
    expect(resolveSource({ day, dusk, night })).toBe(dusk);
  });

  it("falls back to the first populated period when the current one is missing", () => {
    // Manifests may legally omit periods — the chain degrades to whatever
    // art exists (key order: day → dusk → night) instead of rendering
    // nothing.
    currentPeriod.value = "night";
    expect(resolveSource({ day } as TimeAwareWallpaper)).toBe(day);
    currentPeriod.value = "dusk";
    expect(resolveSource({ day } as TimeAwareWallpaper)).toBe(day);
    expect(resolveSource({ day, night } as TimeAwareWallpaper)).toBe(day);
  });
});

describe("pipeline resolution (real generated shader registry)", () => {
  // The bundled pipeline presets retired 2026-09-10 (empty generated
  // registry); dual-mode key building is covered by shaderPresets.test
  // with synthetic manifests. What remains here is the composable's
  // degradation over a registry that has no entry for the preset.
  it("uses a pipeline id as-is when the registry has no mode variant", () => {
    const theme = useTheme();
    const wp = useWallpaper();
    const id = wp.addCustomWallpaper("Ghost pipeline", { type: "pipeline", preset: "ghost" });
    wp.setActiveWallpaper(id);

    theme.setMode("light");
    expect(wp.pipelinePreset.value).toBe("ghost");

    wp.removeCustomWallpaper(id);
  });

  it("exposes no overlay css for pipelines and art without one", () => {
    const wp = useWallpaper();

    const id = wp.addCustomWallpaper("Ghost pipeline", { type: "pipeline", preset: "ghost" });
    wp.setActiveWallpaper(id);
    expect(wp.pipelineOverlay.value).toBeNull();
    wp.removeCustomWallpaper(id);

    wp.setActiveWallpaper(DEFAULT_WALLPAPER_ID); // image art — not a pipeline
    expect(wp.pipelineOverlay.value).toBeNull();
  });
});

describe("overlayOpacity ladder", () => {
  it("is 0 for the solid degenerate", () => {
    const wp = useWallpaper();
    wp.setActiveWallpaper("solid");
    expect(wp.overlayOpacity.value).toBe(0);
  });

  it("is 0 for pipelines without an overlay config in the registry", () => {
    const wp = useWallpaper();
    const id = wp.addCustomWallpaper("Ghost pipeline", { type: "pipeline", preset: "ghost" });
    wp.setActiveWallpaper(id);
    expect(wp.overlayOpacity.value).toBe(0);
    wp.removeCustomWallpaper(id);
  });

  it("applies the mode/period defaults for image art", () => {
    const theme = useTheme();
    const wp = useWallpaper();
    wp.setActiveWallpaper(DEFAULT_WALLPAPER_ID); // shittim — image, no manifest overlay

    theme.setMode("dark");
    currentPeriod.value = "day";
    expect(wp.overlayOpacity.value).toBe(0.78);
    currentPeriod.value = "night";
    expect(wp.overlayOpacity.value).toBe(0.78); // dark keeps the deeper scrim

    theme.setMode("light");
    currentPeriod.value = "day";
    expect(wp.overlayOpacity.value).toBe(0.78);
    currentPeriod.value = "dusk";
    expect(wp.overlayOpacity.value).toBe(0.78);
    currentPeriod.value = "night";
    expect(wp.overlayOpacity.value).toBe(0.6);
  });

  it("a manifest-declared overlay overrides the mode/period defaults", () => {
    // The pack manifest (res/wallpapers/*.wallpaper.toml [display]) is the
    // authored override; the preset entries are module singletons built
    // from the generated manifest, so the override is staged on the entry
    // and restored afterwards.
    const shittim = DEFAULT_PRESETS.find((w) => w.id === DEFAULT_WALLPAPER_ID);
    expect(shittim).toBeDefined();
    shittim!.display = { overlay: 0.42 };
    try {
      const theme = useTheme();
      const wp = useWallpaper();
      wp.setActiveWallpaper(DEFAULT_WALLPAPER_ID);
      theme.setMode("light");
      currentPeriod.value = "night";
      expect(wp.overlayOpacity.value).toBe(0.42); // beats the 0.6 default
      theme.setMode("dark");
      expect(wp.overlayOpacity.value).toBe(0.42); // beats the 0.78 default
    } finally {
      delete shittim!.display;
    }
  });
});

describe("followsTheme / rebindToThemeDefault", () => {
  it("infers follow-state from the theme's default and re-binds on demand", () => {
    useTheme().setTheme(SC_THEME_ID); // sc's default is the shittim art
    const wp = useWallpaper();

    wp.setActiveWallpaper("solid");
    expect(wp.followsTheme.value).toBe(false);
    wp.setActiveWallpaper("shittim");
    expect(wp.followsTheme.value).toBe(true);
    wp.setActiveWallpaper("solid"); // a user pick is not follow-state
    expect(wp.followsTheme.value).toBe(false);

    wp.rebindToThemeDefault();
    expect(wp.activeWallpaperId.value).toBe("shittim");
    expect(localStorage.getItem("shittim-wallpaper")).toBe("shittim");
  });

  it("an unmapped theme follows the pack default", () => {
    useTheme().setTheme("custom-theme-9"); // not in any map → pack default
    const wp = useWallpaper();
    wp.setActiveWallpaper(DEFAULT_WALLPAPER_ID);
    expect(wp.followsTheme.value).toBe(true);
    wp.rebindToThemeDefault();
    expect(wp.activeWallpaperId.value).toBe(DEFAULT_WALLPAPER_ID);
  });
});

describe("composable display settings", () => {
  it("bumps the shared settings version so the computed re-reads storage", () => {
    const wp = useWallpaper();
    wp.setActiveWallpaper("shittim");
    expect(wp.displaySettings.value).toEqual(DEFAULT_DISPLAY_SETTINGS);

    wp.setDisplaySettings({ effect: "frosted", brightness: 20 });
    // localStorage is not reactive — without the version bump the computed
    // would still serve the cached defaults for the SAME wallpaper id.
    expect(wp.displaySettings.value).toMatchObject({
      effect: "frosted",
      brightness: 20,
      position: "center",
    });
    expect(getDisplaySettings("shittim")).toMatchObject({ effect: "frosted", brightness: 20 });

    // A different active wallpaper resolves its own settings.
    wp.setActiveWallpaper("solid");
    expect(wp.displaySettings.value).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });
});

describe("initWallpaper", () => {
  beforeEach(() => {
    geoMock.mockReset();
    geoMock.mockResolvedValue({ lat: 52.52, lng: 13.405 });
  });

  it("seeds the current theme's default on first run (no stored choice)", () => {
    useTheme().setTheme(SC_THEME_ID);
    const wp = useWallpaper();
    wp.activeWallpaperId.value = "solid"; // stale module state, no stored choice
    localStorage.removeItem("shittim-wallpaper");

    initWallpaper();

    expect(wp.activeWallpaperId.value).toBe("shittim");
    expect(localStorage.getItem("shittim-wallpaper")).toBe("shittim");
  });

  it("first run with the theme default already active persists nothing", () => {
    useTheme().setTheme(SC_THEME_ID);
    const wp = useWallpaper();
    wp.activeWallpaperId.value = DEFAULT_WALLPAPER_ID; // sc's default
    localStorage.removeItem("shittim-wallpaper");

    initWallpaper();

    expect(localStorage.getItem("shittim-wallpaper")).toBeNull();
  });

  it("a stored user choice survives init", () => {
    const wp = useWallpaper();
    wp.setActiveWallpaper("solid");
    useTheme().setTheme(SC_THEME_ID);

    initWallpaper();

    expect(wp.activeWallpaperId.value).toBe("solid");
    expect(localStorage.getItem("shittim-wallpaper")).toBe("solid");
  });

  it("adopts the geolocation fix: geo ref, localStorage cache, period", async () => {
    initWallpaper();

    await vi.waitFor(() => expect(geo.value).toEqual({ lat: 52.52, lng: 13.405 }));
    expect(localStorage.getItem("shittim-geolocation")).toBe(
      JSON.stringify({ lat: 52.52, lng: 13.405 }),
    );
    // The wallpaper clock runs hikari's own solar math on the fresh fix.
    expect(currentPeriod.value).toBe(getTimePeriod(52.52, 13.405));
  });

  it("re-init replaces the follow watcher instead of stacking (idempotent init)", async () => {
    const theme = useTheme();
    const wp = useWallpaper();
    // Start from sc with a PERSISTED choice so init's first-run seeding
    // stays out of the way; restore a clean slate afterwards so sibling
    // tests keep their own setup premises.
    localStorage.removeItem("shittim-wallpaper");
    theme.setTheme(SC_THEME_ID);
    wp.activeWallpaperId.value = DEFAULT_WALLPAPER_ID;
    localStorage.setItem("shittim-wallpaper", DEFAULT_WALLPAPER_ID);

    initWallpaper();
    initWallpaper();

    // The endfield brand retired; a server-registered binding gives a
    // custom theme a default so the (single, replaced) follow watcher
    // still has a switch to perform here.
    registerServerThemeWallpaper("custom-stack", "solid");
    theme.setTheme("custom-stack");
    expect(wp.activeWallpaperId.value).toBe("solid");
    // Back to a followable sc state with nothing persisted.
    theme.setTheme(SC_THEME_ID);
    wp.activeWallpaperId.value = DEFAULT_WALLPAPER_ID;
    localStorage.removeItem("shittim-wallpaper");
  });

  it("re-binds follow-state synchronously and never clobbers an explicit adoption", async () => {
    // The endfield brand retired; a server-registered binding gives a
    // custom theme a default to switch to (same precedence path).
    registerServerThemeWallpaper("custom-follow", "solid");
    // The file-level afterEach destroys the wallpaper (watcher included,
    // since the 2026-09-09 idempotent-init fix) — own the watcher here
    // instead of leaning on a leak from sibling tests.
    initWallpaper();
    const theme = useTheme();
    const wp = useWallpaper();
    theme.setTheme(SC_THEME_ID);
    wp.activeWallpaperId.value = DEFAULT_WALLPAPER_ID; // following sc

    theme.setTheme("custom-follow");
    // flush:"sync" — the follow switch already ran inside the setTheme call
    // (a default-flush watcher would still show the old wallpaper here).
    expect(wp.activeWallpaperId.value).toBe("solid");
    expect(localStorage.getItem("shittim-wallpaper")).toBe("solid");

    // An explicit adoption in the SAME tick — the applyFromServer() shape:
    // it adopts the PREVIOUS theme's default (a cross-device server pair
    // like theme=custom-follow + wallpaper=shittim). A default-flush
    // watcher would fire after this line, misread the adoption as
    // follow-state of the old theme and clobber it back to custom-follow's
    // default, persisting the clobber via the bridge's sync-up.
    // Synchronous execution keeps the switch inside setTheme, before this
    // adoption runs.
    wp.setActiveWallpaper(DEFAULT_WALLPAPER_ID);
    await nextTick();
    expect(wp.activeWallpaperId.value).toBe(DEFAULT_WALLPAPER_ID);
    expect(localStorage.getItem("shittim-wallpaper")).toBe(DEFAULT_WALLPAPER_ID);
  });
});

describe("server theme wallpaper bindings", () => {
  it("registered server bindings outrank the embedded brand map", () => {
    // Fresh theme id: pack default before any binding exists.
    expect(brandDefaultWallpaperFor("srv-theme")).toBe(DEFAULT_WALLPAPER_ID);
    registerServerThemeWallpaper("srv-theme", "solid");
    expect(brandDefaultWallpaperFor("srv-theme")).toBe("solid");

    // A server binding also outranks the embedded brand map for a brand id
    // (the config file is the source of truth). Module state — this stays
    // registered for the rest of the file, so it runs last.
    registerServerThemeWallpaper(SC_THEME_ID, "solid");
    expect(brandDefaultWallpaperFor(SC_THEME_ID)).toBe("solid");

    // Follow-state resolves through the same precedence.
    registerServerThemeWallpaper("custom-srv", "shittim");
    expect(resolveThemeFollowSwitch("solid", "srv-theme", "custom-srv"))
      .toBe("shittim");
    expect(resolveThemeFollowSwitch("shittim", "srv-theme", "custom-srv"))
      .toBeNull(); // shittim is not srv-theme's default anymore

    // And the live watcher/composable agree: the server-registered binding
    // IS follow-state for the sync switch. (initWallpaper owns the watcher:
    // afterEach destroys it since the idempotent-init fix.)
    initWallpaper();
    useTheme().setTheme(SC_THEME_ID);
    const wp = useWallpaper();
    wp.activeWallpaperId.value = "solid"; // sc's server-registered default
    expect(wp.followsTheme.value).toBe(true);
    useTheme().setTheme("custom-srv");
    expect(wp.activeWallpaperId.value).toBe("shittim");
  });
});
