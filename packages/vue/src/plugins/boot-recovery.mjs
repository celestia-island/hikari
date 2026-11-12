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
 *      carry the dismissal class), nothing mounted: replace its contents with
 *      the shared error landing (see FAILURE PANEL below). The retry button
 *      re-checks the origin, then heals or reloads. Reloading is ALWAYS
 *      user-triggered — a permanently broken build must never reload-loop.
 *      `loadingScreen: false` turns this half off (heal-only mode, for hosts
 *      with their own fatal landing page).
 *
 * FAILURE PANEL — the READY-MADE `HkErrorLanding` surface, not a bespoke card:
 * the panel is the component's pre-framework twin. It renders the same DOM
 * contract the Vue component and hikari's Rust `ErrorLanding` mirror emit
 * (`.hk-error-landing.is-error` → `__card` → `__icon` + `__title` +
 * `__desc` + `__actions` with an `.hk-btn-primary` action), and its
 * stylesheet is compiled from the LIVE component sheets — theme/channels,
 * theme/scale, `HkErrorLanding.scss` and `HkButton.scss` — into
 * `./bootLandingCss.mjs` by `scripts/gen-boot-landing-css.mjs`.
 * `bootLandingCss.test.ts` recompiles that entry and fails whenever the
 * checked-in sheet drifts, so the boot surface cannot fork away from the app's
 * error landing (the pre-0.55.3xx panel hand-rolled `.hk-boot-recovery`
 * classes with literal token values, which is exactly the divergence this
 * module now refuses). The panel is styled INSIDE the host's loading element,
 * never the element itself, so a custom `loadingScreen.selector` stays
 * untouched; dark mode uses hikari's default dark seed palette through the
 * entry's `prefers-color-scheme` block, because no theme engine has run yet.
 *
 * PANEL COPY: `copy.title` is the landing headline (default
 * `BOOT_RECOVERY_TITLE`), `copy.message` its explanation, `copy.retry` the
 * reload label; each locale row may override the title alongside the other
 * two. A row without a title paints the host's default title over localized
 * copy.
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
 * needs nothing from Node but `basename`; the panel stylesheet comes in as a
 * static import of the generated `bootLandingCss.mjs` (plain ESM, no Node
 * API). Types live next door in `boot-recovery.d.mts`.
 * `boot-recovery.install.test.ts` imports the file from a simulated npm
 * install in a child node process — the guard that keeps it that way.
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
 *   4. none of the above matched: the host's `copy` triple (English by
 *      default). A matched row without its own `title` inherits the host's
 *      `copy.title`.
 *
 * Each candidate tag is matched against the table exactly first, then with
 * trailing subtags progressively stripped (`zh-hant-cn` → `zh-hant` →
 * `zh`), then by its primary subtag alone. When several table keys share a
 * primary subtag, the FIRST key in the host's insertion order wins
 * (`zh-CN` listed before `zh-TW` means a `zh-HK` request resolves to the
 * zh-CN entry).
 *
 * BYTE-COMPAT: a host that does NOT configure `copy.locales` gets no locale
 * selection machinery at all — the panel paints the single `copy` triple. The
 * panel restyle itself changed the script bytes for EVERY host in 0.55.357
 * (new DOM, new stylesheet, the title constant), so a host that hashes the
 * inline script into its CSP must refresh that hash with the dependency bump.
 *
 * DIAGNOSTICS (all opt-in, added after that restyle): the panel's remaining
 * layers are gated on their own options, so a host that configures none of them
 * keeps the bytes it already hashed. That is the rule every one of them
 * follows, not a nicety.
 *
 *   - `copy.rawDetailsLabel` — the raw-details pane (see DETAILS above).
 *   - `copy.reasons` — the four-class reason table (timeout / chunk / error /
 *     browser), classified AT PAGE RUNTIME: the watchdog reads the resource
 *     timing table to tell a chunk miss (a boot script that fetched and was
 *     REFUSED — the stale-tab-after-redeploy signature) from a plain timeout,
 *     and a captured error's message is matched against the family's chunk-miss
 *     pattern set.
 *   - `copy.browserBlock` — the unsupported-browser notice, painted in the
 *     landing's `info` tone (a compatibility notice is not a crash) with the
 *     `{browser}` / `{current}` / `{min}` placeholders filled from the call.
 *   - `globals` — the three page globals a host's own boot code drives. They
 *     are the family's LONG-STANDING contract, and all three are defaults of
 *     the hand-rolled `res/fatal-fallback.js` this plugin replaces:
 *     `__appBlock(browser, current, min)` (refuse an unsupported browser),
 *     `__appFatal(message, detail?)` (report a captured pre-mount error) and
 *     `__appReady()` (the app mounted; stand the panel down). Publishing the
 *     same names is what lets a host RETIRE that script instead of losing the
 *     browser gate, the error report and the ready handoff with it.
 *     `__appReady` removes only the nodes this script added — never the host's
 *     loader element, its contents or its dismissal class, which belong to the
 *     host's own loader logic.
 *
 * Every diagnostics read (`performance`, `document.readyState`, `location.href`,
 * the resource table) sits behind those options: the default script stays
 * inert, reading nothing but `location.protocol` and `location.hostname`.
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

import { BOOT_LANDING_CSS } from "./bootLandingCss.mjs";
import { BOOT_LANDING_DETAILS_CSS } from "./bootLandingDetailsCss.mjs";

/** The canonical Tauri app origin on Windows/Android. */
export const BOOT_RECOVERY_CANONICAL_ORIGIN = "http://tauri.localhost";

/** Default watchdog delay in ms (a ceiling, not a budget — see the module doc). */
export const BOOT_RECOVERY_DEADLINE_MS = 15000;

/** Default selector of the host's static loading element. */
export const BOOT_RECOVERY_LOADING_SELECTOR = "#loading-screen";

/** Default class that marks a loading element as already dismissed. */
export const BOOT_RECOVERY_DISMISSED_CLASS = "hidden";

/** Default failure-panel title (English; overridable through `copy.title`). */
export const BOOT_RECOVERY_TITLE = "Application failed to load";

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
 * Default name of the `window` function that raises the browser-block panel.
 * It matches the family's long-standing hand-rolled global (`__appBlock`), so a
 * host's existing browser gate keeps calling the same name after switching to
 * this plugin.
 */
export const BOOT_RECOVERY_BLOCK_GLOBAL = "__appBlock";

/** Default name of the `window` function a host calls to report a captured
 *  boot error (the family's long-standing name). */
export const BOOT_RECOVERY_FATAL_GLOBAL = "__appFatal";

/** Default name of the `window` function a host calls once its app mounted,
 *  so the panel stands down (the family's long-standing name). */
export const BOOT_RECOVERY_READY_GLOBAL = "__appReady";

/** The reason classes the panel can paint, in the family's order. */
export const BOOT_RECOVERY_REASON_KEYS = Object.freeze([
  "timeout",
  "chunk",
  "error",
  "browser",
]);

/**
 * The English default copy per reason class. A host translating the panel
 * overrides these through `copy.reasons`; a reason it leaves out keeps the
 * default here, so no class can ever paint a blank headline.
 */
export const BOOT_RECOVERY_REASONS = Object.freeze({
  timeout: Object.freeze({
    title: "Application initialization timed out",
    message:
      "The application did not finish initializing in time. This may be a temporary issue.",
  }),
  chunk: Object.freeze({
    title: "Application resources failed to load",
    message:
      "Part of the frontend bundle could not be fetched, usually a tab left open across a redeploy. Reloading the page restores it.",
  }),
  error: Object.freeze({
    title: "Application failed to load",
    message:
      "An uncaught error interrupted the boot. The raw details below may identify the cause.",
  }),
  browser: Object.freeze({
    title: "Browser not supported",
    message:
      "Your browser is too old to run this application. Please update it, or switch to a modern browser such as Chrome, Firefox, or Edge.",
  }),
});

/**
 * Chunk-miss signatures across browsers — the same families the family's
 * hand-rolled `res/fatal-fallback.js` recognizes. A bundle that could not be
 * fetched is a RESOURCE failure, not a script bug, and gets its own headline.
 */
export const BOOT_RECOVERY_CHUNK_MISS =
  /ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

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
    title: BOOT_RECOVERY_TITLE,
    message: BOOT_RECOVERY_MESSAGE,
    retry: BOOT_RECOVERY_RETRY,
  }),
  injectTo: "head",
});

/** `var currentLocale = "en";` - the details payload reports the locale the
 * panel painted; the locale machinery records it as it resolves, and the
 * single-copy shape is English by definition. */
const CURRENT_LOCALE_LINE = `  var currentLocale = "en";`;

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
 * a JSON array of `[tag, title, message, retry]` rows, every string through
 * `jsonAscii` (CJK becomes \uXXXX escapes, no `</script` can survive), so
 * the generated script stays ASCII-only and byte-deterministic. A row whose
 * host omitted `title` carries `""`; the runtime falls back to
 * `COPY_TITLE` for it.
 *
 * With `withLabel` the row grows a FIFTH member, `rawDetailsLabel`, and an
 * omitted one carries `""` for the runtime to resolve against the host's
 * default. The flag exists purely to keep the BYTE-COMPAT promise: a host that
 * does not configure `copy.rawDetailsLabel` must get the four-member rows it
 * has always had, because it may hash the script into its CSP.
 *
 * @param {Array<[string, string, string, string, string]>} entries
 * @param {boolean} withLabel
 * @returns {string}
 */
