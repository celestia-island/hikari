import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `res/theme-loader.js` executed the way a host runs it: a classic script, in a
 * bare page, before any framework exists.
 *
 * WHY THIS SUITE EXISTS. `themeLoaderContract.test.ts` reads the emitted file
 * as TEXT and compares its palette table against `presets.ts`. That catches
 * value drift, but it never runs the script — so it cannot catch a change that
 * parses and reads correctly while the logic has moved: a wrong storage key
 * order, a resolver that returns the opposite scheme, a `setProperty` that
 * writes the dark triplet during the day. Those are exactly the failures a
 * transpile-driven conversion can introduce, and they all land on first paint
 * where no error boundary can report them.
 *
 * So this file evaluates the emitted bytes in happy-dom, with `localStorage`
 * and the clock controlled, and asserts the `--loader-*` custom properties the
 * loading screen is actually painted from.
 *
 * Kept in the `node` environment deliberately: the script is read from disk and
 * evaluated via `new Function`, i.e. as the classic (non-module) script it is,
 * with the globals it will find in a real page.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../..");
const SOURCE = readFileSync(resolve(REPO_ROOT, "res/theme-loader.js"), "utf8");

/** Minimal in-memory Storage; records every read so key ORDER can be asserted. */
class RecordingStorage {
  readonly store = new Map<string, string>();
  readonly reads: string[] = [];
  getItem(key: string): string | null {
    this.reads.push(key);
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

interface RunOptions {
  /** Entries already in localStorage. */
  storage?: Record<string, string>;
  /** Globals a page may declare BEFORE this script runs. */
  pageThemes?: Record<string, unknown>;
  pageDefaultTheme?: string;
  /** Frozen "now"; the resolver's solar math depends on it. */
  now?: Date;
  /** `getTimezoneOffset()` in minutes, as the browser reports it. */
  timezoneOffsetMinutes?: number;
}

interface RunResult {
  storage: RecordingStorage;
  /** The custom properties the script published on `:root`. */
  vars: Map<string, string>;
}

/**
 * Execute the emitted script against a fresh page. Returns what it painted.
 *
 * `new Function` gives the script the real global object (as `<script>` does)
 * while keeping it out of this module's scope.
 */
function runThemeLoader(options: RunOptions = {}): RunResult {
  const storage = new RecordingStorage();
  for (const [key, value] of Object.entries(options.storage ?? {})) {
    storage.setItem(key, value);
  }
  const vars = new Map<string, string>();

  const fakeWindow: Record<string, unknown> = { localStorage: storage };
  if (options.pageThemes) fakeWindow.__celestiaThemes = options.pageThemes;
  if (options.pageDefaultTheme) fakeWindow.__celestiaDefaultTheme = options.pageDefaultTheme;

  const documentElement = {
    style: {
      setProperty: (name: string, value: string | number): void => {
        vars.set(name, String(value));
      },
    },
  };

  const FakeDate = class extends Date {
    constructor(...args: unknown[]) {
      if (args.length === 0) super((options.now ?? new Date()).getTime());
      else super(...(args as [number]));
    }
    static now(): number {
      return (options.now ?? new Date()).getTime();
    }
    getTimezoneOffset(): number {
      return options.timezoneOffsetMinutes ?? super.getTimezoneOffset();
    }
  };

  const run = new Function(
    "window",
    "localStorage",
    "document",
    "Date",
    SOURCE,
  ) as (
    window: unknown,
    storage: unknown,
    document: unknown,
    date: unknown,
  ) => void;

  run(fakeWindow, storage, { documentElement }, FakeDate);
  return { storage, vars };
}

const GREEN = "136,192,208";
const GREEN_TRIPLET = "rgb(22,27,38)";
const PINK = "214,51,132";
const PAPER = "rgb(245,245,240)";

describe("res/theme-loader.js paints the pre-paint palette", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("paints the stock dark scheme when nothing is stored and it is night", () => {
    // 03:00 UTC in Shanghai (UTC+8) = 11:00 local, but the solar altitude at
    // the fallback mid-latitude for that instant is what decides. Pin an
    // instant that is unambiguously night at the +8 longitude the offset
    // implies.
    const { vars } = runThemeLoader({
      now: new Date("2024-01-15T18:00:00Z"), // ~02:00 next day at UTC+8
      timezoneOffsetMinutes: -480,
    });
    expect(vars.get("--loader-r")).toBe("136");
    expect(vars.get("--loader-g")).toBe("192");
    expect(vars.get("--loader-b")).toBe("208");
    expect(vars.get("--loader-bg")).toBe(GREEN_TRIPLET);
  });

  it("honours an explicitly stored light mode", () => {
    const { vars } = runThemeLoader({
      storage: { "hikari-theme-mode": "light" },
      now: new Date("2024-01-15T18:00:00Z"),
      timezoneOffsetMinutes: -480,
    });
    expect(vars.get("--loader-r")).toBe("214");
    expect(vars.get("--loader-g")).toBe("51");
    expect(vars.get("--loader-b")).toBe("132");
    expect(vars.get("--loader-bg")).toBe(PAPER);
    expect(vars.get("--loader-fg")).toBe("#1a1a1a");
    expect(vars.get("--loader-card-border")).toBe("#ddd");
  });

  it("honours an explicitly stored dark mode", () => {
    const { vars } = runThemeLoader({
      storage: { "hikari-theme-mode": "dark" },
    });
    expect(vars.get("--loader-r")).toBe("136");
    expect(vars.get("--loader-bg")).toBe(GREEN_TRIPLET);
    expect(vars.get("--loader-fg")).toBe("#e0e0e0");
  });

  it("reads the app-prefixed key ahead of the hikari engine key", () => {
    const { storage, vars } = runThemeLoader({
      storage: {
        "shittim-locale": "en",
        "shittim-theme-mode": "light",
        "hikari-theme-mode": "dark",
      },
    });
    // The chain is `prefixed || engine || "system"` and `||` short-circuits, so
    // a present prefixed key means the engine key is never even read. Asserted
    // through the READS (not the painted value) because that is the only place
    // the order is observable.
    const themeModeReads = storage.reads.filter((key) => key.endsWith("theme-mode"));
    expect(themeModeReads).toEqual(["shittim-theme-mode"]);
    // And the value that won is the legacy one.
    expect(vars.get("--loader-r")).toBe("214");

    // With no prefixed key the engine key is consulted and wins over "system".
    const engineOnly = runThemeLoader({
      storage: { "shittim-locale": "en", "hikari-theme-mode": "light" },
    });
    expect(
      engineOnly.storage.reads.filter((key) => key.endsWith("theme-mode")),
    ).toEqual(["shittim-theme-mode", "hikari-theme-mode"]);
    expect(engineOnly.vars.get("--loader-r")).toBe("214");
  });

  it("prefers the arona namespace when shittim stored nothing", () => {
    const { storage } = runThemeLoader({ storage: { "arona-locale": "en" } });
    expect(storage.reads).toContain("arona-theme");
  });

  it("falls back to the celestia namespace on a clean browser", () => {
    const { storage } = runThemeLoader();
    expect(storage.reads).toContain("celestia-theme");
    expect(storage.reads.filter((key) => key === "celestia-geolocation").length).toBeGreaterThan(0);
  });

  it("publishes the caption-band height contract boot-chrome reads", () => {
    const { vars } = runThemeLoader();
    // boot-chrome's pre-paint bar and the app's chrome must draw ONE band; the
    // script publishes the same var() chain theme.scss resolves so the two
    // cannot drift on a px number.
    expect(vars.get("--hk-chrome-band-h")).toBe("var(--s-header-height, 3rem)");
  });

  it("keeps the cached geolocation the solar resolver reads", () => {
    const { storage } = runThemeLoader({
      storage: { "celestia-geolocation": JSON.stringify({ lat: 51.5, lng: -0.12 }) },
      now: new Date("2024-06-21T11:00:00Z"), // midday in London
    });
    // Greenwich at noon in June is above the >6deg "day" threshold => light.
    expect(storage.reads).toContain("celestia-geolocation");
  });

  it("merges page-declared brand themes and paints them", () => {
    const { vars } = runThemeLoader({
      pageThemes: {
        midnight: {
          dark: { primary: [1, 2, 3], bg: [4, 5, 6], surface: [7, 8, 9] },
          light: { primary: [10, 11, 12], bg: [13, 14, 15], surface: [16, 17, 18] },
        },
      },
      pageDefaultTheme: "midnight",
      storage: { "hikari-theme": "midnight", "hikari-theme-mode": "dark" },
    });
    expect(vars.get("--loader-r")).toBe("1");
    expect(vars.get("--loader-g")).toBe("2");
    expect(vars.get("--loader-b")).toBe("3");
    expect(vars.get("--loader-bg")).toBe("rgb(4,5,6)");
    expect(vars.get("--loader-card-bg")).toBe("rgb(7,8,9)");
  });

  it("falls back to the stock theme when the page default names an unknown id", () => {
    // The table is dereferenced without a guard (`THEMES[tid] || FALLBACK_THEME`),
    // so an unknown id must resolve to something paintable rather than throw.
    const { vars } = runThemeLoader({
      pageDefaultTheme: "does-not-exist",
      storage: { "hikari-theme": "does-not-exist", "hikari-theme-mode": "dark" },
    });
    expect(vars.get("--loader-r")).toBe("136");
    expect(vars.get("--loader-bg")).toBe(GREEN_TRIPLET);
  });

  it("survives an unparseable geolocation blob instead of throwing", () => {
    // A classic script with no error boundary above it: a throw here leaves
    // the loading screen unpainted for the whole page.
    expect(() =>
      runThemeLoader({
        storage: { "celestia-geolocation": "{not json" },
        timezoneOffsetMinutes: -480,
      }),
    ).not.toThrow();
  });

  it("sets every --loader-* property the loading screen reads", () => {
    const { vars } = runThemeLoader();
    for (const name of [
      "--loader-r",
      "--loader-g",
      "--loader-b",
      "--loader-bg",
      "--loader-fg",
      "--loader-fg-muted",
      "--loader-card-bg",
      "--loader-card-border",
      "--loader-overlay-bg",
    ]) {
      expect(vars.has(name), `theme-loader publishes ${name}`).toBe(true);
    }
    expect(vars.get("--loader-overlay-bg")).toMatch(/^rgba\(\d+,\d+,\d+,0\.93\)$/);
  });
});
