// Cold-path pins for the highlight composable.
//
// Why this file exists, separately from `useHighlight.hostSurface.test.ts`:
// that file warms the composable in `beforeAll` and then asserts against the
// loaded state, so it can only see the *hot* path. The contract this composable
// actually documents lives on the **cold** path — first call renders plaintext
// and starts exactly one load, `version` bumps when that load resolves, a failed
// load retries on the next call. Measured: deleting the version bump, leaving a
// failed load permanently stuck, or serving a placeholder surface all kept the
// warmed pins green, because none of them observes a cold instance.
//
// Each case here gets a **fresh module instance** via `vi.resetModules()` and a
// fresh client mock, so nothing carries over between them. That is the whole
// point of the file; do not add a shared `beforeAll` warm-up.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the plugins.)
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ClientState {
  /** How many times the async door was asked to build. */
  builds: number;
  /** Fail this many leading builds, then behave normally. */
  failFirst: number;
  /** Resolve with a placeholder surface on the first build. */
  placeholderFirst: boolean;
}

const client: ClientState = { builds: 0, failFirst: 0, placeholderFirst: false };

// The mock is installed once, but its behaviour is driven by `client`, which
// each case resets — so no case inherits another's failure mode.
vi.mock("@celestia-island/tairitsu-host-client", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@celestia-island/tairitsu-host-client")
  >();
  return {
    ...actual,
    loadComponent: async (
      options: Parameters<typeof actual.loadComponent>[0],
    ): ReturnType<typeof actual.loadComponent> => {
      client.builds += 1;
      if (client.builds <= client.failFirst) {
        throw new Error("simulated transient load failure");
      }
      if (client.placeholderFirst && client.builds === 1) {
        // A surface that resolves but cannot serve the export.
        return {
          exports: {},
          call: () => {
            throw new actual.HostClientError("no-export", "the component exports no \"highlight\"");
          },
          stop: async () => {},
          whenIdle: async () => {},
          stopped: false,
        } as unknown as Awaited<ReturnType<typeof actual.loadComponent>>;
      }
      return actual.loadComponent(options);
    },
  };
});

/** A cold instance of the composable: no module cache, nothing warmed. */
async function freshComposable() {
  vi.resetModules();
  return await import("./useHighlight");
}

/** Give the lazy load room to resolve / fail. Real timers: a fake clock stalls
 *  the dynamic import (measured). Polls rather than sleeping a fixed budget —
 *  a cold module instance pays the full 3.2 MB parse on first use, and a fixed
 *  wait that was long enough in one case was short in another. */
async function tick(until: () => boolean = () => false, ms = 6000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (until()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("highlight cold path", () => {
  beforeEach(() => {
    client.builds = 0;
    client.failFirst = 0;
    client.placeholderFirst = false;
  });

  it("first call returns escaped plaintext and starts exactly one load", async () => {
    const { highlight } = await freshComposable();
    const html = highlight("<a> & b", "rust");

    // The pre-load answer is the *escaped source*, not the raw source.
    expect(html).toBe("&lt;a&gt; &amp; b");
    // Exactly one door build was kicked off by that call.
    expect(client.builds).toBe(1);
    // …and it lands, so a second call is highlighted rather than plaintext.
    await tick(() => highlight("<a> & b", "rust").includes("hljs"));
    expect(highlight("<a> & b", "rust")).toContain("hljs");
  });

  it("bumps version exactly once when the load resolves", async () => {
    const { highlight, useHighlight } = await freshComposable();
    const { version } = useHighlight();
    expect(version.value).toBe(0);
    highlight("fn main() {}", "rust");
    await tick(() => version.value === 1);
    expect(version.value).toBe(1);
    // A further call must not bump it again — the surface is cached.
    highlight("fn main() {}", "rust");
    expect(version.value).toBe(1);
  });

  it("makes a single build for two concurrent first calls", async () => {
    const { highlight } = await freshComposable();
    // Two cold calls before the first load resolves must collapse into one
    // door build. Scope, precisely: the collapse comes from `loadPromise` being
    // cached inside `ensureLoaded`, so removing `highlight()`'s own
    // `if (!surface && !loadPromise)` guard does NOT produce a second build
    // (measured: still 1). Deleting that cached promise is what breaks it, and
    // that is what this case would catch.
    highlight("fn a() {}", "rust");
    highlight("fn b() {}", "rust");
    await tick(() => highlight("fn a() {}", "rust").includes("hljs"));
    expect(client.builds).toBe(1);
  });

  it("retries a failed load on the next call instead of staying plaintext", async () => {
    client.failFirst = 1;
    const { highlight, useHighlight } = await freshComposable();
    const { version } = useHighlight();

    // First call: plaintext, load fails.
    expect(highlight("fn main() {}", "rust")).toBe("fn main() {}");
    expect(client.builds).toBe(1);
    await tick(() => version.value !== 0, 400);
    expect(version.value).toBe(0); // nothing resolved, so nothing bumped

    // Second call retries: a second build must happen and succeed.
    highlight("fn main() {}", "rust");
    expect(client.builds).toBe(2);
    await tick(() => version.value === 1);
    expect(version.value).toBe(1);
    expect(highlight("fn main() {}", "rust")).toContain("hljs");
  });

  it("degrades to plaintext when the surface cannot serve the export", async () => {
    // A surface that resolves but throws on the call — a guest trap, or a
    // wrapper that does not carry the export. The documented contract is
    // "plain text until the module loads", and callers (`HkDiffViewer`) call
    // this straight from a render, so a throw here breaks the view.
    // Measured before the guard: `HostClientError: no-export` propagated out of
    // `highlight()`.
    client.placeholderFirst = true;
    const { highlight } = await freshComposable();
    highlight("fn main() {}", "rust");
    await tick(() => false, 900);
    expect(highlight("<a> & b", "rust")).toBe("&lt;a&gt; &amp; b");
  });
});