function copyTableLiteral(entries, withLabel) {
  const rows = [];
  for (const entry of entries) {
    let row =
      "[" +
      jsonAscii(entry[0]) +
      "," +
      jsonAscii(entry[1]) +
      "," +
      jsonAscii(entry[2]) +
      "," +
      jsonAscii(entry[3]);
    if (withLabel) row += "," + jsonAscii(entry[4] || "");
    rows.push(row + "]");
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
 * `title` is the landing headline (the panel mirrors HkErrorLanding's card:
 * headline + explanation + action), `message` its explanation and `retry`
 * the reload label. An empty title falls back to the English default, so a
 * host that only ever configured the pre-title pair still paints a heading.
 *
 * @param {unknown} input
 * @returns {{ title: string, message: string, retry: string }}
 */
function normaliseCopy(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    title:
      typeof raw.title === "string" && raw.title
        ? raw.title
        : BOOT_RECOVERY_TITLE,
    message: typeof raw.message === "string" ? raw.message : BOOT_RECOVERY_MESSAGE,
    retry: typeof raw.retry === "string" ? raw.retry : BOOT_RECOVERY_RETRY,
  };
}

/**
 * Normalise the opt-in raw-details pane: its label is the ON/OFF switch.
 *
 * The details region is the panel's one optional half (the landing card, its
 * action row and the watchdog are unconditional), so it is gated on a single
 * value rather than a boolean flag plus a label: a host that wants the pane
 * says what to call it, and a host that says nothing gets the pre-0.55.357
 * panel down to the byte. An empty/whitespace label is "not configured" — a
 * blank heading over an empty frame reads as a broken panel, not as a minimal
 * one.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function normaliseRawDetailsLabel(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Normalise the opt-in BROWSER-BLOCK entry: the panel's info-tone mode for a
 * shell that refuses to run on an unsupported browser, and the page global
 * that triggers it.
 *
 * The wording is the host's (a browser-compatibility notice is product copy,
 * not library copy), so `copy.browserBlock` takes the two translated strings
 * and the placeholder set they may carry. Configuring it makes the generated
 * script publish `window[<global>](browser, current, min)` — the same call the
 * family's hand-rolled `res/fatal-fallback.js` exposed as `__appBlock`, so a
 * host's existing UA check keeps working with no rewrite. The panel paints
 * IMMEDIATELY (no watchdog wait) and in the `info` tone, because an old
 * browser is a compatibility notice, not a crash.
 *
 * An explicit `false` turns the entry off; omitting it leaves the script
 * byte-identical to the panel without the entry (BYTE-COMPAT).
 *
 * @param {unknown} input
 * @param {unknown} blockGlobal
 * @returns {{ title: string, message: string, global: string } | null}
 */
function normaliseBrowserBlock(input, blockGlobal) {
  if (input === false) return null;
  if (input === undefined || input === null) return null;
  if (!blockGlobal) {
    throw new Error(
      "[hikari boot-recovery] copy.browserBlock requires a published global; " +
        "globals.block is false, so the panel could never be raised",
    );
  }
  if (typeof input !== "object") {
    throw new Error(
      "[hikari boot-recovery] copy.browserBlock must be an object carrying " +
        "non-empty title and message strings (or false to disable the entry)",
    );
  }
  const raw = input;
  if (
    typeof raw.title !== "string" ||
    !raw.title ||
    typeof raw.message !== "string" ||
    !raw.message
  ) {
    throw new Error(
      "[hikari boot-recovery] copy.browserBlock entries must carry non-empty " +
        "title and message strings",
    );
  }
  // The block notice is host product wording, so a multilingual host needs it
  // translated too — and for exactly the same reason the reason table does:
  // its single title/message would otherwise overwrite the localised copy the
  // panel had already selected.
  return {
    title: raw.title,
    message: raw.message,
    locales: normaliseTranslationMap(raw.locales, "copy.browserBlock"),
    global: blockGlobal,
  };
}

/**
 * Normalise a per-locale override map: `{ "zh-CN": { title, message } }`.
 *
 * Keys go through the SAME normalisation as `copy.locales` (trim, lowercase,
 * `_` → `-`), so one host tag means one thing everywhere in the config, and
 * two keys collapsing onto one tag fail the build instead of shadowing each
 * other. The result is keyed by the normalised tag.
 *
 * @param {unknown} input — the `locales` member of a reason / block entry
 * @param {string} label — config path for the error message
 * @returns {Record<string, {title: string, message: string}> | null}
 */
function normaliseTranslationMap(input, label) {
  if (input === undefined || input === null) return null;
  if (typeof input !== "object") {
    throw new Error(
      "[hikari boot-recovery] " + label + ".locales must be an object keyed by " +
        "locale tag (e.g. { \"zh-CN\": { title, message } })",
    );
  }
  const out = {};
  const seen = new Map();
  for (const rawKey in input) {
    if (!Object.prototype.hasOwnProperty.call(input, rawKey)) continue;
    const tag = String(rawKey).trim().replace(/_/g, "-").toLowerCase();
    if (!tag) {
      throw new Error(
        "[hikari boot-recovery] " + label + ".locales key " +
          JSON.stringify(rawKey) + " normalises to an empty locale tag",
      );
    }
    const previous = seen.get(tag);
    if (previous !== undefined) {
      throw new Error(
        "[hikari boot-recovery] " + label + ".locales keys " +
          JSON.stringify(previous) + " and " + JSON.stringify(rawKey) +
          " normalise to the same locale tag " + JSON.stringify(tag),
      );
    }
    const entry = input[rawKey];
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.title !== "string" ||
      !entry.title ||
      typeof entry.message !== "string" ||
      !entry.message
    ) {
      throw new Error(
        "[hikari boot-recovery] " + label + ".locales[" + JSON.stringify(tag) +
          "]: entries must carry non-empty title and message strings",
      );
    }
    seen.set(tag, rawKey);
    out[tag] = { title: entry.title, message: entry.message };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Normalise the four-entry REASON TABLE: what the panel says for each class of
 * boot failure.
 *
 * Mirrors the family script's `REASON_PREFIX` / `<prefix>Title|Desc` layout.
 * Every key is optional — a host may translate only the reasons it displays —
 * and any reason it omits falls back to the English default for that class
 * (`BOOT_RECOVERY_REASONS`). Configuring the table at all turns on reason
 * selection: without it the panel paints the single `copy` triple it always
 * has, byte-identically (BYTE-COMPAT).
 *
 * A class may ALSO carry `locales`, a per-locale override map. That is what
 * makes the table usable by a MULTILINGUAL host: without it, a reason's single
 * title/message would overwrite the localised copy `copy.locales` had already
 * selected, so every non-English panel would lose its headline. With it, the
 * runtime resolves — per the RETIRED family script's own matrix — the current
 * locale's reason copy first, and the current locale's GENERIC copy if that
 * locale has no translation for the class. It never falls back to the English
 * reason table, because a Chinese panel showing an English sentence is worse
 * than one showing its own generic wording.
 *
 * @param {unknown} input
 * @returns {Record<string, {title: string, message: string,
 *   locales: Record<string, {title: string, message: string}> | null}> | null}
 */
function normaliseReasons(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== "object") {
    throw new Error(
      "[hikari boot-recovery] copy.reasons must be an object keyed by reason " +
        "(timeout / chunk / error / browser)",
    );
  }
  const out = {};
  let any = false;
  for (const reason of BOOT_RECOVERY_REASON_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, reason)) continue;
    const raw = input[reason];
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.title !== "string" ||
      !raw.title ||
      typeof raw.message !== "string" ||
      !raw.message
    ) {
      throw new Error(
        "[hikari boot-recovery] copy.reasons[" +
          JSON.stringify(reason) +
          "]: entries must carry non-empty title and message strings",
      );
    }
    out[reason] = {
      title: raw.title,
      message: raw.message,
      locales: normaliseTranslationMap(
        raw.locales,
        "copy.reasons[" + JSON.stringify(reason) + "]",
      ),
    };
    any = true;
  }
  for (const key in input) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    if (BOOT_RECOVERY_REASON_KEYS.indexOf(key) === -1) {
      throw new Error(
        "[hikari boot-recovery] copy.reasons has unknown reason " +
          JSON.stringify(key) +
          " (expected one of " +
          BOOT_RECOVERY_REASON_KEYS.join(" / ") +
          ")",
      );
    }
  }
  return any ? out : null;
}

/**
 * Normalise the `globals` option: the three page globals the panel publishes
 * for a host's own boot code to drive.
 *
 * The trio is the family's long-standing contract, and they are ALL defaults
 * of the family script being retired — `__appBlock` (refuse an unsupported
 * browser), `__appFatal` (report a captured pre-mount error) and
 * `__appReady` (the app mounted; stand the panel down). A host switching to
 * this plugin keeps calling the same names with no source change, which is
 * what makes retiring the old script possible at all.
 *
 * Each slot is `string | { global?: string | false } | false`: a string (or
 * `{ global }`) renames that entry, `false` turns it OFF, and leaving it out
 * keeps the family default. The defaults are only published when the host
 * configures the feature that needs them — `block` with `copy.browserBlock`,
 * `fatal`/`ready` with `copy.reasons` — so a host that configures nothing
 * new gets a byte-identical script.
 *
 * @param {unknown} input
 * @param {boolean} wantsDiagnostics — `copy.reasons` is configured
 * @returns {{ block: string | null, fatal: string | null, ready: string | null }}
 */
function normaliseGlobals(input, wantsDiagnostics) {
  const raw = input && typeof input === "object" ? input : {};
  /** @param {unknown} value @param {string} fallback */
  function slot(value, fallback) {
    if (value === false) return null;
    if (value === undefined || value === null) return fallback;
    if (typeof value === "string") return value.trim() ? value.trim() : null;
    if (typeof value === "object") {
      const named = value.global;
      if (named === false) return null;
      if (typeof named === "string") return named.trim() ? named.trim() : null;
      return fallback;
    }
    throw new Error(
      "[hikari boot-recovery] globals entries must be a name, { global }, or false",
    );
  }
  return {
    block: slot(raw.block, BOOT_RECOVERY_BLOCK_GLOBAL),
    fatal: wantsDiagnostics
      ? slot(raw.fatal, BOOT_RECOVERY_FATAL_GLOBAL)
      : null,
    ready: wantsDiagnostics
      ? slot(raw.ready, BOOT_RECOVERY_READY_GLOBAL)
      : null,
  };
}

