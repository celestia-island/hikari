// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import type { Plugin } from "vite";

/**
 * Types for `boot-recovery.mjs` — the published Vite plugin entry
 * (`@celestia-island/hikari/plugins/boot-recovery`).
 *
 * The implementation is plain ESM loaded from `node_modules` while a consumer's
 * `vite.config.*` is resolved, where TypeScript cannot be stripped and Vite's
 * `configLoader: "runner"` tears the module runner down before plugin hooks
 * run. Keep the runtime file limited to static imports (`node:path` plus the
 * generated `./bootLandingCss.mjs` sheet — both plain ESM, no dynamic import).
 */

/** The canonical Tauri app origin on Windows/Android. */
export declare const BOOT_RECOVERY_CANONICAL_ORIGIN: "http://tauri.localhost";

/** Default watchdog delay in ms. */
export declare const BOOT_RECOVERY_DEADLINE_MS: 15000;

/** Default selector of the host's static loading element. */
export declare const BOOT_RECOVERY_LOADING_SELECTOR: "#loading-screen";

/** Default class that marks a loading element as already dismissed. */
export declare const BOOT_RECOVERY_DISMISSED_CLASS: "hidden";

/** Default failure-panel title (English; override through `copy.title`). */
export declare const BOOT_RECOVERY_TITLE: string;

/** Default failure-panel message (English; override through `copy.message`). */
export declare const BOOT_RECOVERY_MESSAGE: string;

/** Default failure-panel retry label (English; override through `copy.retry`). */
export declare const BOOT_RECOVERY_RETRY: string;

/** Marker attribute on the injected inline `<script>` tag. */
export declare const BOOT_RECOVERY_ATTR: "data-hk-boot-recovery";

/** Default name of the unsupported-browser entry (the family's `__appBlock`). */
export declare const BOOT_RECOVERY_BLOCK_GLOBAL: "__appBlock";

/** Default name of the pre-mount error report (the family's `__appFatal`). */
export declare const BOOT_RECOVERY_FATAL_GLOBAL: "__appFatal";

/** Default name of the mount-succeeded handoff (the family's `__appReady`). */
export declare const BOOT_RECOVERY_READY_GLOBAL: "__appReady";

/** The reason classes the panel can paint, in the family's order. */
export declare const BOOT_RECOVERY_REASON_KEYS: readonly [
  "timeout",
  "chunk",
  "error",
  "browser",
];

/** The English default copy per reason class. */
export declare const BOOT_RECOVERY_REASONS: Readonly<
  Record<"timeout" | "chunk" | "error" | "browser", { title: string; message: string }>
>;

/** The chunk-miss signatures the panel classifies a failure by. */
export declare const BOOT_RECOVERY_CHUNK_MISS: RegExp;

/** The default options, frozen (see {@link BootRecoveryPluginOptions}). */
export interface BootRecoveryDefaults {
  readonly canonicalOrigin: string;
  readonly deadlineMs: number;
  readonly loadingScreen: Readonly<{
    selector: string;
    dismissedClass: string;
  }>;
  readonly copy: Readonly<{ title: string; message: string; retry: string }>;
  readonly injectTo: "head" | "head-prepend";
}

/** Frozen snapshot of every default. */
export declare const BOOT_RECOVERY_DEFAULTS: Readonly<BootRecoveryDefaults>;

/** The loading-screen half of the recovery (the watchdog). */
export interface BootRecoveryLoadingScreenOptions {
  /** Element whose contents are replaced when nothing mounted (default `#loading-screen`). */
  selector?: string;
  /** Class marking the element as dismissed/fading (default `hidden`; empty disables the check). */
  dismissedClass?: string;
}

