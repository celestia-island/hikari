// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

/**
 * `bootRecoveryPlugin` / `bootRecoveryScript` — ship hikari's pre-boot
 * self-recovery layer for the main application window.
 *
 * WHY THIS EXISTS (the 0.6.8 incident reported against a host shell): a Tauri
 * WebView2 renderer died, the shell's crash recovery reloaded the main window,
 * and it came back on `http://tauri.localhostundefined/` — an origin that still
 * serves `index.html` (the embedded asset handler ignores the bogus host
 * suffix) but resolves every asset URL and the IPC channel against the wrong
 * origin. The module graph never loads, the app never mounts, and the host's
 * static loading screen sits on screen forever — with no way for the user to
 * tell a slow boot from a dead one.
 *
 * The recovery is ONE inline, framework-free script placed in the page's
 * `<head>`, with two independent halves (the second one optional):
 *
 *   1. ORIGIN HEAL (always on) — when the observed hostname is the configured
 *      origin's hostname with crash-recovery debris glued onto it, replace the
 *      location with the canonical origin. The window recovers by itself,
 *      without user action.
 *   2. BOOT WATCHDOG (default on) — after `deadlineMs`, check whether the
 *      host's loading element is still in the document. If it is (and does not
 *      carry the dismissal class), nothing mounted: replace its contents with a
 *      minimal message + retry panel. The retry button re-checks the origin,
 *      then heals or reloads. Reloading is ALWAYS user-triggered — a
 *      permanently broken build must never reload-loop. `loadingScreen: false`
 *      turns this half off (heal-only mode, for hosts with their own fatal
 *      landing page).
 *
 * WHY INLINE, WHY CLASSIC, WHY END OF `<head>`:
 *   - Inline: the heal must not depend on a second HTTP request, which could
 *     404 on exactly the mangled origin it exists to repair.
 *   - Classic (not `type="module"`): a classic inline script executes during
 *     parsing, while module scripts are deferred — the heal lands before the
 *     app bundle without needing the (broken) module graph.
 *   - `injectTo: "head"` is the DEFAULT: Vite appends the tag at the end of
 *     `<head>`, i.e. AFTER the host's `<meta charset>`. The HTML encoding
 *     prescan only honours a charset declaration within the first 1024 bytes,
 *     and this script is a few kilobytes — prepending it would push the
 *     declaration out of that window, so a `text/html` response without a
 *     charset parameter would fall back to a platform guess. `head-prepend` is
 *     available for hosts that send an explicit charset header and want the
 *     heal even earlier; it is documented as charset-unsafe.
 *
 * WHY A SELF-CONTAINED `.mjs` (not TypeScript): a CONSUMER loads this module
 * from `node_modules` while resolving `vite.config.*`, where Node refuses type
 * stripping (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`) and Vite's
 * `configLoader: "runner"` may have torn its module runner down before plugin
 * hooks run. The implementation therefore uses static imports only, and in fact
 * needs nothing from Node but `basename`; types live next door in
 * `boot-recovery.d.mts`. `boot-recovery.install.test.ts` imports the file from
 * a simulated npm install in a child node process — the guard that keeps it
 * that way.
 *
 * THE GENERATED SCRIPT'S CONTRACT (also the host-CSP contract):
 *   deterministic — the same options always produce byte-identical text, so a
 *     host can SHA-256 it into its own Content-Security-Policy;
 *   ASCII-only — encoded text is \uXXXX-escaped and a custom
 *     `isMangledOrigin` source must be ASCII (validated), because the host may
 *     serve `text/html` without a charset parameter;
 *   a single classic IIFE — no imports, no `</script`, no `<!--`;
 *   inert — reads nothing from the page beyond `location.protocol` and
 *     `location.hostname`, builds the panel with DOM APIs + `textContent` (no
 *     `innerHTML`), never auto-reloads and never throws (every runtime step is
 *     guarded);
 *   self-contained — every value it formats comes from the options, so a
 *     crafted URL cannot steer the heal target or the copy.
 *
 * LOCALE SELECTION (opt-in via `copy.locales`): a host that ships a locale
 * table gets a failure panel whose copy is picked at PAGE runtime, before any
 * framework (and any app i18n) exists. The generated script consults, in
 * order — mirroring the boot-chrome family's stored → OS prefs → navigator →
 * English fallback:
 *
 *   1. `copy.storageKey` — the host's saved UI locale tag in `localStorage`
 *      (the user's explicit in-app choice outranks everything; WoWSP stores
 *      `wowsp-ui-locale`);
 *   2. the shell's OS preference, read from `window[osPrefsGlobal]` (default
 *      `__CELESTIA_OS_PREFS__`, the boot-chrome family global; an explicit
 *      `""` disables the source);
 *   3. `navigator.languages`, then `navigator.language`;
 *   4. none of the above matched: the English fallback copy.
 *
 * Each candidate tag is matched against the table exactly first, then with
 * trailing subtags progressively stripped (`zh-hant-cn` → `zh-hant` →
 * `zh`), then by its primary subtag alone. When several table keys share a
 * primary subtag, the FIRST key in the host's insertion order wins
 * (`zh-CN` listed before `zh-TW` means a `zh-HK` request resolves to the
 * zh-CN entry).
 *
 * BYTE-COMPAT: a host that does NOT configure `copy.locales` gets a script
 * byte-identical to the pre-locale implementation — none of the selection
 * code is emitted, so a host that hashed the single-copy script into its CSP
 * keeps its old hash.
 *
 * Usage (the `/plugins/boot-recovery` subpath is the ONLY supported import for
 * consumers — it resolves to this file, not to the package's TypeScript
 * sources):
 * ```ts
 * import { bootRecoveryPlugin } from "@celestia-island/hikari/plugins/boot-recovery";
 * // vite.config.ts
 * plugins: [vue(), bootRecoveryPlugin()],
 * ```
 */

