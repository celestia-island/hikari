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
 * MUT:mut-boot-grid — breaking the emitted chain's altitude call REDS the
 * grid; the manual-config case additionally pins two meridians whose
 * answers cannot depend on this host.
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

  it("routes a stored manual config through the zone meridian, machine-independently", () => {
    // Round-2 review (S1): the first version compared the wrapper (fake
    // storage, manual config) against the MODULE (real localStorage, empty
    // -> "timezone" estimate), which only agreed on the author's host. Both
    // sides now read the SAME storage object, and the anti-vacuity pins two
    // manual configs whose answers are fixed by their own timeZone — no
    // dependence on this machine's zone.
    const at = new Date(Date.UTC(2026, 6, 1, 12, 0, 0)); // July 1, 12:00Z
    const manual = (timeZone: string) =>
      JSON.stringify({ timeZone, hemisphere: "north" });
    const storeFor = (timeZone: string) => ({
      "hikari-solar-strategy": "manual",
      "hikari-solar-manual": manual(timeZone),
    });
    const asBootStorage = (m: Record<string, string>) => ({
      getItem: (k: string) => (k in m ? m[k]! : null),
    });

    // Greenwich meridian at July noon: the sun is high -> light.
    const utcStore = storeFor("UTC");
    const utc = runBoot(js, { now: at, storage: utcStore });
    expect(utc.mode, "UTC (lng 0) at July noon is DAY").toBe("light");
    expect(utc.mode, "module and asset agree on the manual path").toBe(
      resolveSystemModeAt(at, asBootStorage(utcStore)),
    );

    // Auckland's standard meridian is 180 degrees away: the same instant is
    // local midnight there -> night. Machine-independent by construction
    // (both configs pin lat AND lng), so this cannot pass vacuously.
    const aklStore = storeFor("Pacific/Auckland");
    const akl = runBoot(js, { now: at, storage: aklStore });
    expect(akl.mode, "Auckland (lng 180) at the same instant is NIGHT").toBe("dark");
    expect(akl.mode, "module and asset agree on the far meridian").toBe(
      resolveSystemModeAt(at, asBootStorage(aklStore)),
    );
    expect(utc.mode, "the two configs really do differ").not.toBe(akl.mode);
  });
});

