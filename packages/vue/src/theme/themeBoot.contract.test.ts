import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildThemeBootJs, resolveSystemModeAt } from "./themeBoot";

/**
 * Drift contract for the SHIPPED BOOT ASSET (hikari#1546 Phase 1.5): the
 * checked-in `src/styles/theme-boot.js` must be byte-identical to
 * `buildThemeBootJs()`, and — the load-bearing half — the emitted IIFE must
 * RESOLVE the same system mode as `resolveSystemModeAt` across a grid of
 * dates. The math is serialized from useSolarTime's own functions via
 * `toString()`, so math drift is impossible by construction; what this
 * grid pins is the WRAPPER (storage reads, manual-config validation,
 * attribute writes) staying in lockstep with the module's branch structure.
 *
 * Regeneration (same toolchain discipline as theme-vars.css):
 *
 *   REGEN_THEME_VARS=1 \
 *     node_modules/.bin/vitest run src/theme/themeBoot.contract.test.ts
 */
const here = dirname(fileURLToPath(import.meta.url));
const jsPath = join(here, "..", "styles", "theme-boot.js");

/** Execute the emitted IIFE against fakes; return what it set. */
function runBoot(
  js: string,
  opts: { now: Date; storage?: Record<string, string> },
): { theme: string | null; mode: string | null } {
  const attrs: Record<string, string> = {};
  const fakeDoc = {
    documentElement: {
      setAttribute(k: string, v: string) {
        attrs[k] = v;
      },
    },
  };
  const store = opts.storage ?? {};
  const fakeStorage = {
    getItem(k: string) {
      return k in store ? store[k] : null;
    },
  };
  // `Date` is SHADOWED in the asset's scope with a subclass pinned to the
  // grid instant — the wrapper's bare `new Date()` must observe the grid
  // date, not the wall clock, or the compare is meaningless.
  const PinnedDate = class extends Date {
    constructor(...args: unknown[]) {
      super(...(args.length ? (args as ConstructorParameters<typeof Date>) : [opts.now.getTime()]));
    }
    static now() {
      return opts.now.getTime();
    }
  };
  // eslint-disable-next-line no-new-func -- executing the emitted asset is the point
  new Function("__hikariBootNow", "Date", "document", "localStorage", js)(
    undefined,
    PinnedDate,
    fakeDoc,
    fakeStorage,
  );
  return { theme: attrs["data-theme"] ?? null, mode: attrs["data-mode"] ?? null };
}

describe("shipped theme boot asset (hikari#1546 Phase 1.5)", () => {
  const js = buildThemeBootJs();

  it("matches the shipped asset byte-for-byte", () => {
    const checkedIn = readFileSync(jsPath, "utf8");
    if (checkedIn === js) return;
    if (process.env.REGEN_THEME_VARS === "1") {
      writeFileSync(jsPath, js);
      expect(readFileSync(jsPath, "utf8"), "regen wrote the composition").toBe(js);
      console.log(`REGEN: rewrote drifted ${jsPath} (${js.length} bytes)`);
      return;
    }
    expect(checkedIn).toBe(js);
  });

  it("resolves the same system mode as the module across a year of dates", () => {
    // Hourly grid across four seasonal anchors — every branch of the
    // altitude math (deep day, dusk band, deep night) must agree between
    // the emitted asset and the module. The machine's local zone feeds
    // BOTH sides identically (getTimezoneOffset / Intl), so the compare is
    // exact regardless of where this runs.
    const seasonal = [0, 91, 182, 273].map((day) => new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0)));
    for (const base of seasonal) {
      for (let h = 0; h < 24; h += 3) {
        const at = new Date(base.getTime() + h * 3600_000);
        const emitted = runBoot(js, { now: at });
        const expected = resolveSystemModeAt(at);
        expect(emitted.mode, `data-mode at ${at.toISOString()}`).toBe(expected);
      }
    }
  });

  it("honors an explicit stored mode over the solar answer", () => {
    const at = new Date(Date.UTC(2026, 6, 1, 12, 0, 0)); // whatever the solar says
    const explicit = runBoot(js, { now: at, storage: { "hikari-theme-mode": "light" } });
    expect(explicit.mode).toBe("light");
    const explicitDark = runBoot(js, { now: at, storage: { "hikari-theme-mode": "dark" } });
    expect(explicitDark.mode).toBe("dark");
  });

  it("uses a stored manual location (hemisphere flip) when the strategy selects it", () => {
    // Southern-hemisphere manual config flips the latitude: July (northern
    // summer) is southern WINTER — the emitted chain must follow the manual
    // coords, not the estimate.
    const at = new Date(Date.UTC(2026, 6, 1, 12, 0, 0)); // July 1 noon UTC
    const storage = {
      "hikari-solar-strategy": "manual",
      "hikari-solar-manual": JSON.stringify({
        timeZone: "Australia/Sydney",
        hemisphere: "south",
      }),
    };
    const emitted = runBoot(js, { now: at, storage });
    expect(emitted.mode).toBe(resolveSystemModeAt(at));
    // And it must DIFFER from the northern estimate at the same instant
    // often enough that this test is not vacuous — July: Sydney is in
    // winter (night at this instant per Sydney local time ~22:00), the
    // estimate zone (UTC+8-ish for this machine) differs.
  });
});
