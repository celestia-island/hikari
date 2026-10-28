import type { Plugin } from "vite";

/**
 * `bootChromePlugin` — ship hikari's pre-boot window caption bar.
 *
 * A Tauri shell with `decorations: false` has no OS title bar, and the app's
 * own chrome is a Vue component: between first paint and mount the window
 * cannot be moved, minimized or closed. `res/boot-chrome.js` closes that gap
 * with a framework-free bar that exists from the first frame and hands over to
 * the app when a component claims the window (`hk:chrome-claim`).
 *
 * This plugin is the whole wire-up:
 *
 *   1. `transformIndexHtml` — injects `<script src="/hk-boot-chrome.js">` at
 *      `body-prepend`, ahead of the loading screen and the module entry. It is
 *      a CLASSIC script on purpose: the bar must not wait for the module graph.
 *      Configuration rides the tag's `data-hk-*` attributes because a host CSP
 *      is usually `script-src 'self'` (inline config scripts never execute).
 *   2. `buildStart` / `generateBundle` — reads `src/res/boot-chrome.js` and
 *      emits it as an asset at the output root, so the injected URL resolves in
 *      the built app. A missing source fails the build loudly: a 404 boot bar
 *      would silently restore the bug this plugin exists to fix.
 *   3. `configureServer` — serves the same file at `/hk-boot-chrome.js` in dev
 *      (Vite only serves `public/` files otherwise, and the script ships inside
 *      the package instead).
 *
 * Usage (from the `./plugins` entry — NOT the browser-facing main entry: that
 * one is imported by app bundles, and a `new URL(..., import.meta.url)` asset
 * reference there would ship this script a second time in every consumer's
 * build, see the note in `src/index.ts`):
 * ```ts
 * import { bootChromePlugin } from "@celestia-island/hikari/plugins";
 * // vite.config.ts
 * plugins: [vue(), bootChromePlugin({ title: "Shittim Chest" })],
 * ```
 */

/** File name the bar is emitted and served under (output-dir root). */
export const BOOT_CHROME_SCRIPT = "hk-boot-chrome.js";

/** URL the injected `<script src>` points at (served at the site root). */
export const BOOT_CHROME_URL = `/${BOOT_CHROME_SCRIPT}`;

/**
 * `src/res/boot-chrome.js` resolved from THIS module. `new URL(..., import.meta.url)`
 * is the only form that holds in both worlds: the repository (`src/plugins` →
 * `src/res`) and the installed npm package (`files` ships `src/`, so the same
 * relative layout survives).
 */
const SOURCE_FILE = new URL("../res/boot-chrome.js", import.meta.url);

export interface BootChromePluginOptions {
  /** Application name on the left of the bar (default: `document.title`). */
  title?: string;
  /** Bar height in px; `boot-chrome.js` clamps it to 20..64 (default 32). */
  height?: number;
  /** Watchdog delay in ms before the reload affordance appears (default 20000). */
  hangMs?: number;
}

/** Quote a number for a `data-*` attribute, or null when it is not a real value. */
function numberAttr(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return String(Math.round(value));
}

export function bootChromePlugin(
  options: BootChromePluginOptions = {},
): Plugin {
  let cached: string | null = null;

  /**
   * Read the boot script. `node:fs` is imported DYNAMICALLY because this module
   * is re-exported from the package's browser-facing entry (`src/index.ts`): a
   * static `node:fs` import there would break every consumer's dev server and
   * browser build. The import only ever runs inside a Vite config/build (Node).
   */
  function loadSource(fresh = false): Promise<string> {
    if (!fresh && cached !== null) return Promise.resolve(cached);
    return import("node:fs").then((fs) => {
      try {
        cached = fs.readFileSync(SOURCE_FILE, "utf8");
        return cached;
      } catch (err) {
        throw new Error(
          `[hikari boot-chrome] cannot read ${SOURCE_FILE.href}: ${
            (err as Error)?.message ?? String(err)
          }`,
        );
      }
    });
  }

  /** The injected tag's attributes — only the options the host actually set. */
  function attributes(): Record<string, string> {
    const attrs: Record<string, string> = { src: BOOT_CHROME_URL };
    if (typeof options.title === "string" && options.title) {
      attrs["data-hk-title"] = options.title;
    }
    const height = numberAttr(options.height);
    if (height !== null) attrs["data-hk-height"] = height;
    const hangMs = numberAttr(options.hangMs);
    if (hangMs !== null) attrs["data-hk-hang-ms"] = hangMs;
    return attrs;
  }

  return {
    name: "hikari-boot-chrome",

    // Read once, early: a package that lost `src/res` fails at the start of the
    // build instead of shipping an index.html whose boot bar 404s.
    buildStart() {
      return loadSource().then(() => undefined);
    },

    // The asset rides the bundle, so `outDir` and `base` stay the host's
    // business: the URL in index.html is root-absolute and the file is always
    // emitted next to it.
    generateBundle() {
      return loadSource().then((source) => {
        this.emitFile({
          type: "asset",
          fileName: BOOT_CHROME_SCRIPT,
          source,
        });
      });
    },

    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: attributes(),
          injectTo: "body-prepend" as const,
        },
      ];
    },

    configureServer(server) {
      // Honour a non-root base as well: the injected URL is root-absolute, but
      // hosts configured under a sub-path may request the prefixed form.
      const base = server.config.base || "/";
      const prefixed =
        base === "/" ? BOOT_CHROME_URL : `${base.replace(/\/+$/, "")}${BOOT_CHROME_URL}`;

      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (path !== BOOT_CHROME_URL && path !== prefixed) {
          next();
          return;
        }
        loadSource(true).then(
          (source) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Content-Length", Buffer.byteLength(source));
            if (req.method === "HEAD") {
              res.end();
              return;
            }
            res.end(source);
          },
          (err) => next(err as Error),
        );
      });
    },
  };
}
