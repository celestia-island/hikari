// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-Flash) and the ZCode agent (model GLM-5.3), directed and reviewed
// by langyo — SySL-1.0 §2.3 disclosure.

import type { Plugin } from "vite";

/**
 * Types for `boot-recovery.mjs` — the self-contained, published Vite plugin
 * entry (`@celestia-island/hikari/plugins/boot-recovery`).
 *
 * The implementation is plain ESM loaded from `node_modules` while a consumer's
 * `vite.config.*` is resolved, where TypeScript cannot be stripped and Vite's
 * `configLoader: "runner"` tears the module runner down before plugin hooks
 * run. Keep the runtime file limited to static imports (`node:path` only).
 */

/** The canonical Tauri app origin on Windows/Android. */
export declare const BOOT_RECOVERY_CANONICAL_ORIGIN: "http://tauri.localhost";

/** Default watchdog delay in ms. */
export declare const BOOT_RECOVERY_DEADLINE_MS: 15000;

/** Default selector of the host's static loading element. */
export declare const BOOT_RECOVERY_LOADING_SELECTOR: "#loading-screen";

/** Default class that marks a loading element as already dismissed. */
export declare const BOOT_RECOVERY_DISMISSED_CLASS: "hidden";

/** Default failure-panel message (English; override through `copy.message`). */
export declare const BOOT_RECOVERY_MESSAGE: string;

/** Default failure-panel retry label (English; override through `copy.retry`). */
export declare const BOOT_RECOVERY_RETRY: string;

/** Marker attribute on the injected inline `<script>` tag. */
export declare const BOOT_RECOVERY_ATTR: "data-hk-boot-recovery";

/** The default options, frozen (see {@link BootRecoveryPluginOptions}). */
export interface BootRecoveryDefaults {
  readonly canonicalOrigin: string;
  readonly deadlineMs: number;
  readonly loadingScreen: Readonly<{
    selector: string;
    dismissedClass: string;
  }>;
  readonly copy: Readonly<{ message: string; retry: string }>;
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
  /** Main message of the panel. */
  message?: string;
  /** Retry button label. */
  retry?: string;
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
   * Custom mangled-origin predicate. It runs in the PAGE, so it is embedded
   * by source text: pass a self-contained ES2017-safe function expression or
   * arrow function (no closures, no method shorthand, ASCII-only). Default:
   * `isMangledOrigin` (http/https only, hostname starts with the canonical
   * host and differs from it; `tauri://` untouched).
   */
  isMangledOrigin?: (protocol: string, hostname: string) => boolean;
  /** Failure-panel copy overrides. */
  copy?: BootRecoveryCopyOptions;
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
