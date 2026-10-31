import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidInput } from "../test-utils/invalid";

// The module memoizes the geo fix in singleton state AND reads its solar
// strategy from localStorage at import, so every test gets a fresh module
// instance via vi.resetModules + dynamic import (plus clean storage: a
// strategy written by one test must not leak into the next one's import).
type SolarModule = typeof import("./useSolarTime");

describe("useSolarTime geolocation cascade (ip strategy)", () => {
  let mod: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    // Default: offline. Individual tests stub fetch/browser geo as needed —
    // nothing here may ever touch the real network.
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    mod = await import("./useSolarTime");
    // The web cascade is the "ip" strategy's machinery now — opt in.
    mod.setSolarLocationStrategy("ip");
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
    });

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
    });

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 1, lng: 2 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns the timezone estimate on total failure without pinning it", async () => {
    vi.stubGlobal("navigator", {});
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

describe("solar location strategy", () => {
  let mod: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    mod = await import("./useSolarTime");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to the offline timezone strategy — zero network, zero permission", async () => {
    // The core semantic of the strategy engine (2026-10 standardization):
    // a fresh environment must not issue ANY request, nor even read the
    // geolocation permission it may already hold, just to resolve where
    // the theme's sun is.
    expect(mod.solarLocationStrategy.value).toBe("timezone");
    expect(mod.solarManualLocation.value).toBeNull();

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 1, longitude: 2 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", {
      geolocation: { getCurrentPosition },
      permissions: { query: async () => ({ state: "granted" }) },
    });

    const geo = await mod.getGeolocation();
    expect(geo.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
    expect(geo.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("the ip strategy restores the legacy web cascade", async () => {
    mod.setSolarLocationStrategy("ip");
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 10.5, longitude: 20.25 }),
    })));

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 10.5, lng: 20.25 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("a host provider outranks every strategy, manual included", async () => {
    mod.setSolarLocationStrategy("manual");
    mod.setSolarManualLocation({ timeZone: "Asia/Shanghai", hemisphere: "north" });
    mod.setGeolocationProvider(async () => ({ lat: 40.71, lng: -74.01 }));

    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 40.71, lng: -74.01 });
  });

  it("setSolarLocationStrategy persists, drops the memo, and survives re-import", async () => {
    mod.setSolarLocationStrategy("ip");
    expect(mod.solarLocationStrategy.value).toBe("ip");
    expect(localStorage.getItem(mod.SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).toBe("ip");

    // The memo dropped with the switch: the very next resolution goes to
    // the (mocked) IP cascade without a reload.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ latitude: 3, longitude: 4 }),
    })));
    await expect(mod.getGeolocation()).resolves.toEqual({ lat: 3, lng: 4 });

    // And back: switching to the default re-resolves fully offline.
    mod.setSolarLocationStrategy("timezone");
    const geo = await mod.getGeolocation();
    expect(geo.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
    expect(geo.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);

    vi.resetModules();
    const reloaded: SolarModule = await import("./useSolarTime");
    expect(reloaded.solarLocationStrategy.value).toBe("timezone");
  });

  it("ignores unknown strategy values and heals stale storage to the default", async () => {
    mod.setSolarLocationStrategy(invalidInput("pigeon-post"));
    expect(mod.solarLocationStrategy.value).toBe("timezone");
    expect(localStorage.getItem(mod.SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).toBeNull();

    localStorage.setItem(mod.SOLAR_LOCATION_STRATEGY_STORAGE_KEY, "pigeon-post");
    vi.resetModules();
    // Imports stay storage-silent; hydration performs the heal.
    const reloaded: SolarModule = await import("./useSolarTime");
    reloaded.hydrateSolarLocationState();
    expect(reloaded.solarLocationStrategy.value).toBe("timezone");
    expect(localStorage.getItem(mod.SOLAR_LOCATION_STRATEGY_STORAGE_KEY)).toBeNull();
  });
});