import { basename } from "node:path";

/** The canonical Tauri app origin on Windows/Android. */
export const BOOT_RECOVERY_CANONICAL_ORIGIN = "http://tauri.localhost";

/** Default watchdog delay in ms (a ceiling, not a budget — see the module doc). */
export const BOOT_RECOVERY_DEADLINE_MS = 15000;

/** Default selector of the host's static loading element. */
export const BOOT_RECOVERY_LOADING_SELECTOR = "#loading-screen";

/** Default class that marks a loading element as already dismissed. */
export const BOOT_RECOVERY_DISMISSED_CLASS = "hidden";

/** Default failure-panel copy (English; overridable through `copy`). */
export const BOOT_RECOVERY_MESSAGE =
  "The app did not finish loading. Reloading usually fixes it.";
export const BOOT_RECOVERY_RETRY = "Reload";

/**
 * The injected tag's marker attribute. A host that hashes the inline script
 * into its CSP can find the exact tag it must whitelist by this attribute.
 */
export const BOOT_RECOVERY_ATTR = "data-hk-boot-recovery";

/**
 * Frozen snapshot of the defaults — useful for hosts that render their own
 * loading screen and for tests. `loadingScreen: false` is the heal-only mode.
 */
export const BOOT_RECOVERY_DEFAULTS = Object.freeze({
  canonicalOrigin: BOOT_RECOVERY_CANONICAL_ORIGIN,
  deadlineMs: BOOT_RECOVERY_DEADLINE_MS,
  loadingScreen: Object.freeze({
    selector: BOOT_RECOVERY_LOADING_SELECTOR,
    dismissedClass: BOOT_RECOVERY_DISMISSED_CLASS,
  }),
  copy: Object.freeze({
    message: BOOT_RECOVERY_MESSAGE,
    retry: BOOT_RECOVERY_RETRY,
  }),
  injectTo: "head",
});

/** The HTML entry instrumented when `htmlFiles` is not configured. */
const DEFAULT_HTML_FILE = "index.html";

/**
 * JSON-encode a value for embedding into the generated inline script, and make
 * the result ASCII-only.
 *
 * Two transformations on top of `JSON.stringify`:
 *
 *   - every non-ASCII code unit becomes a `\uXXXX` escape, so a host-provided
 *     copy string ("加载失败…", an em dash, …) can never make the generated
 *     script non-ASCII — and JS line separators (U+2028/U+2029) can never
 *     break an ES2017 parser;
 *   - "`<`" becomes `\u003c`, so no string value can produce a literal
 *     `</script` (or `<!--`) that would terminate the inline tag early.
 *
 * The runtime value is unchanged: the escapes decode back to the same text.
 *
 * @param {unknown} value
 * @returns {string}
 */
function jsonAscii(value) {
  return JSON.stringify(String(value))
    .replace(/[\u007f-\uffff]/g, (char) => {
      return "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0");
    })
    .replace(/</g, "\\u003c");
}

/**
 * Serialise the locale table as the generated script's `COPY_TABLE` literal:
 * a JSON array of `[tag, message, retry]` triples, every string through
 * `jsonAscii` (CJK becomes \uXXXX escapes, no `</script` can survive), so
 * the generated script stays ASCII-only and byte-deterministic.
 *
 * @param {Array<[string, string, string]>} triples
 * @returns {string}
 */
function copyTableLiteral(triples) {
  const rows = [];
  for (const triple of triples) {
    rows.push(
      "[" +
        jsonAscii(triple[0]) +
        "," +
        jsonAscii(triple[1]) +
        "," +
        jsonAscii(triple[2]) +
        "]",
    );
  }
  return "[" + rows.join(",") + "]";
}

/**
 * JSON literal for a nullable string option: a bare `null`, not the string
 * `"null"` (`jsonAscii` stringifies).
 *
 * @param {string | null} value
 * @returns {string}
 */
function jsonLiteral(value) {
  return value === null ? "null" : jsonAscii(value);
}

