/**
 * `external: true` — the CSP-safe shape (2026-11-14 chest incident).
 *
 * A host served over HTTP with `script-src 'self'` cannot run the INLINE
 * recovery script at all: the browser logs a violation and skips it on every
 * page load, so the boot-failure panel never paints. The option emits the
 * same script as a same-origin classic file instead.
 *
 * The contract pinned here:
 *   - the emitted asset is byte-identical to what the inline form would put
 *     in the document (one script, one source of truth);
 *   - the injected tag is a `src` reference with NO async/defer — a plain
 *     classic script is parser-blocking, so the heal still lands before the
 *     app's modules evaluate (the reason the inline form was chosen);
 *   - the marker attribute survives, so a host that still hashes the script
 *     (the Tauri shells) can find it;
 *   - inline remains the DEFAULT (the shells' compile-time CSP hashes it).
 */

import { describe, expect, it } from "vitest";

import {
  BOOT_RECOVERY_ATTR,
  BOOT_RECOVERY_SCRIPT,
  bootRecoveryPlugin,
  bootRecoveryScript,
} from "./boot-recovery.js";

/** Drive the plugin the way Vite does, without a real build. */
function drivePlugin(
  plugin: ReturnType<typeof bootRecoveryPlugin>,
  base = "/",
) {
  const emitted: Array<{ fileName: string; source: string }> = [];
  const ctx = {
    emitFile(file: { fileName: string; source: string }) {
      emitted.push(file);
    },
    warn() {},
  };
  // Vite types the hooks as `ObjectHook<Fn> | Fn`; these are plain functions
  // here, so narrow once instead of spraying casts.
  type Hook = (...args: unknown[]) => unknown;
  const asFn = (hook: unknown): Hook => hook as Hook;
  asFn(plugin.configResolved).call(ctx, { base } as never);
  asFn(plugin.generateBundle).call(ctx);
  const tags = asFn(plugin.transformIndexHtml).call(ctx, "", {
    filename: "/app/index.html",
  });
  return { emitted, tags: (tags ?? []) as Tag[] };
}

interface Tag {
  tag: string;
  attrs: Record<string, string>;
  children?: string;
  injectTo: string;
}

describe("bootRecoveryPlugin({ external: true })", () => {
  it("emits the script at the output root, byte-identical to the inline form", () => {
    const { emitted } = drivePlugin(bootRecoveryPlugin({ external: true }));
    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe(BOOT_RECOVERY_SCRIPT);
    // One source of truth: the asset IS what the inline path would inline.
    expect(emitted[0].source).toBe(bootRecoveryScript({}));
  });

  it("injects a same-origin classic src tag with no async/defer", () => {
    const { tags } = drivePlugin(bootRecoveryPlugin({ external: true }));
    expect(tags).toHaveLength(1);
    const [tag] = tags;
    expect(tag.tag).toBe("script");
    expect(tag.attrs.src).toBe(`/${BOOT_RECOVERY_SCRIPT}`);
    // The marker survives so a hashing host can still locate it.
    expect(tag.attrs[BOOT_RECOVERY_ATTR]).toBe("");
    // Parse-time execution: a deferred/async script would push the heal past
    // the module evaluation it exists to catch.
    expect(tag.attrs.async).toBeUndefined();
    expect(tag.attrs.defer).toBeUndefined();
    // Nothing inline — that is the whole point.
    expect(tag.children).toBeUndefined();
    expect(tag.injectTo).toBe("head");
  });

  it("prefixes a sub-path base", () => {
    const { tags } = drivePlugin(bootRecoveryPlugin({ external: true }), "/chest/");
    const [tag] = tags;
    expect(tag.attrs.src).toBe(`/chest/${BOOT_RECOVERY_SCRIPT}`);
  });

  it("keeps inline as the DEFAULT (the Tauri shells hash the inline text)", () => {
    const { emitted, tags } = drivePlugin(bootRecoveryPlugin());
    expect(emitted).toHaveLength(0);
    const [tag] = tags;
    expect(tag.attrs.src).toBeUndefined();
    expect(tag.children).toBe(bootRecoveryScript({}));
  });
});

describe("dev server (external mode has no bundle to serve from)", () => {
  it("serves the script from memory as JavaScript, not the HTML fallback", () => {
    // In dev `generateBundle` never runs, so a SPA dev server would answer
    // the injected src with index.html (`200 text/html`) and the browser
    // would refuse to execute it — the watchdog dies AND every dev load
    // logs a MIME refusal. The plugin must serve the text itself.
    const plugin = bootRecoveryPlugin({ external: true });
    const handlers: Array<(req: unknown, res: unknown, next: () => void) => void> = [];
    const server = {
      config: { base: "/" },
      middlewares: { use: (fn: (typeof handlers)[number]) => handlers.push(fn) },
    };
    (plugin.configureServer as unknown as (s: typeof server) => void)(server);
    expect(handlers).toHaveLength(1);

    const served: { status?: number; headers?: Record<string, string>; body?: string } = {};
    const res = {
      set statusCode(v: number) { served.status = v; },
      setHeader(k: string, v: string) { (served.headers ??= {})[k] = v; },
      end(body?: string) { served.body = body; },
    };
    let nexted = false;
    handlers[0]({ url: "/hk-boot-recovery.js", method: "GET" }, res, () => { nexted = true; });

    expect(nexted).toBe(false);
    expect(served.status).toBe(200);
    expect(served.headers?.["Content-Type"]).toContain("application/javascript");
    expect(served.body).toBe(bootRecoveryScript({}));
  });

  it("passes unrelated paths through", () => {
    const plugin = bootRecoveryPlugin({ external: true });
    const handlers: Array<(req: unknown, res: unknown, next: () => void) => void> = [];
    (plugin.configureServer as unknown as (s: unknown) => void)({
      config: { base: "/" },
      middlewares: { use: (fn: (typeof handlers)[number]) => handlers.push(fn) },
    });
    let nexted = false;
    handlers[0]({ url: "/app.js", method: "GET" }, { setHeader() {}, end() {} }, () => { nexted = true; });
    expect(nexted).toBe(true);
  });

  it("installs no middleware when inline is in use", () => {
    // The hook itself stays defined (Vite plugin objects do not gain or lose
    // hooks conditionally); it must simply register nothing.
    const handlers: unknown[] = [];
    const plugin = bootRecoveryPlugin();
    (plugin.configureServer as unknown as (s: unknown) => void)({
      config: { base: "/" },
      middlewares: { use: (fn: unknown) => handlers.push(fn) },
    });
    expect(handlers).toHaveLength(0);
  });
});
