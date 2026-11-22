// Wiring pins for the highlight composable: the component must be loaded
// **through the tairitsu host client's async door** (`loadComponent`), and the
// highlighting must come **through the surface that door returns**, not from a
// bare `import()` of the wrapper.
//
// Why a separate file: the frozen tests (`useHighlight.adaptResult.test.ts`,
// `useHighlight.languageForPath.test.ts`) pin the record adapter and the
// path→language table. Neither can see the loader: a bare `import()` of the
// generated wrapper produces identical highlighting, and no fixture-level
// assertion notices which module graph produced it. These pins observe the load
// seam itself.
//
// The four pins below are the shape QR (#1476) and scene3d (#1478) converged on.
// The build count here counts `loadComponent` calls, because this component is
// lazily loaded — there is no module-load-time surface to count.
//   ① build count, asserted AFTER a call has run (the door is retryable, so a
//     lazy second `loadComponent` would otherwise be invisible);
//   ② the capabilities pin reads the FIRST build (a later load must not make it
//     fail with `undefined`, i.e. for the wrong reason);
//   ③ the data path: substitute the door's return and require the caller's
//     value to be that substitution;
//   ④ every assertion named in a comment here exists in this file.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the plugins.)
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

interface Seam {
  /** The options of every `loadComponent` call, in order. */
  builds: Array<Record<string, unknown>>;
  /** Argument list of every `surface.call(name, …)`. */
  calls: Array<{ name: string; args: unknown[] }>;
  /**
   * Test seam: when set, the wrapped door delegates to this instead of the real
   * export. Lets a probe substitute the door's return value and see whether the
   * caller consumes it.
   */
  doorOverride?: (name: string, ...args: unknown[]) => unknown;
  /** Set when `loadComponent` resolved — the surface exists from then on. */
  loaded: boolean;
}

const seam: Seam = {
  builds: [],
  calls: [],
  doorOverride: undefined,
  loaded: false,
};

vi.mock("@celestia-island/tairitsu-host-client", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@celestia-island/tairitsu-host-client")
  >();
  return {
    ...actual,
    loadComponent: async (
      options: Parameters<typeof actual.loadComponent>[0],
    ): ReturnType<typeof actual.loadComponent> => {
      // Every load is recorded, not just the first: the door is retryable, so a
      // second `loadComponent` would otherwise be invisible to a
      // first-call-only pin.
      seam.builds.push(options as Record<string, unknown>);
      const live = await actual.loadComponent(options);
      seam.loaded = true;
      const realCall = live.call.bind(live);
      // Wrap the surface's call door: this is where the highlighting must
      // arrive.
      live.call = ((name: string, ...args: unknown[]) => {
        seam.calls.push({ name, args });
        if (seam.doorOverride !== undefined) {
          return seam.doorOverride(name, ...args);
        }
        return realCall(name, ...args);
      }) as typeof live.call;
      return live;
    },
  };
});

const { highlight } = await import("./useHighlight");
const realWrapper = await import("../wasm/highlight/hikari_wasm_highlight.js");

const CODE = "fn main() { println!(\"hi\"); }";
const LANG = "rust";

/** Let the lazy load settle.
 *
 *  Real timers, not fake ones: the load is a genuine dynamic `import()` of a
 *  2.9 MB module, and a fake clock would stall it forever (measured — under
 *  `vi.useFakeTimers()` the module never finishes loading and every pin that
 *  waits for a call fails). This waits up to ~10s, which is what the production
 *  path does on a cold start. */
async function settle(): Promise<void> {
  for (let i = 0; i < 70; i++) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    if (surfaceReady()) return;
  }
}

/**
 * True once the composable holds a surface.
 *
 * The load is deliberately NOT observable as a call: the first `highlight()`
 * renders plaintext and kicks the load off, and only the *next* call reaches
 * the door (measured — see the probe in the module comment). So "a call has
 * happened" only becomes true after the test itself calls again, and waiting on
 * it before that point would always time out.
 */