/**
 * Hostname of an absolute http(s) canonical origin.
 *
 * Config-time validation instead of a runtime surprise: the predicate needs the
 * hostname, and a relative/invalid origin would otherwise produce a script that
 * can never heal. Throws a config error (the plugin is created while Vite
 * resolves the config, so this fails the build loudly).
 *
 * @param {string} canonicalOrigin
 * @returns {string}
 */
function canonicalHostname(canonicalOrigin) {
  let url;
  try {
    url = new URL(canonicalOrigin);
  } catch (err) {
    throw new Error(
      "[hikari boot-recovery] canonicalOrigin must be an absolute http(s) URL, got " +
        JSON.stringify(canonicalOrigin),
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      "[hikari boot-recovery] canonicalOrigin must use http: or https:, got " +
        JSON.stringify(canonicalOrigin),
    );
  }
  return url.hostname;
}

/**
 * Reject text that cannot ride inside the classic inline `<script>` tag.
 *
 * ASCII is a hard requirement (charset-prescan safety + a host may hash the
 * generated script into its CSP as bytes); `</script` and `<!--` would end or
 * comment out the tag. Only used for host-supplied function SOURCE — option
 * strings are escaped by `jsonAscii` instead.
 *
 * @param {string} label
 * @param {string} source
 */
function assertInlineAscii(label, source) {
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) > 0x7f) {
      throw new Error(
        "[hikari boot-recovery] " + label + " must be ASCII-only; it is inlined " +
          "into the generated script, which a host may hash into a CSP (offending " +
          "character at index " + i + ")",
      );
    }
  }
  const lower = source.toLowerCase();
  if (lower.indexOf("</script") !== -1 || lower.indexOf("<!--") !== -1) {
    throw new Error(
      "[hikari boot-recovery] " + label + " must not contain </script or <!--",
    );
  }
}

/**
 * Serialise a custom `isMangledOrigin` predicate into inline-script source.
 *
 * The predicate runs in the PAGE, not in the config, so it is embedded by
 * source text (`Function.prototype.toString`). That makes the caller
 * responsible for a self-contained, ES2017-safe function: no closure references,
 * no method shorthand (not a valid expression), no TypeScript-only syntax. The
 * validation here compiles the source as an expression (catching method
 * shorthand / syntax errors) and enforces the ASCII + tag-safety rules.
 *
 * @param {Function} predicate
 * @returns {string}
 */
function predicateSource(predicate) {
  const source = Function.prototype.toString.call(predicate);
  if (!source || source.indexOf("[native code]") !== -1) {
    throw new Error(
      "[hikari boot-recovery] isMangledOrigin cannot be serialised into the " +
        "inline script (native or bound function); pass a plain function " +
        "expression or arrow function",
    );
  }
  try {
    // Compile-only: the predicate must be a self-contained expression so the
    // generated script can evaluate it verbatim.
    new Function("return (" + source + ");");
  } catch (err) {
    throw new Error(
      "[hikari boot-recovery] isMangledOrigin must be a self-contained function " +
        "expression or arrow function (method shorthand is not serialisable): " +
        ((err && err.message) || err),
    );
  }
  assertInlineAscii("isMangledOrigin", source);
  return source;
}

/**
 * Coerce `deadlineMs`: a positive finite number is rounded; anything else
 * falls back to the default (a bad deadline must never disarm the watchdog
 * silently by becoming NaN).
 *
 * @param {unknown} value
 * @returns {number}
 */
function normaliseDeadline(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : BOOT_RECOVERY_DEADLINE_MS;
}

/**
 * `injectTo` is deliberately limited to two values: the end of `<head>`
 * (default, charset-safe) and the start of `<head>` (charset-unsafe, opt-in).
 *
 * @param {unknown} value
 * @returns {"head" | "head-prepend"}
 */
function normaliseInjectTo(value) {
  return value === "head-prepend" ? "head-prepend" : "head";
}

/**
 * Merge the `copy` overrides over the English defaults.
 *
 * @param {unknown} input
 * @returns {{ message: string, retry: string }}
 */
function normaliseCopy(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    message: typeof raw.message === "string" ? raw.message : BOOT_RECOVERY_MESSAGE,
    retry: typeof raw.retry === "string" ? raw.retry : BOOT_RECOVERY_RETRY,
  };
}

/**
 * Normalise the host's optional locale table.
 *
 * Keys are BCP 47-ish tags; each is trimmed, lowercased and has `_` turned
 * into `-` (so `"zh_CN"` and `"zh-cn"` collide loudly instead of one of
 * them silently shadowing the other). Each entry must be an object carrying
 * non-empty `message` and `retry` strings — a typo must fail the build at
 * config time, not paint an empty panel on a dead boot. The result is an
 * array of `[tag, message, retry]` triples in the host's insertion order
 * (which is the tie-break order for shared primary subtags), or `null`
 * when no table was configured — the single-copy mode keeps the
 * byte-identical script a host may have hashed into its CSP.
 *
 * @param {unknown} locales
 * @returns {Array<[string, string, string]> | null}
 */
