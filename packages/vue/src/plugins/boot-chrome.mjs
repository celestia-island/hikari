import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `bootChromePlugin` — ship hikari's pre-boot window caption bar.
 *
 * A Tauri shell with `decorations: false` has no OS title bar, and the app's own
 * chrome is a Vue component: between first paint and mount the window cannot be
 * moved, minimised or closed. `../res/boot-chrome.js` closes that gap with a
 * framework-free bar that exists from the first frame and hands the window over
 * when the app claims it (`hk:chrome-claim`).
 *
 * WHY THIS FILE IS A SELF-CONTAINED `.mjs` (not TS, no dynamic imports):
 * this module is what a CONSUMER loads from `node_modules` inside their
 * `vite.config.*`. Node refuses to strip types from files under `node_modules`
 * (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), and Vite's alternative
 * `configLoader: "runner"` executes the config in a module runner that is torn
 * down after config resolution — a lazy `import("node:fs")` from a plugin hook
 * then dies with "Vite module runner has been closed". Both were observed with
 * the packed package (Vite 8.3.2). Static imports only, plain ESM only.
 * Types live next door in `boot-chrome.d.mts`; the regression test
 * `boot-chrome.install.test.ts` imports this file from a simulated npm install
 * in a child Node process, which is the check that keeps it that way.
 *
 * WHAT IT DOES:
 *
 *   1. `transformIndexHtml` — injects `<script src="<base>/hk-boot-chrome.js">`
 *      at `body-prepend`, ahead of the loading screen and the module entry. It
 *      is a CLASSIC script on purpose: the bar must not wait for the module
 *      graph. Configuration rides the tag's `data-hk-*` attributes because a
 *      host CSP is usually `script-src 'self'` (inline config never executes).
 *
 *      MULTI-ENTRY: by default only the entry whose basename is `index.html` is
 *      instrumented. A shell that builds more than one page (wowsp builds five;
 *      four are transparent overlay windows) must say which entries are the
 *      real app windows: `htmlFiles: ["index.html", "overlay-main.html"]` or
 *      `htmlFiles: /^index\.html$/`. Injecting into an overlay page paints a
 *      caption bar inside a transparent window.
 *
 *   2. `buildStart` / `generateBundle` — reads `../res/boot-chrome.js` and
 *      emits it as an asset at the output root, so the injected URL resolves in
 *      the built app. A missing source fails the build loudly: a 404 boot bar
 *      would silently restore the bug this plugin exists to fix.
 *
 *   3. `configureServer` — serves the same file at `<base>/hk-boot-chrome.js`
 *      in dev (Vite only serves `public/` files otherwise, and the script ships
 *      inside the package instead).
 *
 * KNOWN PRECONDITIONS (host-side, documented rather than enforced):
 *   - `boot-chrome.js` injects its own `<style>` element, so the host CSP needs
 *     `style-src 'unsafe-inline'` (the Tauri shells in the family allow it).
 *   - macOS hosts that render only `HkWindowControls` never dispatch
 *     `hk:chrome-claim` (the component renders nothing on Apple platforms: the
 *     OS owns the traffic lights), so such a host must call
 *     `claimWindowChrome()` itself. Windows targets (chest, wowsp) are not
 *     affected.
 *
 * Usage (the `/plugins/boot-chrome` subpath is the ONLY supported import for
 * consumers — it resolves to this file, not to the package's TypeScript
 * sources):
 * ```ts
 * import { bootChromePlugin } from "@celestia-island/hikari/plugins/boot-chrome";
 * // vite.config.ts
 * plugins: [vue(), bootChromePlugin({ title: "Shittim Chest" })],
 * ```
 */

/** File name the bar is emitted and served under (output-dir root). */
export const BOOT_CHROME_SCRIPT = "hk-boot-chrome.js";

/** Root-absolute default URL the injected `<script src>` points at. */
export const BOOT_CHROME_URL = `/${BOOT_CHROME_SCRIPT}`;

/** The entry instrumented when `htmlFiles` is not configured. */
const DEFAULT_HTML_FILE = "index.html";

/**
 * `src/res/boot-chrome.js` resolved from THIS module. `new URL(..., import.meta.url)`
 * is the only form that holds in both worlds: the repository (`src/plugins` →
 * `src/res`) and the installed npm package (`files` ships `src/`, so the same
 * relative layout survives).
 */