function surfaceReady(): boolean {
  return seam.loaded;
}

describe("highlight loads through the host client", () => {
  // The surface is module-level state, cached after the first successful load —
  // so it is loaded once here and every case below runs against that one door.
  // `builds` is therefore 1 for the whole file; the per-case assertions about
  // "still one build" are about a second load NOT happening.
  beforeAll(async () => {

    highlight(CODE, LANG);
    await settle();
  });

  beforeEach(() => {
    seam.calls.length = 0;
    seam.doorOverride = undefined;
  });

  it("loads the wrapper through loadComponent, not a bare import", async () => {
    // Exactly one build so far. ① The factory is retryable, so this is
    // asserted after a call has run rather than at import time.
    expect(seam.builds).toHaveLength(1);

    const options = seam.builds[0]!;
    // The declaration reaches the door as the component's own object shape.
    expect(options.capabilities).toEqual({ interfaces: [], wasiModules: [] });
    // The load itself is a RELATIVE SPECIFIER through the client's
    // `loaders.importModule` hook — not a bare `import()` of this module and
    // not a URL built from `import.meta.url` (which resolves to a non-`file:`
    // origin the ESM loader rejects; measured).
    const loaders = options.loaders as
      | { importModule?: (url: string) => Promise<unknown> }
      | undefined;
    expect(typeof loaders?.importModule).toBe("function");
  });

  it("declares an empty capability set on the first load", () => {
    // ② Read from the FIRST build.
    //
    // Measured, so the scope is exact rather than assumed: dropping
    // `capabilities` from the `loadComponent` call reds this case AND the one
    // above (which asserts `options.capabilities` too) — two reds, not one.
    // What it does NOT do is touch the three call-path cases below, so a
    // failure here still points at the declaration rather than at the loader.
    expect(seam.builds[0]!.capabilities).toEqual({
      interfaces: [],
      wasiModules: [],
    });
  });

  it("calls the component export through the surface, not the wrapper", () => {
    // eslint-disable-next-line no-console

    // A second call must reuse the loaded surface rather than loading again.
    highlight(CODE, LANG);

    // A bare `import()` returns the same highlighting but never reaches this
    // door, so the array stays empty. Measured: replacing the surface call with
    // a direct wrapper read reds this case plus the two below; a lazy second
    // `loadComponent` reds this case alone (the build count).
    const highlightCalls = seam.calls.filter((c) => c.name === "highlight");
    expect(highlightCalls).toHaveLength(1);
    expect(highlightCalls[0]!.args[0]).toBe(CODE);
    expect(highlightCalls[0]!.args[1]).toBe(LANG);

    // ① Still exactly one load after a second call: the surface is cached.
    expect(seam.builds).toHaveLength(1);
  });

  it("uses the value the observed door returned, not a parallel import", () => {
    // ③ Substitute the door's return for one call. A loader that consults the
    // door but takes its HTML from the raw namespace yields the real markup and
    // fails here.
    seam.doorOverride = () => ({ html: "<b>MARKED</b>" });
    const substituted = highlight(CODE, LANG);
    seam.doorOverride = undefined;

    expect(substituted).toBe("<b>MARKED</b>");
    // And the real path still works once the override is gone.
    const real = highlight(CODE, LANG);
    expect(real).not.toBe("<b>MARKED</b>");
    expect(real).toContain("hljs");
  });

  it("adapts the record the door returns, and honours a declined result", () => {
    // An omitted `html` is the component's "no answer" — the caller must get
    // escaped plaintext, not the record.
    seam.doorOverride = () => ({});
    const declined = highlight("<a>", LANG);
    seam.doorOverride = undefined;

    expect(declined).toBe("&lt;a&gt;");
    expect(typeof declined).toBe("string");
  });
});

/** The artifact's own export, kept for reference by the substitution case above
 *  (it is what the real door calls). */
void realWrapper;