function normaliseLocales(locales) {
  if (locales === undefined || locales === null) return null;
  const triples = [];
  const seen = new Map();
  for (const rawKey in locales) {
    if (!Object.prototype.hasOwnProperty.call(locales, rawKey)) continue;
    const tag = String(rawKey).trim().replace(/_/g, "-").toLowerCase();
    if (!tag) {
      throw new Error(
        "[hikari boot-recovery] copy.locales key " +
          JSON.stringify(rawKey) +
          " normalises to an empty locale tag",
      );
    }
    const previous = seen.get(tag);
    if (previous !== undefined) {
      throw new Error(
        "[hikari boot-recovery] copy.locales keys " +
          JSON.stringify(previous) +
          " and " +
          JSON.stringify(rawKey) +
          " normalise to the same locale tag " +
          JSON.stringify(tag),
      );
    }
    const entry = locales[rawKey];
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.message !== "string" ||
      !entry.message ||
      typeof entry.retry !== "string" ||
      !entry.retry
    ) {
      throw new Error(
        "[hikari boot-recovery] copy.locales[" +
          JSON.stringify(tag) +
          "]: copy.locales entries must carry non-empty message and retry strings",
      );
    }
    seen.set(tag, rawKey);
    triples.push([tag, entry.message, entry.retry]);
  }
  return triples.length ? triples : null;
}

/**
 * Normalise `copy.storageKey`: the localStorage key holding the host's
 * saved UI locale tag. It is the FIRST locale source (the user's explicit
 * in-app choice outranks the OS preference and the navigator), so
 * configuring it without a table to consult is a config error, not a silent
 * no-op. An empty/whitespace value is treated as absent.
 *
 * @param {unknown} value
 * @param {boolean} hasTable
 * @returns {string | null}
 */
function normaliseStorageKey(value, hasTable) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (!hasTable) {
    throw new Error(
      "[hikari boot-recovery] copy.storageKey requires copy.locales",
    );
  }
  return value.trim();
}

/**
 * Normalise `osPrefsGlobal`: the name of the `window` global carrying the
 * shell's OS locale preference (`{ locale: string }`). Defaults to the
 * boot-chrome family global; an explicit empty string disables the source
 * (for a host that publishes no such global and does not want one probed).
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normaliseOsPrefsGlobal(value) {
  if (value === "") return null;
  return typeof value === "string" ? value : "__CELESTIA_OS_PREFS__";
}

/**
 * Normalise the loading-screen half: `false` disables it entirely (heal-only
 * mode); an object customises the element selector and the dismissed class.
 * An empty `dismissedClass` disables the dismissed check (a host whose loader
 * has no dismissal marker).
 *
 * @param {unknown} input
 * @returns {{ selector: string, dismissedClass: string } | null}
 */
function normaliseLoadingScreen(input) {
  if (input === false) return null;
  const raw = input && typeof input === "object" ? input : {};
  return {
    selector:
      typeof raw.selector === "string" && raw.selector.trim()
        ? raw.selector.trim()
        : BOOT_RECOVERY_LOADING_SELECTOR,
    dismissedClass:
      typeof raw.dismissedClass === "string"
        ? raw.dismissedClass.trim()
        : BOOT_RECOVERY_DISMISSED_CLASS,
  };
}

/**
 * The single normalisation point behind both public entry points, so
 * `bootRecoveryScript(options)` and the plugin's injected tag can never
 * disagree about what an option means.
 *
 * @param {object | undefined} options
 * @returns {{
 *   canonicalOrigin: string,
 *   canonicalHostname: string,
 *   deadlineMs: number,
 *   predicateSource: string | null,
 *   loadingScreen: { selector: string, dismissedClass: string } | null,
 *   copy: { message: string, retry: string },
 *   copyTable: Array<[string, string, string]> | null,
 *   storageKey: string | null,
 *   osPrefsGlobal: string | null,
 *   injectTo: "head" | "head-prepend",
 * }}
 */
function resolveOptions(options) {
  const input = options && typeof options === "object" ? options : {};
  const canonicalOrigin =
    typeof input.canonicalOrigin === "string" && input.canonicalOrigin.trim()
      ? input.canonicalOrigin.trim()
      : BOOT_RECOVERY_CANONICAL_ORIGIN;
  const copyRaw =
    input.copy && typeof input.copy === "object" ? input.copy : {};
  const copyTable = normaliseLocales(copyRaw.locales);
  return {
    canonicalOrigin: canonicalOrigin,
    canonicalHostname: canonicalHostname(canonicalOrigin),
    deadlineMs: normaliseDeadline(input.deadlineMs),
    predicateSource:
      typeof input.isMangledOrigin === "function"
        ? predicateSource(input.isMangledOrigin)
        : null,
    loadingScreen: normaliseLoadingScreen(input.loadingScreen),
    copy: normaliseCopy(input.copy),
    copyTable: copyTable,
    storageKey: normaliseStorageKey(copyRaw.storageKey, copyTable !== null),
    osPrefsGlobal: normaliseOsPrefsGlobal(input.osPrefsGlobal),
    injectTo: normaliseInjectTo(input.injectTo),
  };
}

