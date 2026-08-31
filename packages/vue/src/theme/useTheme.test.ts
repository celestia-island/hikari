import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The theme engine keeps singleton state (mode/theme refs + clock flag), so
// every test gets a fresh module instance via vi.resetModules + dynamic import.
type ThemeModule = typeof import("./useTheme");
type SolarModule = typeof import("./useSolarTime");

describe("useTheme theme clock", () => {
  let theme: ThemeModule;
  let solar: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.style.cssText = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
    // Nothing here may touch the real network.
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    solar = await import("./useSolarTime");
    theme = await import("./useTheme");
  });

  afterEach(() => {
    theme.stopThemeClock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initTheme starts the clock; the geo fix feeds geo/period on useTheme()", async () => {
    solar.setGeolocationProvider(async () => ({ lat: 40.71, lng: -74.01 }));
    theme.initTheme();

    const th = theme.useTheme();
    // Synchronous first paint: the timezone estimate, not the default
    // Shanghai constant.
    expect(th.geo.value.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);

    await vi.waitFor(() => {
      expect(th.geo.value).toEqual({ lat: 40.71, lng: -74.01 });
    });
    expect(["day", "dusk", "night"]).toContain(th.period.value);
  });

  it("refreshThemeClock honors a provider registered after initTheme", async () => {
    theme.initTheme();
    // No provider yet → the cascade bottoms out at the timezone estimate,
    // which must NOT be pinned.
    const first = await theme.refreshThemeClock();
    expect(first.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);

    solar.setGeolocationProvider(async () => ({ lat: -33.87, lng: 151.21 }));
    const second = await theme.refreshThemeClock();
    expect(second).toEqual({ lat: -33.87, lng: 151.21 });
    expect(theme.useTheme().geo.value).toEqual({ lat: -33.87, lng: 151.21 });
  });

  it("stopThemeClock allows initTheme to restart the clock", async () => {
    solar.setGeolocationProvider(async () => ({ lat: 1, lng: 2 }));
    theme.initTheme();
    await vi.waitFor(() => {
      expect(theme.useTheme().geo.value).toEqual({ lat: 1, lng: 2 });
    });
    theme.stopThemeClock();
    // Restarting the clock keeps the engine consistent (idempotent lifecycle).
    theme.initTheme();
    expect(theme.useTheme().geo.value).toEqual({ lat: 1, lng: 2 });
  });
});