const SOURCE_FILE = new URL("../res/boot-chrome.js", import.meta.url);

/** Ensure a trailing slash, and treat a missing/empty base as the site root. */
function normalizeBase(base) {
  const value = typeof base === "string" && base ? base : "/";
  return value.endsWith("/") ? value : `${value}/`;
}

/**
 * Should the bar be injected into this HTML entry?
 *
 * - no `htmlFiles`: only the `index.html` entry (the app window),
 * - `RegExp`: matched against the entry's file path,
 * - `string[]`: matched against the basename or the path suffix, so
 *   `"overlay.html"` and `"pages/index.html"` both work.
 *
 * An unknown filename (a non-standard caller) is treated as the main entry —
 * refusing to inject would silently re-open the bug this plugin fixes.
 */
function htmlFileMatches(filename, htmlFiles) {
  if (!filename) return true;
  if (htmlFiles instanceof RegExp) {
    htmlFiles.lastIndex = 0;
    const hit = htmlFiles.test(filename);
    htmlFiles.lastIndex = 0;
    return hit;
  }
  if (Array.isArray(htmlFiles) && htmlFiles.length) {
    const name = basename(filename);
    return htmlFiles.some(
      (entry) =>
        typeof entry === "string" &&
        entry !== "" &&
        (entry === name || filename === entry || filename.endsWith(`/${entry}`)),
    );
  }
  return basename(filename) === DEFAULT_HTML_FILE;
}

/**
 * @param {{
 *   title?: string,
 *   height?: number,
 *   hangMs?: number,
 *   htmlFiles?: string[] | RegExp,
 * }} [options]
 */
export function bootChromePlugin(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  let cached = null;
  let base = "/";

  /** Read the boot script (once per process — a package is not edited at runtime). */
  function source() {
    if (cached !== null) return cached;
    const path = fileURLToPath(SOURCE_FILE);
    try {
      cached = readFileSync(path, "utf8");
      return cached;
    } catch (err) {
      throw new Error(
        `[hikari boot-chrome] cannot read ${path}: ${(err && err.message) || err}`,
      );
    }
  }

  /** Zero-pad a `data-*` number, or null when the host passed nonsense. */
  function numberAttr(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return String(Math.round(value));
  }

  /** The injected tag's attributes — only the options the host actually set. */
  function attributes() {
    const attrs = { src: `${normalizeBase(base)}${BOOT_CHROME_SCRIPT}` };
    if (typeof opts.title === "string" && opts.title) {
      attrs["data-hk-title"] = opts.title;
    }
    const height = numberAttr(opts.height);
    if (height !== null) attrs["data-hk-height"] = height;
    const hangMs = numberAttr(opts.hangMs);
    if (hangMs !== null) attrs["data-hk-hang-ms"] = hangMs;
    return attrs;
  }

  return {
    name: "hikari-boot-chrome",

    // `base` decides the injected URL (sub-path deployments, relative bases);
    // the emitted asset always stays at the output root, which is what that URL
    // resolves to.
    configResolved(config) {
      base = config && typeof config.base === "string" && config.base ? config.base : "/";
    },

    // Read once, early: a package that lost `src/res` fails at the start of the
    // build instead of shipping an index.html whose boot bar 404s.
    buildStart() {
      source();
    },

    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: BOOT_CHROME_SCRIPT,
        source: source(),
      });
    },

    transformIndexHtml(_html, ctx) {
      const filename =
        ctx && typeof ctx.filename === "string" ? ctx.filename : "";
      if (!htmlFileMatches(filename, opts.htmlFiles)) return [];
      return [
        {
          tag: "script",
          attrs: attributes(),
          injectTo: "body-prepend",
        },
      ];
    },

    configureServer(server) {
      // The injected URL is base-prefixed; accept the bare form too so a host
      // that hard-coded the root path keeps working in dev.
      const devBase =
        server && server.config && typeof server.config.base === "string"
          ? normalizeBase(server.config.base)
          : "/";
      const urls = new Set([`${devBase}${BOOT_CHROME_SCRIPT}`, BOOT_CHROME_URL]);

      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!urls.has(path)) {
          next();
          return;
        }
        let body;
        try {
          body = source();
        } catch (err) {
          next(err);
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Content-Length", Buffer.byteLength(body));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        res.end(body);
      });
    },
  };
}