/** Overridable failure-panel copy (English defaults). */
export interface BootRecoveryCopyOptions {
  /**
   * Headline of the panel. The failure surface is the shared
   * `HkErrorLanding` card (tone icon, headline, explanation, action), so a
   * host that translates its failure page supplies this per locale; an
   * empty value falls back to the English default.
   */
  title?: string;
  /** Main message (the landing card's explanation) of the panel. */
  message?: string;
  /** Retry button label. */
  retry?: string;
  /**
   * Host translations of the panel copy, keyed by BCP 47-ish locale tags
   * (`"en-US"`, `"zh-CN"`, `"zh-TW"`, …). Keys are normalised at config
   * time (trimmed, lowercased, `_` → `-`); insertion order is preserved and
   * breaks ties when several keys share a primary subtag (`zh-CN` listed
   * before `zh-TW` means a `zh-HK` request resolves to the zh-CN entry).
   * Every entry must carry non-empty `message` and `retry` strings —
   * anything else fails the build loudly, as does two keys normalising to
   * the same tag. `title` is optional: a row without one paints the host's
   * default title over localized copy, so a translating host should supply
   * it. Omitting the table (or passing it empty) keeps the single-copy
   * script — the same shape apart from the copy it embeds — so a host that
   * hashes the script into its CSP only needs to refresh the hash it
   * already owns.
   */
  locales?: Record<
    string,
    {
      title?: string;
      message: string;
      retry: string;
      /** Translated heading of the raw-details pane; omitted falls back to
       *  the host's `rawDetailsLabel`. */
      rawDetailsLabel?: string;
    }
  >;
  /**
   * `localStorage` key that holds the host's saved UI locale tag (WoWSP
   * uses `"wowsp-ui-locale"`). Consulted FIRST — the user's explicit
   * in-app choice outranks the shell's OS preference and the navigator
   * list. Only meaningful together with `locales`: configuring it without
   * a table fails at config time.
   */
  storageKey?: string;
  /**
   * Heading of the panel's RAW-DETAILS pane, and the pane's ON/OFF switch.
   *
   * Configuring it makes the failure panel carry a diagnostic snapshot of the
   * dead page — reason, message, `capturedAt`, `elapsedMs`, `timeoutMs`,
   * `readyState`, `appMounted`, `locale`, `buildHash`, `href`,
   * `bootScripts`, `failedResources` and (when a failure was captured) the
   * `error` detail — rendered as the same collapsible `HkJsonTree` the in-app
   * error landing uses, inside `HkErrorLanding`'s own standing frame and under
   * hikari's overlay scrollbar chrome. Credential-shaped values are masked with
   * the family's three-disc rule before they reach the pane, because that text
   * is what a user pastes into an issue.
   *
   * Omit it (or pass `""`) and the generated script is byte-identical to the
   * panel without the pane — the CSP hash a host already owns keeps working.
   * An explicit `false` loading screen cannot be combined with it: the pane
   * lives inside the watchdog's panel, which heal-only mode never paints, so
   * that combination fails at config time.
   *
   * With `locales` configured, a row may carry its own `rawDetailsLabel` to
   * translate the heading; a row without one falls back to this value.
   */
  rawDetailsLabel?: string;
  /**
   * The BROWSER-BLOCK notice — the panel's info-tone mode for a shell that
   * refuses to run on an unsupported browser.
   *
   * Configuring it makes the generated script publish
   * `window[globals.block](browser, current, min)`, the SAME call the family's
   * hand-rolled `res/fatal-fallback.js` exposed as `__appBlock` — so a host's
   * existing UA check keeps working with no source change. The call paints the
   * panel IMMEDIATELY (an unsupported browser is already the answer, so waiting
   * out the watchdog would only delay the news), in the landing's `info` tone
   * rather than `error` (a compatibility notice is not a crash), and never
   * reloads.
   *
   * `title` and `message` are the host's product wording; `message` may carry
   * the placeholders `{browser}`, `{current}` and `{min}`, filled from the
   * call's three arguments at page runtime. The block notice never carries the
   * raw-details pane, whatever `rawDetailsLabel` says.
   *
   * Omit it (or pass `false`) and the script is byte-identical to the panel
   * without the entry. Cannot be combined with `loadingScreen: false`: the
   * notice paints inside the loading element, which heal-only mode never
   * touches.
   */
  browserBlock?:
    | {
        title: string;
        message: string;
        /**
         * Per-locale translations of the notice, keyed by BCP 47-ish tag. Tags
         * normalise like `copy.locales` keys (trimmed, lowercased, `_` → `-`),
         * and two keys collapsing onto one tag fail the build. The current
         * locale's entry wins; a locale this map omits paints the top-level
         * `title`/`message`, so those must be in the host's base language.
         * Placeholders work inside translated entries too.
         */
        locales?: Record<string, { title: string; message: string }>;
      }
    | false;
  /**
   * The REASON TABLE: what the panel says for each class of boot failure.
   *
   * Four classes, the family's long-standing set — `timeout` (nothing
   * mounted before `deadlineMs`), `chunk` (a bundle could not be FETCHED; the
   * stale-tab-after-redeploy signature), `error` (a captured pre-mount
   * exception) and `browser` (an unsupported browser). Each is
   * `{ title, message }`; a class the host omits keeps its English default,
   * so no class can ever paint a blank headline. The classification itself is
   * automatic: the watchdog reads the resource timing table to tell a chunk
   * miss from a plain timeout, and `__appFatal`'s message is matched against
   * the browser family of chunk-miss patterns.
   *
   * Configuring the table ALSO publishes the `__appFatal` and `__appReady`
   * entries (see {@link globals}) — the two remaining globals the family
   * script provided, and the reason a host can retire it at all:
   * `__appFatal(message, detail?)` paints the panel at once with the
   * classified reason and a payload carrying the error detail;
   * `__appReady()` stands the panel down after a successful mount, removing
   * ONLY the nodes this script added (never the host's loader element, its
   * contents or its dismissal class).
   *
   * Omit it and the script is byte-identical to the panel without the table.
   * Cannot be combined with `loadingScreen: false`.
   */
  reasons?: Partial<
    Record<
      "timeout" | "chunk" | "error" | "browser",
      {
        title: string;
        message: string;
        /**
         * Per-locale translations of THIS class — what makes the table usable
         * by a multilingual host.
         *
         * Without it, the class's single `title`/`message` OVERWRITES the
         * headline and explanation `copy.locales` already selected, so a host
         * configuring both gets one language's reason wording above another
         * language's retry button. With it, the panel resolves the matrix the
         * retired `res/fatal-fallback.js` carried:
         *
         *   1. the current locale's translation of this class;
         *   2. otherwise THIS LOCALE's generic wording (the row `copy.locales`
         *      already selected) — never another language's reason text,
         *      because a translated panel showing one foreign sentence reads
         *      as a bug;
         *   3. otherwise (no locale resolved at all) the `title`/`message`
         *      above.
         *
         * So write the base-language wording in `title`/`message` and
         * translate the rest through this map. Tags normalise like
         * `copy.locales` keys; matching also strips trailing subtags
         * (`zh-Hant-CN` finds a `zh` entry).
         *
         * @example
         * // ⚠ LIST YOUR BASE LANGUAGE IN `copy.locales` TOO.
         * // The `title`/`message` above only paint when NO locale resolved. A panel
         * // that resolved `en` instead uses the en row from `copy.locales` for any
         * // class this map does not translate — `en` itself included. Omit the `en`
         * // row and English users get a generic paragraph instead of the headline.
         * // (A real host shipped exactly this bug.)
         * copy: {
         *   locales: {
         *     // EVERY language the panel can paint in, base language included:
         *     en: { title: "Application failed to load", message: "…", retry: "Reload" },
         *     "zh-CN": { title: "应用加载失败", message: "…", retry: "刷新" },
         *   },
         *   reasons: {
         *     timeout: {
         *       title: "Application initialization timed out",
         *       message: "The app did not finish initializing in time.",
         *       locales: {
         *         en: { title: "Application initialization timed out",
         *               message: "The app did not finish initializing in time." },
         *         "zh-CN": { title: "应用初始化超时",
         *                    message: "应用未在预期时间内完成初始化。" },
         *       },
         *     },
         *   },
         * }
         */
        locales?: Record<string, { title: string; message: string }>;
      }
    >
  >;
}

