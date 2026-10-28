// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { HtmlTagDescriptor } from "vite";
import { build } from "vite";

import {
  BOOT_CHROME_SCRIPT,
  BOOT_CHROME_URL,
  bootChromePlugin,
} from "./boot-chrome.mjs";

/**
 * `boot-chrome.mjs` contract tests.
 *
 * The plugin is the only thing that puts `res/boot-chrome.js` in front of a
 * host build, so every hook is pinned here:
 *
 *   - `transformIndexHtml` must inject a CLASSIC script at `body-prepend`
 *     (before the loading screen and before the module entry — the bar has to
 *     exist while those are still loading), with configuration carried on
 *     `data-hk-*` attributes (inline config dies under `script-src 'self'`),
 *     and ONLY into the app window's HTML entry (a multi-window shell builds
 *     transparent overlay pages; a caption bar inside one is a visual bug).
 *   - `buildStart` / `generateBundle` must emit the script at the output root,
 *     with the file's own bytes, and fail loudly when it is missing.
 *   - `configureServer` must serve the same URL in dev.
 *   - `configResolved`'s base must prefix the injected URL (root, sub-path and
 *     relative deployments).
 *
 * The last block runs REAL Vite builds, because "was a tag produced" and "did
 * the built page load the bar" are different questions.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const RES_SCRIPT = readFileSync(join(HERE, "../res/boot-chrome.js"), "utf8");

const temps: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  for (const dir of temps.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* a leftover temp dir must not fail the suite */
    }
  }
});

interface EmittedAsset {
  type: string;
  fileName: string;
  source: string;
}

function tags(
  plugin: ReturnType<typeof bootChromePlugin>,
  filename = "/app/index.html",
): HtmlTagDescriptor[] {
  const hook = plugin.transformIndexHtml as unknown as (
    html: string,
    ctx: { filename: string },
  ) => HtmlTagDescriptor[];
  return hook("<!doctype html><html><body></body></html>", { filename });
}

function emitContext(): {
  ctx: { emitFile(file: EmittedAsset): void };
  emitted: EmittedAsset[];
} {
  const emitted: EmittedAsset[] = [];
  return { emitted, ctx: { emitFile: (file) => void emitted.push(file) } };
}

describe("boot-chrome plugin html injection", () => {
  it("injects a classic script at body-prepend", () => {
    const injected = tags(bootChromePlugin());
    expect(injected).toHaveLength(1);
    expect(injected[0].tag).toBe("script");
    // body-prepend, not head: the tag must land after <body> opens (so
    // document.body exists and the bar can mount immediately) and before the
    // loading screen / module entry that follow it.
    expect(injected[0].injectTo).toBe("body-prepend");
    expect(injected[0].attrs).toMatchObject({ src: BOOT_CHROME_URL });
    // A module script would wait for the module graph — the bar may not.
    expect(injected[0].attrs).not.toHaveProperty("type");
    expect(injected[0].children).toBeUndefined();
  });

  it("carries title, height and hang delay as data attributes", () => {
    const injected = tags(
      bootChromePlugin({ title: "Shittim Chest", height: 36, hangMs: 12000 }),
    );
    expect(injected[0].attrs).toMatchObject({
      src: "/hk-boot-chrome.js",
      "data-hk-title": "Shittim Chest",
      "data-hk-height": "36",
      "data-hk-hang-ms": "12000",
    });
  });

  it("omits options the host never set", () => {
    const injected = tags(bootChromePlugin({ title: "" }));
    expect(Object.keys(injected[0].attrs ?? {})).toEqual(["src"]);
  });

  it("keeps numeric attributes well-formed", () => {
    const injected = tags(bootChromePlugin({ height: 31.6, hangMs: Number.NaN }));
    expect(injected[0].attrs).toMatchObject({ "data-hk-height": "32" });
    expect(injected[0].attrs).not.toHaveProperty("data-hk-hang-ms");
  });
});

