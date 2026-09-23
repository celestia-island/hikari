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

describe("useTheme lean cssvar injection", () => {
  let theme: ThemeModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.style.cssText = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
    document.head.querySelectorAll("style[data-hikari-theme-vars]").forEach((el) => el.remove());
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    theme = await import("./useTheme");
  });

  afterEach(() => {
    theme.stopThemeClock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pickThemeVarDeltas keeps only values differing from the static cascade", () => {
    const vars = {
      "--a": "1 2 3",
      "--b": "4 5 6",
      "--c": "7 8 9",
      "--d": " 10 11 12 ",
    };
    const baseline = {
      "--a": "1 2 3",
      "--b": "4  5 6",
      "--c": "",
      "--d": "10 11 12",
    };
    // Whitespace-only differences collapse (normalization), so only the
    // genuinely absent/divergent values are injected.
    expect(theme.pickThemeVarDeltas(vars, baseline)).toEqual({
      "--c": "7 8 9",
    });
  });

  it("writes theme vars into a managed html:root style block, never inline", () => {
    theme.initTheme();
    const styleEl = document.head.querySelector("style[data-hikari-theme-vars]");
    expect(styleEl).not.toBeNull();
    // Real browsers compute the static defaults, so the block holds only the
    // true deltas; either way it is an html:root block (specificity 0,1,1 —
    // it must outrank every :root-level static seed regardless of document
    // order), not an inline attribute.
    expect(styleEl!.textContent).toMatch(/^html:root\{/);
    expect(styleEl!.textContent).toContain("--color-primary");
    // The html inline style attribute stays clean — no token vars on it.
    expect(document.documentElement.style.getPropertyValue("--color-primary")).toBe("");
    // The epoch attributes that consumers watch are still written.
    expect(document.documentElement.getAttribute("data-theme")).toBeTruthy();
    expect(document.documentElement.getAttribute("data-mode")).toBeTruthy();
    // Swapping theme keeps ONE managed block (no duplicates per apply) and
    // actually re-applies: the block content changes with the scheme. The
    // stock table holds a single preset, so a real swap registers a custom
    // derived from it and switches to that.
    const before = document.head.querySelector("style[data-hikari-theme-vars]")!.textContent;
    const th = theme.useTheme();
    th.addCustomTheme({
      id: "swap-probe",
      name: "Swap probe",
      dark: { ...th.presets.default.dark, primary: { r: 1, g: 2, b: 3 } },
      light: { ...th.presets.default.light, primary: { r: 4, g: 5, b: 6 } },
    });
    th.setTheme("swap-probe");
    const blocks = document.head.querySelectorAll("style[data-hikari-theme-vars]");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].textContent).toMatch(/^html:root\{/);
    expect(blocks[0].textContent).not.toBe(before);
  });

  it("a :root seed injected AFTER the managed block cannot un-theme the page", () => {
    // The 2026-09-18 dev.cw incident: every hikari component sheet @uses
    // tokens.scss, so a lazily-loaded route chunk re-emits the static seed
    // as a `:root` rule appended to <head> after this block — same
    // specificity, later in the cascade, and the brand palette lost to it
    // on the login page. The managed block therefore carries html:root
    // (0,1,1), which outranks any :root-level emission (0,1,0) regardless
    // of document order.
    theme.initTheme();
    const styleEl = document.head.querySelector("style[data-hikari-theme-vars]")!;
    expect(styleEl.textContent).toContain("--color-primary");

    const computed = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
    const themed = computed();
    expect(themed).not.toBe("");

    // Simulate the route-chunk seed: a :root rule with the static default,
    // appended LAST (exactly what a lazy chunk's <link> does).
    const seed = document.createElement("style");
    seed.textContent = ":root{--color-primary:122 162 247;--color-background:214 236 240;--color-surface:240 244 248;}";
    document.head.appendChild(seed);
    expect(computed()).toBe(themed);

    // Re-applying the theme must keep winning, too (no one-shot luck).
    const th = theme.useTheme();
    th.addCustomTheme({
      id: "seed-probe",
      name: "Seed probe",
      dark: { ...th.presets.default.dark, primary: { r: 9, g: 9, b: 9 } },
      light: { ...th.presets.default.light, primary: { r: 9, g: 9, b: 9 } },
    });
    th.setTheme("seed-probe");
    expect(computed()).not.toBe("122 162 247");
    seed.remove();
  });
});