/**
 * The page globals the panel publishes for a host's own boot code.
 *
 * The trio is the family's long-standing contract, and all three are defaults
 * of the `res/fatal-fallback.js` this plugin replaces — which is what makes
 * retiring that script possible: a host keeps calling the same names. Each
 * slot accepts a name, `{ global }` to rename, or `false` to turn that entry
 * OFF; leaving a slot out keeps the family default.
 *
 * The defaults are published only alongside the feature that needs them:
 * `block` with `copy.browserBlock`, `fatal` / `ready` with `copy.reasons`.
 */
export interface BootRecoveryGlobalsOptions {
  /** Unsupported-browser entry (default `"__appBlock"`). */
  block?: string | { global?: string | false } | false;
  /** Pre-mount error report entry (default `"__appFatal"`). */
  fatal?: string | { global?: string | false } | false;
  /** Mount-succeeded handoff entry (default `"__appReady"`). */
  ready?: string | { global?: string | false } | false;
}

/** Options for {@link bootRecoveryPlugin} / {@link bootRecoveryScript}. */
export interface BootRecoveryPluginOptions {
  /**
   * Which HTML entries get the inline script. Default: only entries whose
   * basename is `index.html`. Multi-window shells MUST configure this — a
   * transparent overlay window must never be reloaded or healed by boot
   * recovery.
   *
   * A `RegExp` is matched against the entry's file path; a `string[]` is
   * matched against the basename or the path suffix (`"pages/index.html"`).
   */
  htmlFiles?: string[] | RegExp;
  /**
   * The watchdog half: an object customises the loading element; `false`
   * disables it entirely (heal-only mode, for hosts with their own fatal
   * landing page). Default: `{ selector: "#loading-screen", dismissedClass: "hidden" }`.
   */
  loadingScreen?: BootRecoveryLoadingScreenOptions | false;
  /** Watchdog delay in ms (default 15000). */
  deadlineMs?: number;
  /** Absolute http(s) app origin (default `http://tauri.localhost`). */
  canonicalOrigin?: string;
  /**
   * Name of the `window` global carrying the shell's OS locale preference
   * (`{ locale: string }`). Default `"__CELESTIA_OS_PREFS__"` — the
   * boot-chrome family global; an explicit empty string `""` disables the
   * OS-preference source. Only embedded when `copy.locales` is configured.
   */
  osPrefsGlobal?: string;
  /**
   * Custom mangled-origin predicate. It runs in the PAGE, so it is embedded
   * by source text: pass a self-contained ES2017-safe function expression or
   * arrow function (no closures, no method shorthand, ASCII-only). Default:
   * `isMangledOrigin` (http/https only, hostname starts with the canonical
   * host and differs from it; `tauri://` untouched).
   */
  isMangledOrigin?: (protocol: string, hostname: string) => boolean;
  /** Failure-panel copy overrides. */
  /** Failure-panel copy overrides and the opt-in diagnostics halves
   *  (`copy.rawDetailsLabel`, `copy.browserBlock`, `copy.reasons`). */
  copy?: BootRecoveryCopyOptions;
  /**
   * Rename or disable the page globals the panel publishes for the host's own
   * boot code (see {@link BootRecoveryGlobalsOptions}). Entries are only
   * published when the matching `copy` feature is configured.
   */
  globals?: BootRecoveryGlobalsOptions;
  /**
   * Where the tag is injected. Default `"head"` (end of `<head>`, after
   * `<meta charset>` — charset-prescan safe). `"head-prepend"` runs even
   * earlier but is charset-unsafe (the encoding prescan only reads the first
   * 1024 bytes); use it only when the host sends an explicit charset header.
   */
  injectTo?: "head" | "head-prepend";
}

/**
 * The default mangled-origin predicate: http(s) only, a hostname that starts
 * with the canonical origin's hostname but is not equal to it (`tauri://`
 * origins are never redirected).
 */
export declare function isMangledOrigin(
  protocol: string,
  hostname: string,
  canonicalOrigin?: string,
): boolean;

/**
 * The generated inline IIFE — deterministic, ASCII-only, classic (non-module)
 * and safe to hash into a host CSP.
 */
export declare function bootRecoveryScript(
  options?: BootRecoveryPluginOptions,
): string;

/** Vite plugin: inject the boot recovery script into the configured entries. */
export declare function bootRecoveryPlugin(
  options?: BootRecoveryPluginOptions,
): Plugin;
