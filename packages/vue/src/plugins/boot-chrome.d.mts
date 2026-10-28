import type { Plugin } from "vite";

/**
 * Types for `boot-chrome.mjs` — the self-contained, published Vite plugin entry
 * (`@celestia-island/hikari/plugins/boot-chrome`).
 *
 * The implementation is plain ESM with static Node imports on purpose: a
 * consumer loads it from `node_modules` while resolving `vite.config.*`, where
 * TypeScript cannot be stripped and Vite's `configLoader: "runner"` tears the
 * module runner down before plugin hooks run. Keep the runtime file dependency
 * free apart from `node:fs` / `node:path` / `node:url`.
 */

/** File name the bar is emitted and served under (output-dir root). */
export declare const BOOT_CHROME_SCRIPT: "hk-boot-chrome.js";

/** Root-absolute default URL the injected `<script src>` points at. */
export declare const BOOT_CHROME_URL: string;

export interface BootChromePluginOptions {
  /** Application name on the left of the bar (default: `document.title`). */
  title?: string;
  /** Bar height in px; `boot-chrome.js` clamps it to 20..64 (default 32). */
  height?: number;
  /** Watchdog delay in ms before the reload affordance appears (default 20000). */
  hangMs?: number;
  /**
   * Which HTML entries get the bar. Default: only entries whose basename is
   * `index.html`. Multi-window shells MUST configure this — a transparent
   * overlay window must never paint the caption bar.
   *
   * A `RegExp` is matched against the entry's file path; a `string[]` is
   * matched against the basename or the path suffix (`"pages/index.html"`).
   */
  htmlFiles?: string[] | RegExp;
}

/** Vite plugin: inject `boot-chrome.js` into the app window's HTML entry. */
export declare function bootChromePlugin(
  options?: BootChromePluginOptions,
): Plugin;