describe("boot-chrome plugin multi-entry filter (S1-2)", () => {
  it("injects the app window only — never a transparent overlay page", () => {
    const plugin = bootChromePlugin();

    expect(tags(plugin, "/repo/index.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/dist/overlay.html")).toHaveLength(0);
    expect(tags(plugin, "/repo/pages/settings.html")).toHaveLength(0);
  });

  it("accepts an explicit entry list (basename or path suffix)", () => {
    const plugin = bootChromePlugin({
      htmlFiles: ["index.html", "window-main.html", "pages/chat.html"],
    });
    expect(tags(plugin, "/repo/index.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/window-main.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/pages/chat.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/overlay.html")).toHaveLength(0);
  });

  it("accepts a RegExp over the entry path", () => {
    const plugin = bootChromePlugin({ htmlFiles: /app-[a-z]+\.html$/ });
    expect(tags(plugin, "/repo/app-main.html")).toHaveLength(1);
    expect(tags(plugin, "/repo/overlay-app.html")).toHaveLength(0);
  });

  it("warns once per skipped entry so forgetting htmlFiles is visible", () => {
    // R3 S3-1: a multi-window host that never configured htmlFiles would ship
    // a window with no caption bar and nothing in the build log.
    const warnings: string[] = [];
    const context = {
      warn: (message: string) => void warnings.push(message),
    };
    const hook = bootChromePlugin().transformIndexHtml as unknown as (
      html: string,
      ctx: { filename: string },
    ) => HtmlTagDescriptor[];
    const run = (filename: string) => hook.call(context, "", { filename });

    run("/app/overlay.html");
    run("/app/overlay.html"); // dev re-requests the same page: no repeat
    run("/app/index.html"); // instrumented: silent
    run("/app/settings.html");
    run("/app/settings.html");

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("overlay.html");
    expect(warnings[0]).toContain("htmlFiles");
    expect(warnings[1]).toContain("settings.html");
  });

  it("treats an unknown filename as the main entry (never silently skip)", () => {
    const injected = (
      bootChromePlugin().transformIndexHtml as unknown as (
        html: string,
        ctx: unknown,
      ) => HtmlTagDescriptor[]
    )("<!doctype html><body></body>", {});
    expect(injected).toHaveLength(1);
  });
});

describe("boot-chrome plugin base handling (S2-3)", () => {
  function injectedSrc(base: string): unknown {
    const plugin = bootChromePlugin();
    (
      plugin.configResolved as unknown as (config: {
        base: string;
      }) => void
    )({ base });
    return tags(plugin)[0].attrs?.src;
  }

  it("prefixes the injected URL with the resolved base", () => {
    expect(injectedSrc("/")).toBe("/hk-boot-chrome.js");
    expect(injectedSrc("/panel/")).toBe("/panel/hk-boot-chrome.js");
    expect(injectedSrc("/panel")).toBe("/panel/hk-boot-chrome.js");
    expect(injectedSrc("./")).toBe("./hk-boot-chrome.js");
    expect(injectedSrc("")).toBe("/hk-boot-chrome.js");
  });
});

describe("boot-chrome plugin asset emission", () => {
  it("emits the boot script at the output root with its own bytes", () => {
    const plugin = bootChromePlugin();
    const { ctx, emitted } = emitContext();

    (plugin.buildStart as unknown as (...args: unknown[]) => void).call(ctx);
    (plugin.generateBundle as unknown as (...args: unknown[]) => void).call(ctx, {}, {});

    expect(BOOT_CHROME_SCRIPT).toBe("hk-boot-chrome.js");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "asset",
      fileName: "hk-boot-chrome.js",
      source: RES_SCRIPT,
    });
  });

  it("reads the source lazily when buildStart was skipped", () => {
    const plugin = bootChromePlugin();
    const { ctx, emitted } = emitContext();

    (plugin.generateBundle as unknown as (...args: unknown[]) => void).call(ctx, {}, {});

    expect(emitted[0].source).toBe(RES_SCRIPT);
    // The emitted file must be the real bar, not a stub.
    expect(emitted[0].source).toContain("__TAURI_INTERNALS__");
    expect(emitted[0].source).toContain("data-tauri-drag-region");
  });

  it("fails loudly when the packaged boot script is missing", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      readFileSync: () => {
        throw new Error("ENOENT: no such file or directory");
      },
    }));
    try {
      const isolated = (await import("./boot-chrome.mjs")) as typeof import("./boot-chrome.mjs");
      const { ctx } = emitContext();
      expect(() =>
        (
          isolated.bootChromePlugin().generateBundle as unknown as (
            ...args: unknown[]
          ) => void
        ).call(ctx, {}, {}),
      ).toThrow(/cannot read .*boot-chrome\.js/i);
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });
});