/**
 * Does `protocol://hostname` look like the app origin with crash-recovery
 * debris glued onto its hostname?
 *
 * Only http(s) origins can be mangled this way: the observed incident produced
 * `tauri.localhostundefined` (scheme stayed http), and the `tauri://` origins
 * used on macOS/Linux have their own URL space — a `tauri://` URL must never
 * be redirected to an http one. The prefix-plus-inequality check is the whole
 * signal: the canonical host itself is healthy, while any hostname that merely
 * STARTS WITH it is a mangled variant (`tauri.localhostundefined`,
 * `tauri.localhost.`, `tauri.localhostx`). Every other host (dev server,
 * asset/media hosts) is untouched.
 *
 * This is the DEFAULT predicate; a host may pass its own `isMangledOrigin`.
 *
 * @param {string} protocol `location.protocol` (`"http:"`)
 * @param {string} hostname `location.hostname` (`"tauri.localhost"`)
 * @param {string} [canonicalOrigin]
 * @returns {boolean}
 */
export function isMangledOrigin(
  protocol,
  hostname,
  canonicalOrigin = BOOT_RECOVERY_CANONICAL_ORIGIN,
) {
  if (protocol !== "http:" && protocol !== "https:") return false;
  const canonicalHost = canonicalHostname(canonicalOrigin);
  return (
    typeof hostname === "string" &&
    hostname.indexOf(canonicalHost) === 0 &&
    hostname !== canonicalHost
  );
}

/**
 * Should the recovery script be injected into this HTML entry?
 *
 * Mirrors `bootChromePlugin`'s matcher so hosts learn ONE rule:
 *
 *   - no `htmlFiles`: only the entry whose basename is `index.html`,
 *   - `RegExp`: matched against the entry's file path,
 *   - `string[]`: matched against the basename or the path suffix, so
 *     `"overlay.html"` and `"pages/index.html"` both work.
 *
 * An unknown filename (a non-standard caller) is treated as the main entry —
 * refusing to inject would silently re-open the bug this plugin fixes.
 *
 * @param {string} filename
 * @param {string[] | RegExp | undefined} htmlFiles
 * @returns {boolean}
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
        (entry === name || filename === entry || filename.endsWith("/" + entry)),
    );
  }
  return basename(filename) === DEFAULT_HTML_FILE;
}

/**
 * CSS for the failure panel, injected as one inline `<style>` next to the panel
 * itself. Deliberately SELF-CONTAINED: it styles only hikari's own panel
 * classes, never the host's loading element, so a custom `selector` cannot
 * break out of a stylesheet. The values are hikari's seed tokens written out
 * literally (packages/vue/src/styles/theme/channels.scss + scale.scss): the
 * primary 122 162 247 with its 82%-black hover mix and button shadow, the
 * elevated card shadow, the md/lg radii, the `--font-sans` stack and the
 * text seed 30 30 30. The card carries its own surface — white in the light
 * scheme, the Nord surface rgb(46 52 64) under `prefers-color-scheme: dark`
 * — so the panel stays legible on any backdrop (WoWSP's dark loader paints
 * #0b1220) before any theme engine has loaded.
 */
const FAILURE_PANEL_CSS = [
  ".hk-boot-recovery{display:flex;flex-direction:column;align-items:center;gap:1.25rem;max-width:32rem;padding:2rem 2.5rem;text-align:center;background:#fff;border:1px solid rgb(30 30 30 / 8%);border-radius:12px;box-shadow:0 8px 32px rgb(0 0 0 / 15%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif;color:rgb(30 30 30)}",
  ".hk-boot-recovery__message{margin:0;font-size:.875rem;line-height:1.6}",
  ".hk-boot-recovery__retry{appearance:none;font:inherit;font-size:.875rem;font-weight:600;padding:.5rem 1.5rem;border:0;border-radius:8px;background:rgb(122 162 247);color:#fff;cursor:pointer;box-shadow:0 4px 14px rgb(122 162 247 / 35%);transition:background .15s cubic-bezier(.4,0,.2,1),box-shadow .15s cubic-bezier(.4,0,.2,1)}",
  ".hk-boot-recovery__retry:hover{background:rgb(100 133 203)}",
  ".hk-boot-recovery__retry:active{background:rgb(83 111 167)}",
  ".hk-boot-recovery__retry:focus-visible{outline:none;box-shadow:0 0 0 3px rgb(122 162 247 / 25%)}",
  "@media (prefers-color-scheme:dark){.hk-boot-recovery{background:rgb(46 52 64);border-color:rgb(255 255 255 / 8%);box-shadow:0 8px 32px rgb(0 0 0 / 45%);color:rgb(216 222 233)}}",
].join("\n");