describe("useTheme preset/custom shadowing", () => {
  let theme: ThemeModule;
  let presetModule: typeof import("./presets");

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.style.cssText = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-mode");
    document.head.querySelectorAll("style[data-hikari-theme-vars]").forEach((el) => el.remove());
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    // Same import context as useTheme so both share one presets instance.
    presetModule = await import("./presets");
    theme = await import("./useTheme");
  });

  afterEach(() => {
    theme.stopThemeClock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // A custom whose id equals a builtin shadows it at apply time
  // (getAllThemePresets). The picker list must agree: ONE row per id,
  // flagged custom — the in-place preset override grammar. The primary
  // shifts so an applied override is distinguishable from the factory.
  function override(id: string) {
    const base = presetModule.themePresets.default;
    return {
      id,
      name: `${id} (edited)`,
      dark: { ...base.dark, primary: { r: 1, g: 2, b: 3 } },
      light: { ...base.light },
    };
  }

  it("allThemeList dedupes a builtin id shadowed by a custom, flagging it custom", () => {
    theme.initTheme();
    const th = theme.useTheme();
    th.addCustomTheme(override("default"));
    const rows = th.allThemeList.value.filter((r) => r.id === "default");
    expect(rows).toHaveLength(1);
    expect(rows[0].isCustom).toBe(true);
    expect(rows[0].name).toBe("default (edited)");
    // Pure custom ids stay listed as customs, and the shadowed builtin is not
    // duplicated into a second, factory-backed row.
    th.addCustomTheme({ ...override("default"), id: "my-own" });
    expect(th.allThemeList.value.some((r) => r.id === "my-own" && r.isCustom)).toBe(true);
    expect(th.allThemeList.value.filter((r) => r.id === "default")).toHaveLength(1);
  });

  it("applyTheme renders the shadowing custom's tokens", () => {
    theme.initTheme();
    const th = theme.useTheme();
    th.setTheme("default");
    const before = document.head.querySelector("style[data-hikari-theme-vars]")!.textContent;
    th.addCustomTheme(override("default"));
    th.setTheme("default");
    const after = document.head.querySelector("style[data-hikari-theme-vars]")!.textContent;
    expect(after).not.toBe(before);
  });

  it("removing a shadowed builtin id restores the factory preset selection", () => {
    theme.initTheme();
    const th = theme.useTheme();
    th.addCustomTheme(override("default"));
    th.setTheme("default");
    expect(document.documentElement.getAttribute("data-theme")).toBe("default");
    th.removeCustomTheme("default");
    // Still on the id — now backed by the factory preset again.
    expect(th.currentTheme.value).toBe("default");
    expect(th.allThemeList.value.find((r) => r.id === "default")?.isCustom).toBe(false);
    expect(th.customThemes.value.some((c) => c.id === "default")).toBe(false);
  });

  it("removing a pure custom id resets the selection to the default theme", () => {
    theme.initTheme();
    const th = theme.useTheme();
    th.setTheme("default");
    th.addCustomTheme({ ...override("default"), id: "my-own" });
    th.setTheme("my-own");
    expect(document.documentElement.getAttribute("data-theme")).toBe("my-own");
    th.removeCustomTheme("my-own");
    expect(th.currentTheme.value).not.toBe("my-own");
    expect(th.allThemeList.value.some((r) => r.id === "my-own")).toBe(false);
  });
});