describe("boot-chrome plugin dev server", () => {
  interface FakeResponse {
    statusCode: number;
    headers: Record<string, string>;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  }

  type Handler = (
    req: { url?: string; method?: string },
    res: FakeResponse,
    next: (err?: unknown) => void,
  ) => void;

  function fakeServer(base = "/"): { server: unknown; handlers: Handler[] } {
    const handlers: Handler[] = [];
    return {
      handlers,
      server: {
        config: { base },
        middlewares: { use: (fn: Handler) => void handlers.push(fn) },
      },
    };
  }

  function fakeResponse(): { res: FakeResponse; body: () => string } {
    let out = "";
    const res: FakeResponse = {
      statusCode: 0,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      end(body) {
        out = body ?? "";
      },
    };
    return { res, body: () => out };
  }

  it("serves the boot script with the file contents", () => {
    const { server, handlers } = fakeServer();
    (bootChromePlugin().configureServer as unknown as (s: unknown) => void)(server);
    expect(handlers).toHaveLength(1);

    const { res, body } = fakeResponse();
    const next = vi.fn();
    handlers[0]({ url: "/hk-boot-chrome.js?v=1", method: "GET" }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("javascript");
    expect(body()).toBe(RES_SCRIPT);
  });

  it("answers HEAD without a body and declines other requests", () => {
    const { server, handlers } = fakeServer();
    (bootChromePlugin().configureServer as unknown as (s: unknown) => void)(server);

    const head = fakeResponse();
    handlers[0]({ url: "/hk-boot-chrome.js", method: "HEAD" }, head.res, vi.fn());
    expect(head.res.statusCode).toBe(200);
    expect(head.body()).toBe("");

    const other = fakeResponse();
    const next = vi.fn();
    handlers[0]({ url: "/index.html", method: "GET" }, other.res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(other.res.statusCode).toBe(0);
  });

  it("serves the base-prefixed URL too", () => {
    const { server, handlers } = fakeServer("/panel/");
    (bootChromePlugin().configureServer as unknown as (s: unknown) => void)(server);

    const prefixed = fakeResponse();
    handlers[0]({ url: "/panel/hk-boot-chrome.js", method: "GET" }, prefixed.res, vi.fn());
    expect(prefixed.res.statusCode).toBe(200);
    expect(prefixed.body()).toBe(RES_SCRIPT);

    const bare = fakeResponse();
    handlers[0]({ url: "/hk-boot-chrome.js", method: "GET" }, bare.res, vi.fn());
    expect(bare.res.statusCode).toBe(200);
  });
});

describe("boot-chrome plugin real Vite builds", () => {
  const INDEX_HTML =
    '<!doctype html><html><head><title>App</title></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>';
  const OVERLAY_HTML =
    '<!doctype html><html><head><title>Overlay</title></head><body><div id="overlay"></div><script type="module" src="/main.js"></script></body></html>';

  function project(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "hikari-boot-chrome-build-"));
    temps.push(root);
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
    }
    return root;
  }

  async function runBuild(
    root: string,
    options: {
      base?: string;
      pluginOptions?: Parameters<typeof bootChromePlugin>[0];
      entries: string[];
    },
  ): Promise<(name: string) => string> {
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      publicDir: false,
      base: options.base ?? "/",
      plugins: [bootChromePlugin(options.pluginOptions)],
      build: {
        outDir: join(root, "dist"),
        emptyOutDir: true,
        rollupOptions: {
          input: Object.fromEntries(
            options.entries.map((entry) => [
              entry.replace(/\.html$/, ""),
              join(root, entry),
            ]),
          ),
        },
      },
    });
    return (name: string) => readFileSync(join(root, "dist", name), "utf8");
  }

  it("injects the app window and leaves the overlay window alone", async () => {
    const root = project({
      "index.html": INDEX_HTML,
      "overlay.html": OVERLAY_HTML,
      "main.js": 'document.getElementById("app");',
    });
    const dist = await runBuild(root, { entries: ["index.html", "overlay.html"] });

    const index = dist("index.html");
    expect(index).toContain('src="/hk-boot-chrome.js"');
    // The bar is injected FIRST in <body> — before the host's loading screen
    // markup and before the app node it covers. (The module entry may sit in
    // <head>; module scripts are deferred, so the classic bar still executes
    // during parse, which is the property that matters.)
    expect(index).toMatch(/<body>\s*<script src="\/hk-boot-chrome\.js"/);
    expect(index.indexOf("hk-boot-chrome.js")).toBeLessThan(index.indexOf('id="app"'));

    const overlay = dist("overlay.html");
    expect(overlay).not.toContain("hk-boot-chrome.js");

    // The bar itself is emitted once, at the output root.
    expect(dist("hk-boot-chrome.js")).toBe(RES_SCRIPT);
  });

  it("prefixes the injected URL for a sub-path deployment", async () => {
    const root = project({ "index.html": INDEX_HTML, "main.js": "1" });
    const dist = await runBuild(root, { base: "/panel/", entries: ["index.html"] });

    expect(dist("index.html")).toContain('src="/panel/hk-boot-chrome.js"');
    expect(dist("hk-boot-chrome.js")).toBe(RES_SCRIPT);
  });

  it("keeps a relative-base build working", async () => {
    const root = project({ "index.html": INDEX_HTML, "main.js": "1" });
    const dist = await runBuild(root, { base: "./", entries: ["index.html"] });

    expect(dist("index.html")).toContain('src="./hk-boot-chrome.js"');
    expect(dist("hk-boot-chrome.js")).toBe(RES_SCRIPT);
  });
});