/**
 * The whole recovery as one compact, dependency-free inline IIFE — the exact
 * text the plugin injects (and the string a non-Tauri host can hash into its
 * own CSP).
 *
 * No page input: the only values embedded are the normalised options,
 * JSON-escaped (`jsonAscii`). The runtime reads exactly `location.protocol`
 * and `location.hostname` — never the path, query or hash — and writes only
 * option text through `textContent`, so a crafted URL cannot steer the heal
 * target or the panel copy. It never throws: every runtime step that can fail
 * sits in a `try`/`catch`, because the one screen it replaces is the only
 * feedback a broken boot has left.
 *
 * Two shapes, chosen by `loadingScreen`:
 *
 *   - watchdog mode (default): heal half + watchdog + panel;
 *   - heal-only mode (`loadingScreen: false`): heal half only — no timer, no
 *     panel, no reload path at all.
 *
 * Every line is pushed literally (no dynamic key order) so the output is
 * deterministic for a given normalised option set.
 *
 * @param {object} [options] — see `bootRecoveryPlugin`
 * @returns {string}
 */
export function bootRecoveryScript(options = {}) {
  const resolved = resolveOptions(options);
  const lines = [];

  lines.push("(function () {");
  lines.push('  "use strict";');
  lines.push(
    "  var CANONICAL_ORIGIN = " + jsonAscii(resolved.canonicalOrigin) + ";",
  );
  lines.push(
    "  var APP_HOSTNAME = " + jsonAscii(resolved.canonicalHostname) + ";",
  );
  if (resolved.loadingScreen) {
    lines.push("  var DEADLINE_MS = " + resolved.deadlineMs + ";");
    lines.push(
      "  var LOADING_SELECTOR = " +
        jsonAscii(resolved.loadingScreen.selector) +
        ";",
    );
    lines.push(
      "  var DISMISSED_CLASS = " +
        jsonAscii(resolved.loadingScreen.dismissedClass) +
        ";",
    );
    lines.push("  var COPY_MESSAGE = " + jsonAscii(resolved.copy.message) + ";");
    lines.push("  var COPY_RETRY = " + jsonAscii(resolved.copy.retry) + ";");
    if (resolved.copyTable) {
      lines.push("  var COPY_FALLBACK = [COPY_MESSAGE, COPY_RETRY];");
      lines.push(
        "  var COPY_TABLE = " + copyTableLiteral(resolved.copyTable) + ";",
      );
      lines.push(
        "  var STORAGE_KEY = " + jsonLiteral(resolved.storageKey) + ";",
      );
      lines.push(
        "  var OS_PREFS_GLOBAL = " + jsonLiteral(resolved.osPrefsGlobal) + ";",
      );
    }
    lines.push("  var PANEL_CSS = " + jsonAscii(FAILURE_PANEL_CSS) + ";");
  }
  lines.push("");
  lines.push(
    "  /* The mangled-origin predicate. With a custom isMangledOrigin this is",
  );
  lines.push(
    "     the host's own self-contained source; otherwise it mirrors",
  );
  lines.push("     isMangledOrigin() from boot-recovery.mjs. */");
  if (resolved.predicateSource) {
    lines.push("  var isMangled = (" + resolved.predicateSource + ");");
  } else {
    lines.push("  function isMangled(protocol, hostname) {");
    lines.push('    if (protocol !== "http:" && protocol !== "https:") return false;');
    lines.push(
      "    return hostname.indexOf(APP_HOSTNAME) === 0 && hostname !== APP_HOSTNAME;",
    );
    lines.push("  }");
  }
  lines.push("");
  lines.push("  function originIsMangled() {");
  lines.push("    try {");
  lines.push(
    "      return isMangled(location.protocol, location.hostname) === true;",
  );
  lines.push("    } catch (e) {");
  lines.push("      return false;");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push(
    "  /* Returns true when the navigation was accepted (the document is about",
  );
  lines.push(
    "     to be replaced and the caller must stop), false when it threw. */",
  );
  lines.push("  function openCanonical() {");
  lines.push("    try {");
  lines.push('      location.replace(CANONICAL_ORIGIN + "/");');
  lines.push("      return true;");
  lines.push("    } catch (e) {");
  lines.push("      return false;");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push(
    "  /* ---- 1. origin heal: restore the app origin before the bundle runs -- */",
  );
  lines.push("  if (originIsMangled()) {");
  lines.push("    if (openCanonical()) return;");
  lines.push(
    "    /* Navigation refused before it started: fall through to the watchdog",
  );
  lines.push(
    "       (when enabled) so its retry button can attempt the same heal. */",
  );
  lines.push("  }");
  if (resolved.loadingScreen) {
    lines.push("");
    lines.push(
      "  /* ---- 2. boot watchdog: a still-present loader means nothing mounted -- */",
    );
    lines.push("  setTimeout(function () {");
    lines.push("    try {");
    lines.push("      var loading = document.querySelector(LOADING_SELECTOR);");
    lines.push(
      "      if (!loading) return; /* mounted: the host removed the loader */",
    );
    lines.push(
      "      if (DISMISSED_CLASS && loading.classList && loading.classList.contains(DISMISSED_CLASS)) return;",
    );
    lines.push("      showFailure(loading);");
    lines.push("    } catch (e) {");
    lines.push("      /* Never let the fallback break the last screen left. */");
    lines.push("    }");
    lines.push("  }, DEADLINE_MS);");
    lines.push("");
    lines.push("  function retry() {");
    lines.push("    if (originIsMangled()) {");
    lines.push("      openCanonical();");
    lines.push("      return;");
    lines.push("    }");
    lines.push("    location.reload();");
    lines.push("  }");
    lines.push("");
    if (resolved.copyTable) {
      lines.push("  /* Panel copy locale sources, first match wins (mirrors boot-chrome's");
      lines.push("     stored -> OS prefs -> navigator -> English fallback order):");
      lines.push("     1. localStorage[STORAGE_KEY] - the host's saved UI locale, the");
      lines.push("        user's explicit in-app choice, outranks everything;");
      lines.push("     2. window[OS_PREFS_GLOBAL].locale - the shell's OS preference;");
      lines.push("     3. navigator.languages, then navigator.language;");
      lines.push("     4. no match - the English fallback pair (COPY_FALLBACK).");
      lines.push("     Each candidate tag is matched against COPY_TABLE exactly, then");
      lines.push("     with trailing subtags progressively stripped, then by its");
      lines.push("     primary subtag alone; entries sharing a primary subtag resolve");
      lines.push("     to the FIRST one the host listed. The winning entry is returned");
      lines.push("     as its [message, retry] pair, like COPY_FALLBACK. */");
      lines.push("  function localeKey(tag, drop) {");
      lines.push('    var parts = String(tag).replace(/_/g, "-").toLowerCase().split("-");');
      lines.push("    if (drop >= parts.length) return null;");
      lines.push('    return parts.slice(0, parts.length - drop).join("-");');
      lines.push("  }");
      lines.push("  function tableHit(key) {");
      lines.push("    for (var i = 0; i < COPY_TABLE.length; i++) {");
      lines.push("      if (COPY_TABLE[i][0] === key) return COPY_TABLE[i];");
      lines.push("    }");
      lines.push("    return null;");
      lines.push("  }");
      lines.push("  function primaryHit(tag) {");
      lines.push('    var primary = String(tag).replace(/_/g, "-").toLowerCase().split("-")[0];');
      lines.push("    for (var i = 0; i < COPY_TABLE.length; i++) {");
      lines.push('      if (COPY_TABLE[i][0].split("-")[0] === primary) return COPY_TABLE[i];');
      lines.push("    }");
      lines.push("    return null;");
      lines.push("  }");
      lines.push("  function pickCopy() {");
      lines.push("    var candidates = [];");
      lines.push("    if (STORAGE_KEY) {");
      lines.push("      try {");
      lines.push("        var stored = localStorage.getItem(STORAGE_KEY);");
      lines.push('        if (typeof stored === "string" && stored) candidates.push(stored);');
      lines.push("      } catch (e) {}");
      lines.push("    }");
      lines.push('    if (OS_PREFS_GLOBAL && typeof window !== "undefined") {');
      lines.push("      try {");
      lines.push("        var prefs = window[OS_PREFS_GLOBAL];");
      lines.push('        if (prefs && typeof prefs.locale === "string") candidates.push(prefs.locale);');
      lines.push("      } catch (e) {}");
      lines.push("    }");
      lines.push('    if (typeof navigator !== "undefined") {');
      lines.push("      try {");
      lines.push("        if (navigator.languages && navigator.languages.length) {");
      lines.push("          for (var i = 0; i < navigator.languages.length; i++) {");
      lines.push('            if (typeof navigator.languages[i] === "string" && navigator.languages[i]) {');
      lines.push("              candidates.push(navigator.languages[i]);");
      lines.push("            }");
      lines.push("          }");
      lines.push("        }");
      lines.push('        if (typeof navigator.language === "string" && navigator.language) {');
      lines.push("          candidates.push(navigator.language);");
      lines.push("        }");
      lines.push("      } catch (e) {}");
      lines.push("    }");
      lines.push("    for (var c = 0; c < candidates.length; c++) {");
      lines.push("      var hit = tableHit(localeKey(candidates[c], 0));");
      lines.push("      if (hit) return [hit[1], hit[2]];");
      lines.push('      var parts = String(candidates[c]).replace(/_/g, "-").toLowerCase().split("-");');
      lines.push("      for (var drop = 1; drop < parts.length; drop++) {");
      lines.push("        hit = tableHit(localeKey(candidates[c], drop));");
      lines.push("        if (hit) return [hit[1], hit[2]];");
      lines.push("      }");
      lines.push("      hit = primaryHit(candidates[c]);");
      lines.push("      if (hit) return [hit[1], hit[2]];");
      lines.push("    }");
      lines.push("    return null;");
      lines.push("  }");
    }
    lines.push(
      "  /* Replace the loader's contents with the failure panel. Built from",
    );
    lines.push(
      "     constant strings through DOM APIs only: no markup parsing and no",
    );
    lines.push("     page input, so there is nothing to escape or inject. */");
    lines.push("  function showFailure(loading) {");
    lines.push('    loading.textContent = "";');
    lines.push('    var style = document.createElement("style");');
    lines.push("    style.textContent = PANEL_CSS;");
    lines.push('    var box = document.createElement("div");');
    lines.push('    box.className = "hk-boot-recovery";');
    lines.push('    box.setAttribute("role", "alert");');
    lines.push('    var message = document.createElement("p");');
    lines.push('    message.className = "hk-boot-recovery__message";');
    if (resolved.copyTable) {
      lines.push("    var copy = pickCopy() || COPY_FALLBACK;");
      lines.push("    message.textContent = copy[0];");
    } else {
      lines.push("    message.textContent = COPY_MESSAGE;");
    }
    lines.push('    var button = document.createElement("button");');
    lines.push('    button.type = "button";');
    lines.push('    button.className = "hk-boot-recovery__retry";');
    lines.push(
      resolved.copyTable
        ? "    button.textContent = copy[1];"
        : "    button.textContent = COPY_RETRY;",
    );
    lines.push('    button.addEventListener("click", retry);');
    lines.push("    box.appendChild(message);");
    lines.push("    box.appendChild(button);");
    lines.push("    loading.appendChild(style);");
    lines.push("    loading.appendChild(box);");
    lines.push("  }");
  }
  lines.push("})();");
  return lines.join("\n");
}