/**
 * Normalise the host's optional locale table.
 *
 * Keys are BCP 47-ish tags; each is trimmed, lowercased and has `_` turned
 * into `-` (so `"zh_CN"` and `"zh-cn"` collide loudly instead of one of
 * them silently shadowing the other). Each entry must be an object carrying
 * non-empty `message` and `retry` strings — a typo must fail the build at
 * config time, not paint an empty panel on a dead boot. `title` is the
 * landing headline and is OPTIONAL (a row without one paints the host's
 * default title over localized copy, which is why hosts translating the
 * panel should supply it); a present-but-empty title is rejected like any
 * other malformed field. The result is an array of
 * `[tag, title, message, retry]` rows in the host's insertion order
 * (which is the tie-break order for shared primary subtags), or `null`
 * when no table was configured — the single-copy mode emits none of the
 * selection machinery (the panel restyle still changes the script bytes for
 * every host; see BYTE-COMPAT in the module doc).
 *
 * @param {unknown} locales
 * @returns {Array<[string, string, string, string]> | null}
 */
function normaliseLocales(locales) {
  if (locales === undefined || locales === null) return null;
  const rows = [];
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
    if (
      entry.title !== undefined &&
      (typeof entry.title !== "string" || !entry.title)
    ) {
      throw new Error(
        "[hikari boot-recovery] copy.locales[" +
          JSON.stringify(tag) +
          "].title: when present it must be a non-empty string",
      );
    }
    seen.set(tag, rawKey);
    rows.push([
      tag,
      entry.title || "",
      entry.message,
      entry.retry,
      entry.rawDetailsLabel || "",
    ]);
  }
  return rows.length ? rows : null;
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
 *   copy: { title: string, message: string, retry: string },
 *   copyTable: Array<[string, string, string, string, string]> | null,
 *   storageKey: string | null,
 *   osPrefsGlobal: string | null,
 *   rawDetailsLabel: string | null,
 *   browserBlock: { title: string, message: string, global: string } | null,
 *   reasons: Record<string, { title: string, message: string }> | null,
 *   globals: { block: string | null, fatal: string | null, ready: string | null },
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
  const rawDetailsLabel = normaliseRawDetailsLabel(copyRaw.rawDetailsLabel);
  const loadingScreen = normaliseLoadingScreen(input.loadingScreen);
  const reasons = normaliseReasons(copyRaw.reasons);
  const globals = normaliseGlobals(input.globals, reasons !== null);
  const browserBlock = normaliseBrowserBlock(copyRaw.browserBlock, globals.block);
  // A per-locale override map is only meaningful beside the locale source it
  // overrides: `copy.locales` is what selects the language. Allowing the maps
  // without it would ship a script whose resolver references a locale that can
  // never be selected — and because every caller is guarded, that would fail
  // SILENTLY (an unset panel instead of a build error). Fail loudly instead.
  if (reasons !== null && !copyTable) {
    const translated = BOOT_RECOVERY_REASON_KEYS.some(
      (key) => reasons[key] && reasons[key].locales,
    );
    if (translated) {
      throw new Error(
        "[hikari boot-recovery] copy.reasons[*].locales requires copy.locales: " +
          "the per-locale reason wording is selected by the locale table, so " +
          "without one there is no language to resolve",
      );
    }
  }
  if (browserBlock !== null && browserBlock.locales && !copyTable) {
    throw new Error(
      "[hikari boot-recovery] copy.browserBlock.locales requires copy.locales: " +
        "the per-locale notice is selected by the locale table, so without one " +
        "there is no language to resolve",
    );
  }
  if (reasons !== null && !loadingScreen) {
    throw new Error(
      "[hikari boot-recovery] copy.reasons paints the watchdog's panel, which " +
        "the heal-only mode never renders; it cannot be combined with " +
        "loadingScreen: false",
    );
  }
  if (browserBlock !== null && !loadingScreen) {
    throw new Error(
      "[hikari boot-recovery] copy.browserBlock paints a panel inside the " +
        "loading element, which only the watchdog half renders; it cannot be " +
        "combined with loadingScreen: false (the heal-only mode never shows a panel)",
    );
  }
  if (rawDetailsLabel !== null && !loadingScreen) {
    throw new Error(
      "[hikari boot-recovery] copy.rawDetailsLabel paints the panel's raw-details " +
        "pane, which only the watchdog half renders; it cannot be combined with " +
        "loadingScreen: false (the heal-only mode never shows a panel)",
    );
  }
  return {
    canonicalOrigin: canonicalOrigin,
    canonicalHostname: canonicalHostname(canonicalOrigin),
    deadlineMs: normaliseDeadline(input.deadlineMs),
    predicateSource:
      typeof input.isMangledOrigin === "function"
        ? predicateSource(input.isMangledOrigin)
        : null,
    loadingScreen: loadingScreen,
    copy: normaliseCopy(input.copy),
    copyTable: copyTable,
    storageKey: normaliseStorageKey(copyRaw.storageKey, copyTable !== null),
    osPrefsGlobal: normaliseOsPrefsGlobal(input.osPrefsGlobal),
    rawDetailsLabel: rawDetailsLabel,
    browserBlock: browserBlock,
    reasons: reasons,
    globals: globals,
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
 * The failure panel's stylesheet — hikari's OWN component sheet, not a
 * hand-copied palette.
 *
 * The panel is the pre-framework twin of HkErrorLanding: the card, its icon
 * disc, the headline/explanation and the action row are the component's own
 * classes, and the stylesheet is compiled from the LIVE component sources
 * (`boot-landing.scss`: theme/channels + theme/scale + HkErrorLanding +
 * HkButton) into `./bootLandingCss.mjs` by
 * `scripts/gen-boot-landing-css.mjs`. `bootLandingCss.test.ts` recompiles
 * the entry and fails whenever the checked-in sheet drifts from the
 * components, so the boot surface cannot fork away from the app's error
 * landing again (the pre-0.55.3xx panel hand-rolled `.hk-boot-recovery`
 * classes with literal token values instead of reusing the component).
 *
 * Deliberately SELF-CONTAINED: the sheet styles only hikari's own classes and
 * is appended INSIDE the host's loading element (never applied to it), so a
 * custom `selector` cannot break out of the stylesheet. Dark mode rides
 * hikari's default dark seed palette through the entry's
 * `prefers-color-scheme` block, because no theme engine exists yet when the
 * panel paints.
 */

/**
 * The opt-in details pane's runtime, emitted VERBATIM into the generated
 * script only when the host configures `copy.rawDetailsLabel`.
 *
 * It is one raw block (not a wall of `lines.push`) because it is page
 * JavaScript, not strings the generator composes: keeping its shape legible
 * here is what makes the generated script reviewable, and the block carries
 * no interpolation at all, so the output stays byte-deterministic.
 *
 * Four pieces, in the order they run:
 *
 *   1. PAYLOAD — a diagnostic snapshot modelled field-for-field on the
 *      family's long-standing `res/fatal-fallback.js` (`buildPayload`):
 *      reason / message / capturedAt / elapsedMs / timeoutMs / readyState /
 *      appMounted / locale / buildHash / href, plus `failedResources` (only
 *      when something did fail) and `bootScripts`, plus `error` when a
 *      captured error was handed in. Every read is guarded and every free-text
 *      field capped, because the payload is collected while the page is
 *      already failing and the operator pastes it into an issue.
 *      `capturedAt` and `elapsedMs` are computed AT PAGE RUNTIME — never
 *      fixed at generation time, or the paste would describe the build
 *      machine instead of the failure.
 *   2. REDACTION — the shared family rule (three credential shapes, a
 *      three-disc mask) applied to the SERIALIZED payload, exactly like the
 *      family script: masking the text (not each value) is what catches a
 *      quoted `password` key pair and a header line alike. The redacted text
 *      is re-parsed so the tree renders the masked values.
 *   3. RENDER — the HkJsonTree DOM contract (`.s-tool-json-tree` >
 *      `.s-jt-group` > `.s-jt-row`) built with DOM APIs and `textContent`
 *      only, so the compiled HkJsonTree sheet applies unchanged and the boot
 *      pane reads as the in-app one. The boot panel cannot mount Vue, so this
 *      is a framework-free renderer for the same contract — NOT a second
 *      design. Folding is display-state only (no height animation: a dead page
 *      has no animation bus to report to, and the standing frame never
 *      resizes).
 *   4. SCROLLBAR — a minimal track/thumb geometry sync driving hikari's own
 *      `.hk-scrollbar-*` chrome on BOTH axes. The Vue composable cannot be
 *      inlined (it imports layoutGeometry/cronBus/animationBus), so this
 *      mirrors its render math: thumb = ratio x track (20px floor), offset =
 *      progress x travel, hidden while the content fits, `is-scrolling` flash
 *      on scroll, `is-hovering` on rail hover, re-measured on resize.
 *      Dragging is deliberately absent: this is a read-only rescue surface.
 *
 * Reads `location.href` / `performance` / `document.readyState`, which the
 * bare panel never touches — that is the whole point of an opt-in diagnostics
 * pane, and it stays behind the option so a host that hashes the default
 * script keeps the inert-script contract it signed up for.
 */
/**
 * The RESOURCE-DIAGNOSTIC helpers, emitted whenever a half of the panel needs
 * to know why the bundle never arrived.
 *
 * Two consumers share them: the details pane (which reports bootScripts and
 * failedResources in its payload) and the reason table's watchdog (which
 * classifies a silent expiry as a chunk miss when a boot script FETCHED and was
 * REFUSED). They are their own block rather than part of either half because a
 * host may want the diagnosis without the pane, or the pane without the
 * diagnosis — and an emitted-twice definition would be the same silent failure
 * mode safeCall had.
 */
const RESOURCE_RUNTIME = String.raw`
  function absoluteUrl(src) {
    return safeCall(function () {
      return new URL(src, location.href).href;
    }, safeCall(function () {
      return String(src);
    }, ""));
  }
  function shortUrl(url) {
    return safeCall(function () {
      var u = new URL(url, location.href);
      return u.pathname + u.search;
    }, absoluteUrl(url));
  }
  /* Every JS/CSS resource the browser has finished fetching, keyed by absolute
     URL. A <script src> WITH an entry completed its fetch (the status says
     how); one WITHOUT never completed, which is what a boot hang looks like. */
  function resourceIndex() {
    var map = {};
    safeCall(function () {
      var list = performance.getEntriesByType("resource") || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!e || typeof e.name !== "string") continue;
        if (!/\.(js|mjs|css)(\?|$)/.test(e.name)) continue;
        map[e.name] = {
          ms: Math.round(e.duration || 0),
          status:
            typeof e.responseStatus === "number" && e.responseStatus > 0
              ? e.responseStatus
              : null
        };
      }
    }, null);
    return map;
  }
  function bootScripts(index) {
    var out = [];
    safeCall(function () {
      var nodes = document.querySelectorAll("script[src]");
      for (var i = 0; i < nodes.length && out.length < 12; i++) {
        var raw = nodes[i].getAttribute("src") || "";
        if (!raw) continue;
        var hit = index[absoluteUrl(raw)];
        /* pending = no timing entry at all (never finished fetching);
           failed = fetched, but the server refused it (a 404 on the entry
           chunk IS the stale-deploy signature); loaded = fetched fine. A
           timing entry with no status is a fetch that never produced a
           response, which is "unknown", not "loaded". */
        var state = "pending";
        if (hit) {
          state = hit.status === null ? "unknown" : hit.status >= 400 ? "failed" : "loaded";
        }
        out.push({
          src: raw,
          state: state,
          ms: hit ? hit.ms : null,
          status: hit ? hit.status : null
        });
      }
    }, null);
    return out;
  }
  function failedResources(index) {
    var out = [];
    for (var url in index) {
      if (!Object.prototype.hasOwnProperty.call(index, url)) continue;
      if (index[url].status !== null && index[url].status >= 400) {
        out.push({ src: shortUrl(url), status: index[url].status });
        if (out.length >= 12) break;
      }
    }
    return out;
  }
`;

const DETAILS_RUNTIME = String.raw`
  /* ---- raw-details pane: payload, redaction, JSON tree, scrollbar ----
     Everything below exists ONLY when the host set copy.rawDetailsLabel; the
     generator emits none of it otherwise (BYTE-COMPAT). Every step is guarded
     and every free-text field is capped: this code runs while the page is
     already failing, and its output is what an operator pastes into an issue.
     Nothing here throws, and nothing here reloads. */
  var TEXT_LIMIT = 4000;
  var JT_STR_PREVIEW = 72;
  var JT_TOGGLE = 14;
  var JT_MAX_DEPTH = 8;
  var CREDENTIAL_QUERY = /(?:token|api_key)=([^&)\]}"' \n\t]*)/gi;
  var CREDENTIAL_KEY = /("(?:token|api_key|apikey|api-key|access_token|refresh_token|password|secret|authorization|cookie)"\s*:\s*")([^"]*)(")/gi;
  var CREDENTIAL_HEADER = /\b(Authorization|Cookie|Proxy-Authorization)\s*:\s*([^\n"']+)/gi;
  var detailsRefresh = null;
  function safeCall(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }
  /* Coercion is hostile-input territory: a thrown toString must not cost the
     operator the panel, so String() itself runs inside a guard. */
  function clipText(text, limit) {
    var s = safeCall(function () {
      return String(text);
    }, "");
    return s.length > limit ? s.slice(0, limit) + "\u2026" : s;
  }
  /* The family mask: an empty value stays empty (masking nothing would invent
     a credential where there is none), a present one becomes three solid
     discs. */
  function maskSecret(value) {
    return value ? "\u25CF\u25CF\u25CF" : value;
  }
  /* The payload is offered to the operator as "copy this into the bug
     report", so credential-shaped text must not ride along. Applied to the
     SERIALIZED text (not field by field) because that is what catches the
     "key": "value" and header shapes as well as a query string. */
  function redact(text) {
    return String(text)
      .replace(CREDENTIAL_QUERY, function (match, value) {
        return value
          ? match.slice(0, match.length - value.length) + maskSecret(value)
          : match;
      })
      .replace(CREDENTIAL_KEY, function (_match, head, value, tail) {
        return head + maskSecret(value) + tail;
      })
      .replace(CREDENTIAL_HEADER, function (_match, header, value) {
        return header + ": " + maskSecret(value);
      });
  }
  function errorDetail(error) {
    if (error === null || error === undefined) return null;
    return safeCall(function () {
      if (typeof error !== "object") {
        return { name: typeof error, message: clipText(error, TEXT_LIMIT) };
      }
      var detail = {};
      /* Enumerating keys is hostile-input territory too (a Proxy may throw
         from ownKeys/has), so the key list and every read are guarded. */
      var keys = safeCall(function () {
        var own = [];
        for (var key in error) {
          if (Object.prototype.hasOwnProperty.call(error, key)) own.push(key);
        }
        return own;
      }, []);
      for (var i = 0; i < keys.length; i++) {
        var name = keys[i];
        var value = safeCall(function () {
          return error[name];
        }, undefined);
        if (typeof value === "string") {
          detail[name] = clipText(value, TEXT_LIMIT);
        } else if (value === null || typeof value === "number" || typeof value === "boolean") {
          detail[name] = value;
        } else {
          detail[name] = clipText(safeCall(function () {
            return JSON.stringify(value);
          }, ""), TEXT_LIMIT);
        }
      }
      return detail;
    }, null);
  }
  /* The diagnostic snapshot: field-for-field the family's buildPayload, so a
     paste from this panel and a paste from the host's old fallback script are
     read the same way. capturedAt / elapsedMs are PAGE-RUNTIME values: the
     generator never bakes a timestamp in. */
  function buildPayload(reason, message, error) {
    var index = resourceIndex();
    var payload = {
      reason: reason,
      message: clipText(message || "", TEXT_LIMIT),
      capturedAt: safeCall(function () {
        return new Date().toISOString();
      }, ""),
      elapsedMs: safeCall(function () {
        return Date.now() - bootStartedAt;
      }, 0),
      timeoutMs: PAYLOAD_TIMEOUT_MS,
      readyState: safeCall(function () {
        return document.readyState;
      }, ""),
      appMounted: safeCall(function () {
        var app = document.getElementById("app");
        return !!(app && app.children && app.children.length);
      }, false),
      locale: currentLocale,
      buildHash: safeCall(function () {
        var hash = window.__PANEL_BUILD_HASH__;
        return typeof hash === "string" && hash ? hash : null;
      }, null),
      href: safeCall(function () {
        return String(location.href);
      }, "")
    };
    var failed = failedResources(index);
    if (failed.length) payload.failedResources = failed;
    payload.bootScripts = bootScripts(index);
    var detail = errorDetail(error);
    if (detail) payload.error = detail;
    return payload;
  }
  /* The paste text: pretty JSON, then the credential mask over the whole
     serialized string. Masking the TEXT (not each value) is what catches a
     "password": "..." key pair and a header line alike. */
  function payloadText(payload) {
    return redact(safeCall(function () {
      return JSON.stringify(payload, null, 2);
    }, ""));
  }
  /* ---- HkJsonTree's DOM contract, built framework-free ---- */
  function jsonInline(v) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    if (typeof v === "string") return '"' + (v.length > 20 ? v.slice(0, 20) + "\u2026" : v) + '"';
    if (Object.prototype.toString.call(v) === "[object Array]") return "Array(" + v.length + ")";
    return "{" + Object.keys(v).length + "}";
  }
  function objectPreview(value) {
    var arr = Object.prototype.toString.call(value) === "[object Array]";
    var entries = arr ? value : Object.keys(value);
    var parts = [];
    for (var i = 0; i < entries.length && i < 3; i++) {
      parts.push(arr ? jsonInline(value[i]) : entries[i] + ": " + jsonInline(value[entries[i]]));
    }
    var suffix = entries.length > 3 ? ", \u2026" : "";
    return (arr ? "[" : "{") + parts.join(", ") + suffix + (arr ? "]" : "}");
  }
  function jsonNode(value, key, depth) {
    var container = value !== null && typeof value === "object";
    var node = {
      key: key,
      value: value,
      depth: depth,
      container: container,
      children: [],
      childCount: 0,
      preview: "",
      longString: typeof value === "string" && value.length > JT_STR_PREVIEW
    };
    if (container) {
      var arr = Object.prototype.toString.call(value) === "[object Array]";
      var keys = arr ? [] : Object.keys(value);
      if (arr) {
        for (var i = 0; i < value.length; i++) keys.push(String(i));
      }
      node.childCount = keys.length;
      node.preview = objectPreview(value);
      if (depth < JT_MAX_DEPTH) {
        for (var k = 0; k < keys.length; k++) {
          node.children.push(jsonNode(value[keys[k]], keys[k], depth + 1));
        }
      }
    }
    return node;
  }
  var SVG_NS_PANEL = "http://www.w3.org/2000/svg";
  function treeChevron() {
    var svg = document.createElementNS(SVG_NS_PANEL, "svg");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.className = "s-jt-chevron";
    var path = document.createElementNS(SVG_NS_PANEL, "path");
    path.setAttribute("d", "m9 18 6-6-6-6");
    svg.appendChild(path);
    return svg;
  }
  function treeSpan(className, text) {
    var span = document.createElement("span");
    span.className = className;
    if (text !== undefined) span.textContent = text;
    return span;
  }
  function treeValue(value) {
    var out = [];
    if (value === null) {
      out.push(treeSpan("s-jv-null", "null"));
      out.push(treeSpan("s-jt-type", "null"));
    } else if (value === undefined) {
      out.push(treeSpan("s-jv-null", "undefined"));
      out.push(treeSpan("s-jt-type", "undefined"));
    } else if (typeof value === "boolean") {
      out.push(treeSpan("s-jv-bool", String(value)));
      out.push(treeSpan("s-jt-type", "boolean"));
    } else if (typeof value === "number") {
      out.push(treeSpan("s-jv-num", String(value)));
      out.push(treeSpan("s-jt-type", "number"));
    } else if (typeof value === "string") {
      out.push(treeSpan("s-jv-str", JSON.stringify(value)));
      out.push(treeSpan("s-jt-type", "string"));
    }
    return out;
  }
  function renderJsonNode(node, openIds) {
    var indent = node.depth * JT_TOGGLE;
    var group = document.createElement("div");
    if (!node.container && !node.longString) {
      var leafRow = document.createElement("div");
      leafRow.className = "s-jt-row";
      leafRow.style.paddingLeft = indent + "px";
      var leafToggle = treeSpan("s-jt-toggle");
      leafToggle.appendChild(treeSpan("s-jt-leaf"));
      leafRow.appendChild(leafToggle);
      if (node.key !== null) {
        leafRow.appendChild(treeSpan("s-jt-key", node.key));
        leafRow.appendChild(treeSpan("s-jt-colon", ": "));
      }
      var values = treeValue(node.value);
      for (var v = 0; v < values.length; v++) leafRow.appendChild(values[v]);
      group.appendChild(leafRow);
      return group;
    }
    var id = node.depth + ":" + node.key;
    var isOpen = openIds[id] !== false;
    group.className = "s-jt-group";
    var row = document.createElement("div");
    row.className = "s-jt-row";
    row.setAttribute("data-parent", "");
    row.style.paddingLeft = indent + "px";
    var toggle = treeSpan("s-jt-toggle");
    toggle.setAttribute("data-parent", "");
    toggle.appendChild(treeChevron());
    row.appendChild(toggle);
    if (node.key !== null) {
      row.appendChild(treeSpan("s-jt-key", node.key));
      row.appendChild(treeSpan("s-jt-colon", ": "));
    }
    var badge = treeSpan(
      "s-jt-badge is-open",
      node.longString
        ? "string (" + node.value.length + ")"
        : Object.prototype.toString.call(node.value) === "[object Array]"
          ? "Array(" + node.childCount + ")"
          : "{" + node.childCount + "}"
    );
    var summary = document.createElement("span");
    summary.style.display = "none";
    summary.appendChild(treeSpan("s-jt-indent"));
    if (node.longString) {
      summary.appendChild(
        treeSpan("s-jv-str s-jt-clamp", '"' + node.value.slice(0, JT_STR_PREVIEW) + '"')
      );
      summary.appendChild(treeSpan("s-jt-type", "string (" + node.value.length + ")"));
    } else {
      summary.appendChild(treeSpan("s-jt-preview", node.preview));
    }
    row.appendChild(badge);
    row.appendChild(summary);
    group.appendChild(row);
    var children = document.createElement("div");
    children.className = "s-jt-children";
    children.style.setProperty("--guide-left", indent + Math.floor(JT_TOGGLE / 2) + "px");
    if (node.longString) {
      var lines = node.value.split("\n");
      for (var li = 0; li < lines.length; li++) {
        var lineRow = document.createElement("div");
        lineRow.className = "s-jt-row";
        lineRow.style.paddingLeft = (node.depth + 1) * JT_TOGGLE + "px";
        var lineToggle = treeSpan("s-jt-toggle");
        lineToggle.appendChild(treeSpan("s-jt-leaf"));
        lineRow.appendChild(lineToggle);
        lineRow.appendChild(treeSpan("s-jv-str-raw", lines[li] || " "));
        children.appendChild(lineRow);
      }
    } else {
      for (var c = 0; c < node.children.length; c++) {
        children.appendChild(renderJsonNode(node.children[c], openIds));
      }
    }
    group.appendChild(children);
    /* Folding is DISPLAY STATE only: no height animation, because a dead page
       has no animation bus to report to and the standing frame must never
       resize. Clicking the head row toggles the group's children. */
    function apply(open) {
      if (open) group.setAttribute("data-open", "1");
      else group.removeAttribute("data-open");
      badge.style.display = open ? "" : "none";
      summary.style.display = open ? "none" : "";
      children.style.display = open ? "" : "none";
    }
    apply(isOpen);
    row.addEventListener("click", function () {
      safeCall(function () {
        var next = group.getAttribute("data-open") !== "1";
        apply(next);
        openIds[id] = next;
        if (detailsRefresh) detailsRefresh();
      }, null);
    });
    return group;
  }
  function renderJsonTree(payload) {
    var tree = document.createElement("div");
    tree.className = "s-tool-json-tree";
    tree.setAttribute("role", "tree");
    /* HkJsonTree opens the root and its DIRECT children; deeper levels start
       collapsed, so a boot payload reads as a summary you can drill into. */
    var openIds = {};
    var root = jsonNode(payload, null, 0);
    for (var i = 0; i < root.children.length; i++) {
      openIds["1:" + root.children[i].key] = true;
    }
    tree.appendChild(renderJsonNode(root, openIds));
    return tree;
  }
  /* ---- hikari's overlay scrollbar chrome, driven by a minimal sync ----
     The Vue composable cannot be inlined (layoutGeometry/cronBus/animationBus),
     so this mirrors its render math: thumb = ratio x track with a 20px floor,
     offset = progress x travel, the track hides while the content fits,
     is-scrolling flashes on scroll and is-hovering while the rail is hovered.
     Both axes: the pane hides the native bar horizontally too. */
  function attachPanelScrollbars(pane, body) {
    var states = [];
    function makeAxis(horizontal) {
      var track = document.createElement("div");
      track.className = "hk-scrollbar-track";
      if (horizontal) track.setAttribute("data-axis", "horizontal");
      var thumb = document.createElement("div");
      thumb.className = "hk-scrollbar-thumb";
      track.appendChild(thumb);
      pane.appendChild(track);
      var state = { track: track, thumb: thumb, horizontal: horizontal, timer: 0 };
      track.addEventListener("mouseenter", function () {
        safeCall(function () {
          track.classList.add("is-hovering");
        }, null);
      });
      track.addEventListener("mouseleave", function () {
        safeCall(function () {
          track.classList.remove("is-hovering");
        }, null);
      });
      return state;
    }
    function updateAxis(state) {
      var scrollSize = state.horizontal ? body.scrollWidth : body.scrollHeight;
      var clientSize = state.horizontal ? body.clientWidth : body.clientHeight;
      if (scrollSize <= clientSize) {
        state.track.style.display = "none";
        return;
      }
      state.track.style.display = "";
      var trackSize = state.horizontal ? state.track.clientWidth : state.track.clientHeight;
      var thumbSize = Math.max((clientSize / scrollSize) * trackSize, 20);
      var travel = trackSize - thumbSize;
      var maxScroll = scrollSize - clientSize;
      var pos = state.horizontal ? body.scrollLeft : body.scrollTop;
      var progress = maxScroll > 0 ? pos / maxScroll : 0;
      var offset = progress * travel;
      if (state.horizontal) {
        state.thumb.style.width = thumbSize + "px";
        state.thumb.style.transform = "translateX(" + offset + "px)";
      } else {
        state.thumb.style.height = thumbSize + "px";
        state.thumb.style.transform = "translateY(" + offset + "px)";
      }
    }
    function update() {
      for (var i = 0; i < states.length; i++) updateAxis(states[i]);
    }
    function flash(target, timerKey) {
      target.classList.add("is-scrolling");
      if (timerKey) clearTimeout(timerKey);
      return setTimeout(function () {
        safeCall(function () {
          target.classList.remove("is-scrolling");
        }, null);
      }, 1200);
    }
    states.push(makeAxis(false));
    states.push(makeAxis(true));
    body.addEventListener("scroll", function () {
      safeCall(function () {
        update();
        for (var i = 0; i < states.length; i++) {
          states[i].timer = flash(states[i].track, states[i].timer);
        }
      }, null);
    }, { passive: true });
    if (typeof ResizeObserver !== "undefined") {
      safeCall(function () {
        var ro = new ResizeObserver(function () {
          safeCall(update, null);
        });
        ro.observe(body);
        var content = body.firstElementChild;
        if (content) ro.observe(content);
      }, null);
    }
    update();
    return update;
  }
  /* The pane renders the REDACTED payload, not the live object: the exact text
     an operator's copy action hands over, so what they read on the dead page
     and what they paste into an issue can never disagree. The mask is applied
     to the SERIALIZED text (that is what catches every credential shape), so
     the text is re-parsed for the tree; if the re-parse fails the tree falls
     back to the live object rather than showing nothing. */
  function detailsSection(payload) {
    var treePayload = payload;
    try {
      var reparsed = JSON.parse(payloadText(payload));
      if (reparsed !== null && typeof reparsed === "object") treePayload = reparsed;
    } catch (e) {
      treePayload = payload;
    }
    var section = document.createElement("div");
    section.className = "hk-error-landing__details";
    var label = document.createElement("div");
    label.className = "hk-error-landing__details-label";
    label.setAttribute("aria-hidden", "true");
    var braces = document.createElementNS(SVG_NS_PANEL, "svg");
    braces.setAttribute("width", "11");
    braces.setAttribute("height", "11");
    braces.setAttribute("viewBox", "0 0 24 24");
    braces.setAttribute("fill", "none");
    braces.setAttribute("stroke", "currentColor");
    braces.setAttribute("stroke-width", "2");
    braces.setAttribute("stroke-linecap", "round");
    braces.setAttribute("stroke-linejoin", "round");
    var bracesPath = document.createElementNS(SVG_NS_PANEL, "path");
    bracesPath.setAttribute("d", "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1");
    var bracesPath2 = document.createElementNS(SVG_NS_PANEL, "path");
    bracesPath2.setAttribute("d", "M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1");
    braces.appendChild(bracesPath);
    braces.appendChild(bracesPath2);
    label.appendChild(braces);
    label.appendChild(treeSpan("", RAW_DETAILS_LABEL));
    var pane = document.createElement("div");
    pane.className = "hk-error-landing__details-pane";
    var body = document.createElement("div");
    body.className = "hk-error-landing__details-body";
    body.appendChild(renderJsonTree(treePayload));
    pane.appendChild(body);
    section.appendChild(label);
    section.appendChild(pane);
    detailsRefresh = attachPanelScrollbars(pane, body);
    return section;
  }
`;

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
  // Every opt-in half of the panel is guarded by "this surface must never
  // throw", so ALL of them share one safe-call primitive. The flag decides
  // whether that primitive is emitted at all — a host that configures nothing
  // new keeps the pre-diagnostics script byte for byte (BYTE-COMPAT).
  const needsHelpers = Boolean(
    resolved.rawDetailsLabel || resolved.browserBlock || resolved.reasons,
  );
  // The per-locale reason/block overrides change how the panel composes its
  // copy: instead of a single reason table it resolves (locale x reason). The
  // machinery is emitted only when a host actually supplied such a map, so a
  // single-language host keeps the script it has (BYTE-COMPAT).
  const reasonLocales = resolved.reasons
    ? Object.keys(resolved.reasons).some((key) => resolved.reasons[key].locales)
    : false;
  const blockLocales = Boolean(resolved.browserBlock && resolved.browserBlock.locales);
  const needsLocaleLayers = Boolean(resolved.copyTable && (reasonLocales || blockLocales));
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
    lines.push("  var COPY_TITLE = " + jsonAscii(resolved.copy.title) + ";");
    lines.push("  var COPY_MESSAGE = " + jsonAscii(resolved.copy.message) + ";");
    lines.push("  var COPY_RETRY = " + jsonAscii(resolved.copy.retry) + ";");
    if (resolved.copyTable) {
      lines.push(
        "  var COPY_FALLBACK = [COPY_TITLE, COPY_MESSAGE, COPY_RETRY];",
      );
      lines.push(
        "  var COPY_TABLE = " +
          copyTableLiteral(resolved.copyTable, resolved.rawDetailsLabel !== null) +
          ";",
      );
      lines.push(
        "  var STORAGE_KEY = " + jsonLiteral(resolved.storageKey) + ";",
      );
      lines.push(
        "  var OS_PREFS_GLOBAL = " + jsonLiteral(resolved.osPrefsGlobal) + ";",
      );
    }
    if (needsHelpers) {
      // One definition, emitted for EVERY shape that reaches for it , the
      // details runtime, the browser-block entry or the diagnostics entries.
      // A shape that referenced a helper it never emitted would fail SILENTLY
      // (every caller is wrapped in a guard), which is exactly the bug class
      // this single definition removes; boot-recovery.details.test.ts asserts
      // the definition order for each option combination.
      lines.push("  function safeCall(fn, fallback) {");
      lines.push("    try {");
      lines.push("      return fn();");
      lines.push("    } catch (e) {");
      lines.push("      return fallback;");
      lines.push("    }");
      lines.push("  }");
    }
    if (resolved.reasons) {
      // The reason table: one row per class, English defaults filled in for
      // every class the host left out, so no reason can paint a blank
      // headline. Serialised through jsonAscii like every other string.
      //
      // Row shape: [reason, title, message, translations]. `translations` is
      // an object of normalised locale tag -> [title, message], present only
      // for a multilingual host; the runtime resolves the current locale's
      // entry first and drops to the panel's GENERIC copy for that locale when
      // the class has no translation there (never to the English reason row).
      const rows = [];
      for (const reason of BOOT_RECOVERY_REASON_KEYS) {
        const chosen = resolved.reasons[reason] || BOOT_RECOVERY_REASONS[reason];
        let row =
          "[" +
          jsonAscii(reason) +
          "," +
          jsonAscii(chosen.title) +
          "," +
          jsonAscii(chosen.message);
        if (resolved.reasons[reason] && resolved.reasons[reason].locales) {
          const pairs = [];
          const map = resolved.reasons[reason].locales;
          for (const tag of Object.keys(map)) {
            pairs.push(
              jsonAscii(tag) +
                ":[" +
                jsonAscii(map[tag].title) +
                "," +
                jsonAscii(map[tag].message) +
                "]",
            );
          }
          row += ",{" + pairs.join(",") + "}";
        }
        rows.push(row + "]");
      }
      lines.push("  var REASON_TABLE = [" + rows.join(",") + "];");
      // Source and flags ride as two plain strings and are rebuilt with the
      // RegExp constructor: a serialised regex literal would arrive with its
      // slashes on (String(/x/i) is "/x/i"), and the rebuilt pattern would then
      // never match. The trailing "i" is the family's own flag set.
      lines.push(
        "  var CHUNK_MISS_RE = new RegExp(" +
          jsonAscii(BOOT_RECOVERY_CHUNK_MISS.source) +
          ', "i");',
      );
    }
    if (resolved.browserBlock) {
      lines.push(
        "  var BLOCK_GLOBAL = " + jsonAscii(resolved.browserBlock.global) + ";",
      );
      lines.push(
        "  var BLOCK_TITLE = " + jsonAscii(resolved.browserBlock.title) + ";",
      );
      lines.push(
        "  var BLOCK_MSG = " + jsonAscii(resolved.browserBlock.message) + ";",
      );
      // The three placeholder values arrive from the host's UA check on every
      // call; they are page-runtime strings, never baked into the build.
      lines.push('  var blockBrowser = "";');
      lines.push('  var blockCurrent = "";');
      lines.push('  var blockMin = "";');
      if (blockLocales) {
        // Per-locale block wording: a multilingual host translates the notice
        // like the rest of the panel, and its default pair is the fallback for
        // a locale the host did not translate.
        const pairs = [];
        const map = resolved.browserBlock.locales;
        for (const tag of Object.keys(map)) {
          pairs.push(
            jsonAscii(tag) +
              ":[" +
              jsonAscii(map[tag].title) +
              "," +
              jsonAscii(map[tag].message) +
              "]",
          );
        }
        lines.push("  var BLOCK_TRANSLATIONS = {" + pairs.join(",") + "};");
      }
    }
    if (resolved.globals.fatal) {
      lines.push(
        "  var FATAL_GLOBAL = " + jsonAscii(resolved.globals.fatal) + ";",
      );
    }
    if (resolved.globals.ready) {
      lines.push(
        "  var READY_GLOBAL = " + jsonAscii(resolved.globals.ready) + ";",
      );
    }
    lines.push("  var PANEL_CSS = " + jsonAscii(BOOT_LANDING_CSS) + ";");
    if (needsLocaleLayers) {
      // The locale the panel is painting in, plus that locale's GENERIC copy.
      // Both halves of the multilingual matrix read them: a reason class or a
      // block entry without a translation in this locale drops to that
      // locale's generic wording rather than to another language's text.
      lines.push("  var GENERIC_LOCALE = null;");
      lines.push("  var GENERIC_TITLE = COPY_TITLE;");
      lines.push("  var GENERIC_MESSAGE = COPY_MESSAGE;");
    }
    if (resolved.rawDetailsLabel) {
      lines.push("  var DETAILS_CSS = " + jsonAscii(BOOT_LANDING_DETAILS_CSS) + ";");
      lines.push("  var RAW_DETAILS_LABEL = " + jsonAscii(resolved.rawDetailsLabel) + ";");
      lines.push("  var PAYLOAD_TIMEOUT_MS = DEADLINE_MS;");
      lines.push("  var bootStartedAt = Date.now();");
      lines.push(CURRENT_LOCALE_LINE);
      lines.push(RESOURCE_RUNTIME);
      lines.push(DETAILS_RUNTIME);
    } else if (resolved.reasons) {
      // The reason table's watchdog needs the same diagnosis to tell a chunk
      // miss from a plain timeout, without the pane's renderer.
      lines.push(RESOURCE_RUNTIME);
    }
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
    if (resolved.reasons) {
      lines.push(
        "  /* The reason table lookup: <reason> selects the headline and",
      );
      lines.push(
        "     explanation, so a chunk miss and a timeout no longer paint the same",
      );
      lines.push(
        "     paragraph. Unknown reasons fall back to the error class, exactly like",
      );
      lines.push("     the family script's REASON_PREFIX default. */");
      lines.push("  function reasonRow(reason) {");
      lines.push("    for (var i = 0; i < REASON_TABLE.length; i++) {");
      lines.push("      if (REASON_TABLE[i][0] === reason) return REASON_TABLE[i];");
      lines.push("    }");
      lines.push("    return REASON_TABLE[2];");
      lines.push("  }");
      lines.push("  function reasonCopy(reason) {");
      lines.push("    var row = reasonRow(reason);");
      if (needsLocaleLayers) {
        // The multilingual matrix — the retired family script's own shape
        // (t[prefix + suffix] ?? t["error" + suffix]): the current locale's
        // translation of THIS class wins; when that locale has none, the panel
        // falls back to the CURRENT LOCALE's GENERIC wording, never to another
        // language's reason row — a translated panel showing one English
        // sentence reads as a bug. The row's own title/message is the fallback
        // for a page that resolved NO locale at all (and is what the
        // single-language shapes paint, unchanged); a host that wants the
        // reason wording in its base language lists that tag in `locales`.
        lines.push("    if (GENERIC_LOCALE) {");
        lines.push("      var translations = row[3] || null;");
        lines.push("      var keys = [GENERIC_LOCALE];");
        lines.push('      var parts = GENERIC_LOCALE.split("-");');
        lines.push("      for (var d = 1; d < parts.length; d++) {");
        lines.push('        keys.push(parts.slice(0, parts.length - d).join("-"));');
        lines.push("      }");
        lines.push("      keys.push(parts[0]);");
        lines.push("      for (var k = 0; k < keys.length; k++) {");
        lines.push("        var hit = translations ? translations[keys[k]] : null;");
        lines.push("        if (hit) return [hit[0], hit[1]];");
        lines.push("      }");
        // This locale has no translation for the class: use that locale's own
        // generic wording, which the panel already carries.
        lines.push("      return [GENERIC_TITLE, GENERIC_MESSAGE];");
        lines.push("    }");
      }
      lines.push("    return [row[1], row[2]];");
      lines.push("  }");
      lines.push("");
      lines.push(
        "  /* Chunk-miss classification: a bundle that could not be FETCHED is a",
      );
      lines.push(
        "     resource failure, not a script bug, and gets its own headline. The",
      );
      lines.push(
        "     pattern is the family's own browser-family list, verbatim. */",
      );
      lines.push("  function reasonOf(message) {");
      lines.push("    var text = safeCall(function () {");
      lines.push("      return String(message || \"\");");
      lines.push('    }, "");');
      lines.push('    return CHUNK_MISS_RE.test(text) ? "chunk" : "error";');
      lines.push("  }");
      lines.push("");
      lines.push(
        "  /* Which class the WATCHDOG reports when nothing was captured: a boot",
      );
      lines.push(
        "     script that fetched and was REFUSED is a chunk miss; otherwise the",
      );
      lines.push("     app simply never showed up, which is a timeout. */");
      lines.push("  function staleReason() {");
      lines.push("    var stale = 0;");
      lines.push("    try {");
      lines.push("      var scripts = bootScripts(resourceIndex());");
      lines.push("      for (var i = 0; i < scripts.length; i++) {");
      lines.push('        if (scripts[i].state === "failed") stale++;');
      lines.push("      }");
      lines.push("    } catch (e) {");
      lines.push("      stale = 0;");
      lines.push("    }");
      lines.push('    return stale ? "chunk" : "timeout";');
      lines.push("  }");
      lines.push("");
      lines.push(
        "  /* __appFatal: the host captured a pre-mount error. The panel paints",
      );
      lines.push(
        "     IMMEDIATELY with the error/chunk class and the raw payload, which is",
      );
      lines.push("     the only way an operator learns WHY the app never mounted. */");
      lines.push("  function raiseFatal(message, detail) {");
      lines.push("    try {");
      lines.push("      var loading = document.querySelector(LOADING_SELECTOR);");
      lines.push("      if (!loading) return;");
      lines.push("      showFailure(loading, reasonOf(message), message, detail);");
      lines.push("    } catch (e) {}");
      lines.push("  }");
      lines.push("");
      lines.push(
        "  /* __appReady: the app mounted, so stand the panel down. It removes ONLY",
      );
      lines.push(
        "     the nodes this script added: the host's loader element, its",
      );
      lines.push(
        "     contents and its dismissal class belong to the host's loader logic,",
      );
      lines.push("     and a boot-failure surface must never fight it. */");
      lines.push("  function standDown() {");
      lines.push("    try {");
      lines.push("      var loading = document.querySelector(LOADING_SELECTOR);");
      lines.push("      if (!loading) return;");
      lines.push('      var panel = loading.querySelector("[data-hk-boot-recovery-panel]");');
      lines.push("      if (!panel) return;");
      lines.push("      var style = panel.previousElementSibling;");
      lines.push("      if (panel.parentNode) panel.parentNode.removeChild(panel);");
      lines.push('      if (style && style.tagName === "STYLE" && style.parentNode) {');
      lines.push("        style.parentNode.removeChild(style);");
      lines.push("      }");
      lines.push("    } catch (e) {}");
      lines.push("  }");
      // Each entry publishes only when it was actually configured: an absent
      // global is "off", and referencing the name unconditionally would throw
      // on the shapes that disabled it.
      if (resolved.globals.fatal) {
        lines.push("  try {");
        lines.push("    window[" + jsonAscii(resolved.globals.fatal) + "] = raiseFatal;");
        lines.push("  } catch (e) {}");
      }
      if (resolved.globals.ready) {
        lines.push("  try {");
        lines.push("    window[" + jsonAscii(resolved.globals.ready) + "] = standDown;");
        lines.push("  } catch (e) {}");
      }
      lines.push("");
    }

    lines.push("  setTimeout(function () {");
    lines.push("    try {");
    lines.push("      var loading = document.querySelector(LOADING_SELECTOR);");
    lines.push(
      "      if (!loading) return; /* mounted: the host removed the loader */",
    );
    lines.push(
      "      if (DISMISSED_CLASS && loading.classList && loading.classList.contains(DISMISSED_CLASS)) return;",
    );
    if (resolved.reasons) {
      lines.push(
        "      /* No captured error reached __appFatal, but the payload may know",
      );
      lines.push(
        "         better: a boot script that FETCHED and was refused (a 404 on the",
      );
      lines.push(
        "         entry chunk is the stale-tab-after-redeploy signature) never hits",
      );
      lines.push(
        "         window.onerror, and calling that a timeout hides the one",
      );
      lines.push(
        "         actionable fact there is. Only the BOOT scripts count: a 404 on",
      );
      lines.push(
        "         an unrelated stylesheet is not why the app failed to mount. */",
      );
      lines.push('      showFailure(loading, staleReason(), "", null);');
    } else {
      lines.push("      showFailure(loading);");
    }
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
      lines.push("     4. no match - the host fallback triple (COPY_FALLBACK).");
      lines.push("     Each candidate tag is matched against COPY_TABLE exactly, then");
      lines.push("     with trailing subtags progressively stripped, then by its");
      lines.push("     primary subtag alone; entries sharing a primary subtag resolve");
      lines.push("     to the FIRST one the host listed. The winning entry is returned");
      lines.push(
        "     as its [title, message, retry] triple, like COPY_FALLBACK; a",
      );
      lines.push("     row without a title inherits COPY_TITLE. */");
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
      if (resolved.rawDetailsLabel || needsLocaleLayers) {
        // The single landing point for a matched table row. It records the tag
        // the panel actually painted, so the payload reports it and the
        // per-locale reason/block layers can resolve THAT locale's copy, and
        // returns the [title, message, retry, label] tuple pickCopy promises.
        // Slot 3 is the details pane's per-locale label (present only with the
        // pane; "" falls back to the host default at paint time).
        lines.push("  function hitRow(row) {");
        lines.push("    var tag = typeof row[0] === \"string\" && row[0] ? row[0] : null;");
        if (resolved.rawDetailsLabel) {
          lines.push("    if (tag) currentLocale = tag;");
        }
        if (needsLocaleLayers) {
          // The GENERIC copy of the locale that won — the fallback a reason
          // class without a translation in this locale drops to.
          lines.push("    GENERIC_LOCALE = tag;");
          lines.push("    GENERIC_TITLE = row[1] || COPY_TITLE;");
          lines.push("    GENERIC_MESSAGE = row[2];");
        }
        if (resolved.rawDetailsLabel) {
          lines.push("    return [row[1] || COPY_TITLE, row[2], row[3], row[4] || RAW_DETAILS_LABEL];");
        } else {
          lines.push("    return [row[1] || COPY_TITLE, row[2], row[3]];");
        }
        lines.push("  }");
      }

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
      // Two features need the matched row's TAG, which only hitRow can see:
      // the details pane (to report the locale it painted) and the per-locale
      // reason/block layers (to pick that locale's copy). A locale-table host
      // with neither keeps the plain literal, byte for byte (BYTE-COMPAT).
      const hitReturn =
        resolved.rawDetailsLabel || needsLocaleLayers
          ? "hitRow(hit);"
          : "[hit[1] || COPY_TITLE, hit[2], hit[3]];";
      lines.push("    for (var c = 0; c < candidates.length; c++) {");
      lines.push("      var hit = tableHit(localeKey(candidates[c], 0));");
      lines.push("      if (hit) return " + hitReturn);
      lines.push('      var parts = String(candidates[c]).replace(/_/g, "-").toLowerCase().split("-");');
      lines.push("      for (var drop = 1; drop < parts.length; drop++) {");
      lines.push("        hit = tableHit(localeKey(candidates[c], drop));");
      lines.push("        if (hit) return " + hitReturn);
      lines.push("      }");
      lines.push("      hit = primaryHit(candidates[c]);");
      lines.push("      if (hit) return " + hitReturn);
      lines.push("    }");
      lines.push("    return null;");
      lines.push("  }");
    }
    lines.push("");
    lines.push(
      "  /* HkErrorLanding's error glyph: lucide's triangle-alert (ISC),",
    );
    lines.push(
      "     created through the SVG DOM so the panel parses no markup. */",
    );
    lines.push('  var SVG_NS = "http://www.w3.org/2000/svg";');
    lines.push("  var ICON_PATHS = [");
    lines.push(
      '    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",',
    );
    lines.push('    "M12 9v4",');
    lines.push('    "M12 17h.01",');
    lines.push("  ];");
    lines.push("  function toneIcon() {");
    lines.push('    var svg = document.createElementNS(SVG_NS, "svg");');
    lines.push('    svg.setAttribute("width", "28");');
    lines.push('    svg.setAttribute("height", "28");');
    lines.push('    svg.setAttribute("viewBox", "0 0 24 24");');
    lines.push('    svg.setAttribute("fill", "none");');
    lines.push('    svg.setAttribute("stroke", "currentColor");');
    lines.push('    svg.setAttribute("stroke-width", "2");');
    lines.push('    svg.setAttribute("stroke-linecap", "round");');
    lines.push('    svg.setAttribute("stroke-linejoin", "round");');
    lines.push("    for (var i = 0; i < ICON_PATHS.length; i++) {");
    lines.push('      var path = document.createElementNS(SVG_NS, "path");');
    lines.push('      path.setAttribute("d", ICON_PATHS[i]);');
    lines.push("      svg.appendChild(path);");
    lines.push("    }");
    lines.push("    return svg;");
    lines.push("  }");
    lines.push("");
    lines.push(
      "  /* Replace the loader's contents with the HkErrorLanding card. Built",
    );
    lines.push(
      "     from constant strings through DOM APIs only: no markup parsing",
    );
    lines.push(
      "     and no page input, so there is nothing to escape or inject. */",
    );
    if (resolved.browserBlock) {
      lines.push(
        "  /* Fill the block copy's three placeholders from the CURRENT call's",
      );
      lines.push(
        "     arguments. Every occurrence, always with a string: a hostile argument",
      );
      lines.push(
        "     degrades its own field instead of leaving {browser} on the card. */",
      );
      lines.push("  function fillBlock(template) {");
      lines.push(
        '    var text = safeCall(function () { return String(template); }, "");',
      );
      lines.push('    return text.split("{browser}").join(blockBrowser)');
      lines.push('      .split("{current}").join(blockCurrent)');
      lines.push('      .split("{min}").join(blockMin);');
      lines.push("  }");
      if (blockLocales) {
        // The block entry's per-locale wording: the locale the panel selected
        // first, then its progressively stripped subtags, then the host's
        // default pair. Same resolution order as the copy table itself, so a
        // panel never mixes two locales' vocabulary.
        lines.push("  function blockCopy() {");
        lines.push("    if (GENERIC_LOCALE) {");
        lines.push("      var keys = [GENERIC_LOCALE];");
        lines.push('      var parts = GENERIC_LOCALE.split("-");');
        lines.push("      for (var d = 1; d < parts.length; d++) {");
        lines.push('        keys.push(parts.slice(0, parts.length - d).join("-"));');
        lines.push("      }");
        lines.push("      keys.push(parts[0]);");
        lines.push("      for (var k = 0; k < keys.length; k++) {");
        lines.push("        var hit = BLOCK_TRANSLATIONS[keys[k]];");
        lines.push("        if (hit) return hit;");
        lines.push("      }");
        lines.push("    }");
        lines.push("    return [BLOCK_TITLE, BLOCK_MSG];");
        lines.push("  }");
      }
      lines.push("");
      lines.push(
        "  /* Browser-block entry: the family's long-standing __appBlock contract,",
      );
      lines.push(
        "     republished on whatever global the host configured. It paints the",
      );
      lines.push(
        "     panel IMMEDIATELY (an unsupported browser is already the answer,",
      );
      lines.push("     waiting out the watchdog would only delay the news), in the");
      lines.push("     landing's info tone, and never reloads. */");
      lines.push("  function showBrowserBlock(loading, browser, current, min) {");
      lines.push("    if (loading) {");
      lines.push("      try {");
      lines.push("        showFailure(loading, \"browser\");");
      lines.push("      } catch (e) {}");
      lines.push("    }");
      lines.push("  }");
      lines.push("");
      lines.push("  function raiseBrowserBlock(browser, current, min) {");
      lines.push("    try {");
      lines.push("      blockBrowser = browser == null ? \"\" : String(browser);");
      lines.push("      blockCurrent = current == null ? \"\" : String(current);");
      lines.push("      blockMin = min == null ? \"\" : String(min);");
      lines.push("    } catch (e) {");
      lines.push("      blockBrowser = \"\";");
      lines.push("      blockCurrent = \"\";");
      lines.push("      blockMin = \"\";");
      lines.push("    }");
      lines.push("    try {");
      lines.push("      var loading = document.querySelector(LOADING_SELECTOR);");
      lines.push("      if (!loading) return;");
      lines.push("      showBrowserBlock(loading, blockBrowser, blockCurrent, blockMin);");
      lines.push("    } catch (e) {}");
      lines.push("  }");
      // Published unconditionally at THIS site: reaching it means the host
      // configured copy.browserBlock, so there is always a panel to raise.
      lines.push("  try {");
      lines.push("    window[" + jsonAscii(resolved.browserBlock.global) + "] = raiseBrowserBlock;");
      lines.push("  } catch (e) {}");
      lines.push("");
      // The signature grows (reason, message, error) so ONE card builder serves
      // the watchdog's panel, the browser-block entry's info panel and the
      // __appFatal entry. Without any opt-in the signature stays
      // single-argument, so a host that configured nothing keeps
      // byte-identical output.
      lines.push("  function showFailure(loading, reason, message, error) {");
    } else if (resolved.reasons) {
      lines.push("  function showFailure(loading, reason, message, error) {");
    } else {
      lines.push("  function showFailure(loading) {");
    }
    lines.push('    loading.textContent = "";');
    if (resolved.browserBlock) {
      lines.push('    var isBlock = reason === "browser";');
    }
    if (resolved.browserBlock || resolved.reasons) {
      lines.push("    var copy;");
      if (resolved.copyTable) {
        lines.push("    copy = pickCopy() || COPY_FALLBACK;");
        if (needsLocaleLayers) {
          // pickCopy recorded the winning locale through hitRow; a MISSED
          // table leaves the generic copy variables at their defaults (the
          // host's single-copy triple), which is the right fallback.
          lines.push("    if (!copy) {");
          lines.push("      GENERIC_LOCALE = null;");
          lines.push("      GENERIC_TITLE = COPY_TITLE;");
          lines.push("      GENERIC_MESSAGE = COPY_MESSAGE;");
          lines.push("      copy = COPY_FALLBACK;");
          lines.push("    }");
        }
      } else {
        lines.push("    copy = [COPY_TITLE, COPY_MESSAGE, COPY_RETRY];");
      }
      if (resolved.reasons) {
        // The watchdog's default class is a timeout; a captured cause
        // (__appFatal) carries its own class through reasonOf().
        lines.push('    var reasonName = reason || "timeout";');
        lines.push("    var reasonText = reasonCopy(reasonName);");
        lines.push("    copy = [reasonText[0], reasonText[1], copy[2] || COPY_RETRY];");
      }
      if (resolved.browserBlock) {
        // The block panel's copy is the HOST's product wording, not the boot
        // failure copy: title/message come from the block entry with the three
        // placeholders filled from the call's arguments. A multilingual host's
        // per-locale block entry overrides the default pair for the locale the
        // panel is painting in, so the notice is translated like the rest.
        lines.push("    if (isBlock) {");
        if (blockLocales) {
          lines.push("      var blockRow = blockCopy();");
          lines.push("      copy = [fillBlock(blockRow[0]), fillBlock(blockRow[1]), copy[2] || COPY_RETRY];");
        } else {
          lines.push("      copy = [fillBlock(BLOCK_TITLE), fillBlock(BLOCK_MSG), copy[2] || COPY_RETRY];");
        }
        lines.push("    }");
      }
    } else if (resolved.copyTable) {
      lines.push("    var copy = pickCopy() || COPY_FALLBACK;");
    } else {
      lines.push("    var copy = [COPY_TITLE, COPY_MESSAGE, COPY_RETRY];");
    }
    if (resolved.rawDetailsLabel) {
      // The details pane is opt-in, so its sheet rides its own <style> and is
      // absent from a default host's script entirely (BYTE-COMPAT).
      lines.push('    var detailsStyle = document.createElement("style");');
      lines.push("    detailsStyle.textContent = DETAILS_CSS;");
      if (resolved.copyTable) {
        lines.push(
          "    RAW_DETAILS_LABEL = copy.length > 3 && copy[3] ? copy[3] : RAW_DETAILS_LABEL;",
        );
      }
    }
    lines.push('    var style = document.createElement("style");');
    lines.push("    style.textContent = PANEL_CSS;");
    lines.push('    var landing = document.createElement("div");');
    if (resolved.browserBlock) {
      // An unsupported browser is a compatibility notice, not a crash: the
      // landing's own info tone repaints the disc AND the card wash, so the
      // class carries both and no inline style is needed.
      lines.push(
        '    landing.className = isBlock ? "hk-error-landing is-info is-inline" : "hk-error-landing is-error is-inline";',
      );
    } else {
      lines.push('    landing.className = "hk-error-landing is-error is-inline";');
    }
    lines.push('    landing.setAttribute("role", "alert");');
    lines.push('    landing.setAttribute("data-hk-boot-recovery-panel", "");');
    lines.push('    var card = document.createElement("div");');
    lines.push('    card.className = "hk-error-landing__card";');
    lines.push('    var icon = document.createElement("div");');
    lines.push('    icon.className = "hk-error-landing__icon";');
    lines.push('    icon.setAttribute("aria-hidden", "true");');
    lines.push("    icon.appendChild(toneIcon());");
    lines.push('    var heading = document.createElement("h1");');
    lines.push('    heading.className = "hk-error-landing__title";');
    lines.push("    heading.textContent = copy[0];");
    lines.push('    var message = document.createElement("p");');
    lines.push('    message.className = "hk-error-landing__desc";');
    lines.push("    message.textContent = copy[1];");
    lines.push('    var actions = document.createElement("div");');
    lines.push('    actions.className = "hk-error-landing__actions";');
    lines.push('    var button = document.createElement("button");');
    lines.push('    button.type = "button";');
    lines.push('    button.className = "hk-btn hk-btn-primary hk-btn-sm";');
    lines.push("    button.textContent = copy[2];");
    lines.push('    button.addEventListener("click", retry);');
    lines.push("    actions.appendChild(button);");
    lines.push("    card.appendChild(icon);");
    lines.push("    card.appendChild(heading);");
    lines.push("    card.appendChild(message);");
    if (resolved.rawDetailsLabel) {
      // Between the explanation and the action row — HkErrorLanding's own order.
      // The payload is built INSIDE a guard: a hostile page must not cost the
      // card, which is already up by the time this runs.
      if (resolved.browserBlock) {
        // The block panel is a compatibility notice, not a failure, so it
        // carries no raw-details pane — only a real failure does.
        lines.push("    if (!isBlock) {");
      }
      lines.push("    var payload = null;");
      lines.push("    try {");
      if (resolved.reasons) {
        lines.push('      payload = buildPayload(reason || "timeout", message || copy[1], error || null);');
      } else {
        lines.push('      payload = buildPayload("timeout", copy[1], null);');
      }
      lines.push("    } catch (e) {");
      lines.push("      payload = null;");
      lines.push("    }");
      lines.push("    if (payload) {");
      lines.push("      try {");
      lines.push("        card.appendChild(detailsSection(payload));");
      lines.push("      } catch (e) {}");
      lines.push("    }");
      if (resolved.browserBlock) {
        lines.push("    }");
      }
    }
    lines.push("    card.appendChild(actions);");
    lines.push("    landing.appendChild(card);");
    if (resolved.rawDetailsLabel) {
      lines.push("    loading.appendChild(detailsStyle);");
    }
    lines.push("    loading.appendChild(style);");
    lines.push("    loading.appendChild(landing);");
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
 *     title?: string,
 *     message?: string,
 *     retry?: string,
 *     locales?: Record<string, { title?: string, message: string, retry: string }>,
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
