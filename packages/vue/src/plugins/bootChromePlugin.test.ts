// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { HtmlTagDescriptor } from "vite";

import {
  BOOT_CHROME_SCRIPT,
  BOOT_CHROME_URL,
  bootChromePlugin,
} from "./bootChromePlugin";

/**
 * `bootChromePlugin` contract tests.
 *
 * The plugin is the only thing that puts `res/boot-chrome.js` in front of a
 * host build, so each hook is pinned here:
 *
 *   - `transformIndexHtml` must inject a CLASSIC script at `body-prepend`
 *     (before the loading screen and before the module entry — the bar has to
 *     exist while those are still loading), with configuration carried on
 *     `data-hk-*` attributes (inline config dies under `script-src 'self'`).
 *   - `buildStart` / `generateBundle` must emit the script at the output root,
 *     with the file's own bytes.
 *   - `configureServer` must serve the same URL in dev.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const RES_SCRIPT = readFileSync(join(HERE, "../res/boot-chrome.js"), "utf8");

interface EmittedAsset {
  type: string;
  fileName: string;
  source: string;
}

function tags(plugin: ReturnType<typeof bootChromePlugin>): HtmlTagDescriptor[] {
  const hook = plugin.transformIndexHtml as unknown as () => HtmlTagDescriptor[];
  return hook();
}

function emitContext(): {
  ctx: { emitFile(file: EmittedAsset): void };
  emitted: EmittedAsset[];
} {
  const emitted: EmittedAsset[] = [];
  return { emitted, ctx: { emitFile: (file) => void emitted.push(file) } };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bootChromePlugin index.html injection", () => {
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
    const injected = tags(
      bootChromePlugin({ height: 31.6, hangMs: Number.NaN }),
    );
    expect(injected[0].attrs).toMatchObject({
      "data-hk-height": "32",
    });
    expect(injected[0].attrs).not.toHaveProperty("data-hk-hang-ms");
  });
});

describe("bootChromePlugin asset emission", () => {
  it("emits the boot script at the output root with its own bytes", async () => {
    const plugin = bootChromePlugin();
    const { ctx, emitted } = emitContext();

    await (plugin.buildStart as unknown as (...args: unknown[]) => Promise<void>).call(ctx);
    await (
      plugin.generateBundle as unknown as (...args: unknown[]) => Promise<void>
    ).call(ctx, {}, {});

    expect(BOOT_CHROME_SCRIPT).toBe("hk-boot-chrome.js");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      type: "asset",
      fileName: "hk-boot-chrome.js",
      source: RES_SCRIPT,
    });
  });

  it("reads the source lazily when buildStart was skipped", async () => {
    const plugin = bootChromePlugin();
    const { ctx, emitted } = emitContext();

    await (
      plugin.generateBundle as unknown as (...args: unknown[]) => Promise<void>
    ).call(ctx, {}, {});

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
      const isolated = (await import("./bootChromePlugin")) as typeof import("./bootChromePlugin");
      const { ctx } = emitContext();
      await expect(
        (
          isolated.bootChromePlugin().generateBundle as unknown as (
            ...args: unknown[]
          ) => Promise<void>
        ).call(ctx, {}, {}),
      ).rejects.toThrow(/cannot read .*boot-chrome\.js/i);
    } finally {
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });
});

describe("bootChromePlugin dev server", () => {
  interface FakeResponse {
    statusCode: number;
    headers: Record<string, string>;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  }

  function fakeServer(base = "/"): {
    server: unknown;
    handlers: Array<(
      req: { url?: string; method?: string },
      res: FakeResponse,
      next: (err?: unknown) => void,
    ) => void>;
  } {
    const handlers: Array<(
      req: { url?: string; method?: string },
      res: FakeResponse,
      next: (err?: unknown) => void,
    ) => void> = [];
    return {
      handlers,
      server: {
        config: { base },
        middlewares: { use: (fn: (typeof handlers)[number]) => void handlers.push(fn) },
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


  it("serves /hk-boot-chrome.js with the file contents", async () => {
    const { server, handlers } = fakeServer();
    (
      bootChromePlugin().configureServer as unknown as (s: unknown) => void
    )(server);
    expect(handlers).toHaveLength(1);

    const { res, body } = fakeResponse();
    const next = vi.fn();
    handlers[0]({ url: "/hk-boot-chrome.js?v=1", method: "GET" }, res, next);

    // The read goes through a lazy `import("node:fs")`, so wait for the
    // response instead of assuming how many turns it takes.
    await vi.waitFor(() => expect(body()).toBe(RES_SCRIPT), { timeout: 5000 });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("javascript");
  });

  it("answers HEAD without a body and ignores other requests", async () => {
    const { server, handlers } = fakeServer();
    (
      bootChromePlugin().configureServer as unknown as (s: unknown) => void
    )(server);

    const head = fakeResponse();
    handlers[0]({ url: "/hk-boot-chrome.js", method: "HEAD" }, head.res, vi.fn());
    await vi.waitFor(() => expect(head.res.statusCode).toBe(200), { timeout: 5000 });
    expect(head.body()).toBe("");

    const other = fakeResponse();
    const next = vi.fn();
    handlers[0]({ url: "/index.html", method: "GET" }, other.res, next);
    // A non-matching URL is declined SYNCHRONOUSLY, before any fs work.
    expect(next).toHaveBeenCalledTimes(1);
    expect(other.res.statusCode).toBe(0);
  });

  it("honours a non-root base prefix", async () => {
    const { server, handlers } = fakeServer("/panel/");
    (
      bootChromePlugin().configureServer as unknown as (s: unknown) => void
    )(server);

    const { res, body } = fakeResponse();
    const next = vi.fn();
    handlers[0]({ url: "/panel/hk-boot-chrome.js", method: "GET" }, res, next);

    await vi.waitFor(() => expect(body()).toBe(RES_SCRIPT), { timeout: 5000 });
    expect(next).not.toHaveBeenCalled();
  });
});