/**
 * The recovery as a Vite plugin: ONE inline, classic (non-module) `<script>`
 * carrying `data-hk-boot-recovery`, injected into the configured HTML entries.
 *
 * MULTI-ENTRY: by default only the entry whose basename is `index.html` is
 * instrumented. A shell that builds more than one page (a host builds five;
 * four are transparent overlay windows) must say which entries are real app
 * windows: `htmlFiles: ["index.html", "overlay-main.html"]` or
 * `htmlFiles: /^index\.html$/`. A failure panel injected into an overlay page
 * would paint over the game, and an ORIGIN HEAL would reload a transparent
 * window mid-battle — both are exactly the wrong recovery.
 *
 * Every skipped entry is reported ONCE in the build log (`this.warn`), so
 * forgetting the list cannot silently ship a window without the recovery.
 *
 * `injectTo` defaults to `"head"` (end of `<head>`, after the charset
 * declaration — see the module doc); `"head-prepend"` is the documented
 * charset-unsafe opt-in. There is no `apply: "build"`: dev serves the same
 * HTML through this hook, and a dev page that never mounts deserves the same
 * watchdog feedback.
 *
 * @param {{
 *   htmlFiles?: string[] | RegExp,
 *   loadingScreen?: { selector?: string, dismissedClass?: string } | false,
 *   deadlineMs?: number,
 *   canonicalOrigin?: string,
 *   osPrefsGlobal?: string,
 *   isMangledOrigin?: (protocol: string, hostname: string) => boolean,
 *   copy?: {
 *     message?: string,
 *     retry?: string,
 *     locales?: Record<string, { message: string, retry: string }>,
 *     storageKey?: string,
 *   },
 *   injectTo?: "head" | "head-prepend",
 *   }} [options]
 * @returns {import("vite").Plugin}
 */