describe("manual solar location", () => {
  let mod: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    mod = await import("./useSolarTime");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("manualLocationOf derives the STANDARD (non-DST) longitude and hemisphere latitude", () => {
    // January-vs-July sampling must drop the DST hour whichever hemisphere
    // observes it in: Berlin's July is +2 (30°) but its standard +1 (15°)
    // is the answer; Sydney's January is +11 (165°) but its standard +10
    // (150°) is; Shanghai never moves.
    const berlin = mod.manualLocationOf({ timeZone: "Europe/Berlin", hemisphere: "north" });
    expect(berlin.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
    expect(berlin.lng).toBeCloseTo(15);

    const sydney = mod.manualLocationOf({ timeZone: "Australia/Sydney", hemisphere: "south" });
    expect(sydney.lat).toBe(-mod.DEFAULT_GEO_LOCATION.lat);
    expect(sydney.lng).toBeCloseTo(150);

    expect(mod.manualLocationOf({ timeZone: "Asia/Shanghai", hemisphere: "north" }).lng)
      .toBeCloseTo(120);
    // Half-hour band (UTC+5:30 → 82.5°) and a western band (UTC−5 → −75°).
    expect(mod.manualLocationOf({ timeZone: "Asia/Kolkata", hemisphere: "north" }).lng)
      .toBeCloseTo(82.5);
    expect(mod.manualLocationOf({ timeZone: "America/New_York", hemisphere: "north" }).lng)
      .toBeCloseTo(-75);
  });

  it("the manual strategy resolves to the configured coordinates, offline", async () => {
    mod.setSolarLocationStrategy("manual");
    mod.setSolarManualLocation({ timeZone: "Europe/Berlin", hemisphere: "north" });
    const fetchMock = vi.mocked(globalThis.fetch);

    const geo = await mod.getGeolocation();
    expect(geo.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
    expect(geo.lng).toBeCloseTo(15);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a missing manual config degrades to the offline timezone estimate", async () => {
    mod.setSolarLocationStrategy("manual");
    const fetchMock = vi.mocked(globalThis.fetch);

    const geo = await mod.getGeolocation();
    expect(geo.lat).toBe(mod.DEFAULT_GEO_LOCATION.lat);
    expect(geo.lng).toBeCloseTo(-new Date().getTimezoneOffset() / 4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setSolarManualLocation validates before anything reaches the ref or storage", () => {
    // Zone Intl cannot construct:
    mod.setSolarManualLocation({ timeZone: "Mars/Olympus", hemisphere: "north" });
    expect(mod.solarManualLocation.value).toBeNull();
    expect(localStorage.getItem(mod.SOLAR_MANUAL_LOCATION_STORAGE_KEY)).toBeNull();

    // Legal zone, illegal hemisphere:
    mod.setSolarManualLocation({
      timeZone: "Europe/Berlin",
      hemisphere: invalidInput("east"),
    });
    expect(mod.solarManualLocation.value).toBeNull();
    expect(localStorage.getItem(mod.SOLAR_MANUAL_LOCATION_STORAGE_KEY)).toBeNull();
  });

  it("setSolarManualLocation drops the memo so the next resolution follows it", async () => {
    mod.setSolarLocationStrategy("manual");
    mod.setSolarManualLocation({ timeZone: "Europe/Berlin", hemisphere: "north" });
    const first = await mod.getGeolocation();
    expect(first).toEqual({ lat: mod.DEFAULT_GEO_LOCATION.lat, lng: 15 });

    mod.setSolarManualLocation({ timeZone: "Australia/Sydney", hemisphere: "south" });
    await expect(mod.getGeolocation()).resolves.toEqual({
      lat: -mod.DEFAULT_GEO_LOCATION.lat,
      lng: 150,
    });
  });

  it("persists a manual config, reads it back on hydration, and clears it", async () => {
    mod.setSolarManualLocation({ timeZone: "Australia/Sydney", hemisphere: "south" });
    expect(JSON.parse(localStorage.getItem(mod.SOLAR_MANUAL_LOCATION_STORAGE_KEY) ?? ""))
      .toEqual({ timeZone: "Australia/Sydney", hemisphere: "south" });

    // Imports are storage-silent (wallpaperSsr contract): the reloaded
    // module reflects storage only once something hydrates it.
    vi.resetModules();
    const reloaded: SolarModule = await import("./useSolarTime");
    expect(reloaded.solarManualLocation.value).toBeNull();
    reloaded.hydrateSolarLocationState();
    expect(reloaded.solarManualLocation.value)
      .toEqual({ timeZone: "Australia/Sydney", hemisphere: "south" });

    reloaded.setSolarManualLocation(null);
    expect(reloaded.solarManualLocation.value).toBeNull();
    expect(localStorage.getItem(mod.SOLAR_MANUAL_LOCATION_STORAGE_KEY)).toBeNull();
  });

  it("heals stale stored manual configs of every rot flavor", async () => {
    const key = mod.SOLAR_MANUAL_LOCATION_STORAGE_KEY;

    // Corrupt JSON.
    localStorage.setItem(key, "{not json");
    vi.resetModules();
    const rot1: SolarModule = await import("./useSolarTime");
    rot1.hydrateSolarLocationState();
    expect(rot1.solarManualLocation.value).toBeNull();

    // Valid JSON, wrong shape.
    localStorage.setItem(key, JSON.stringify({ timeZone: "Europe/Berlin", hemisphere: "east" }));
    vi.resetModules();
    const rot2: SolarModule = await import("./useSolarTime");
    rot2.hydrateSolarLocationState();
    expect(rot2.solarManualLocation.value).toBeNull();

    // Valid shape, nonexistent zone.
    localStorage.setItem(key, JSON.stringify({ timeZone: "Mars/Olympus", hemisphere: "north" }));
    vi.resetModules();
    const healed: SolarModule = await import("./useSolarTime");
    healed.hydrateSolarLocationState();
    expect(healed.solarManualLocation.value).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
});

describe("time zone catalog", () => {
  let mod: SolarModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    mod = await import("./useSolarTime");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("listTimeZones returns a non-empty list of constructible IANA ids", () => {
    const zones = mod.listTimeZones();
    expect(zones.length).toBeGreaterThan(0);
    expect(new Set(zones).size).toBe(zones.length);
    for (const zone of zones) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })).not.toThrow();
    }
  });

  it("listTimeZones falls back to a compact list when supportedValuesOf is unavailable", () => {
    const spy = vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new TypeError("not supported");
    });
    const zones = mod.listTimeZones();
    spy.mockRestore();

    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain("UTC");
    expect(zones).toContain("Asia/Shanghai");
    expect(zones).toContain("Australia/Sydney");
  });

  it("systemTimeZoneId names the runtime's own zone (or UTC)", () => {
    const id = mod.systemTimeZoneId();
    expect(id).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    expect(id.length).toBeGreaterThan(0);
  });
});
