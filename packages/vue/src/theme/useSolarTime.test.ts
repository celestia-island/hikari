import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module memoizes the geo fix in singleton state, so every test gets a
// fresh module instance via vi.resetModules + dynamic import.
type SolarModule = typeof import("./useSolarTime");

describe("useSolarTime geolocation cascade", () => {
  let mod: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    // Default: offline. Individual tests stub fetch/browser geo as needed —
    // nothing here may ever touch the real network.
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    mod = await import("./useSolarTime");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("prefers the registered provider, memoizes the fix, and resets on re-registration", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const provider = vi.fn(async () => ({ lat: 35.68, lng: 139.69 }));
    mod.setGeolocationProvider(provider);

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 35.68, lng: 139.69 });
    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 35.68, lng: 139.69 });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // Re-registering (also with null) drops the memo.
    mod.setGeolocationProvider(async () => ({ lat: 1, lng: 2 }));
    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 1, lng: 2 });
  });

  it("falls through to the IP lookup when the provider yields nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 10.5, longitude: 20.25 }),
    })));
    vi.mocked(globalThis.fetch);
    mod.setGeolocationProvider(async () => null);

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 10.5, lng: 20.25 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through when the provider throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: -1.5, longitude: 2.5 }),
    })));
    mod.setGeolocationProvider(async () => {
      throw new Error("native geo unavailable");
    });

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: -1.5, lng: 2.5 });
  });

  it("uses already-granted browser geolocation before the IP lookup", async () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: (pos: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 51.5, longitude: -0.12 } }),
      },
      permissions: { query: async () => ({ state: "granted" }) },
    } as unknown as Navigator);

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 51.5, lng: -0.12 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("never prompts: an ungranted browser permission is skipped entirely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 1, longitude: 2 }),
    })));
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
      permissions: { query: async () => ({ state: "prompt" }) },
    } as unknown as Navigator);

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 1, lng: 2 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns the timezone estimate on total failure without pinning it", async () => {
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    const first = await mod.getGeolocation();
    expect(first.lat).toBeCloseTo(mod.DEFAULT_GEO_LOCATION.lat);
    expect(first.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);

    // The estimate is not memoized — a later successful lookup wins.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 3, longitude: 4 }),
    })));
    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 3, lng: 4 });
  });

  it("timezoneFallback estimates the longitude from the timezone offset", () => {
    const est = mod.timezoneFallback();
    expect(est.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);
    expect(est.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
  });
});