export function bootRecoveryPlugin(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  // Entries we deliberately left alone. Warned once each: a multi-window host
  // that forgot `htmlFiles` would otherwise ship a window whose boot can hang
  // with no recovery and nothing in the build log to explain it.
  const skipped = new Set();

  /** Tell the host (once per entry) why this page got no recovery script. */
  function warnSkipped(context, filename) {
    const key = filename || "<unknown entry>";
    if (skipped.has(key)) return;
    skipped.add(key);
    const message =
      '[hikari boot-recovery] skipped "' +
      basename(key) +
      '": the boot recovery script is only injected into entries listed by ' +
      "htmlFiles (default: index.html). Add this entry to htmlFiles if it is " +
      "an app window.";
    if (context && typeof context.warn === "function") context.warn(message);
    else console.warn(message);
  }

  // Resolve options once, eagerly: a bad canonicalOrigin / unserialisable
  // predicate must fail while the config is resolved, not on the first page
  // transform (where a host may never notice the stack).
  resolveOptions(opts);

  return {
    name: "hikari-boot-recovery",

    transformIndexHtml(_html, ctx) {
      const filename = ctx && typeof ctx.filename === "string" ? ctx.filename : "";
      if (!htmlFileMatches(filename, opts.htmlFiles)) {
        warnSkipped(this, filename);
        return [];
      }
      return [
        {
          tag: "script",
          attrs: { [BOOT_RECOVERY_ATTR]: "" },
          children: bootRecoveryScript(opts),
          injectTo: normaliseInjectTo(opts.injectTo),
        },
      ];
    },
  };
}
