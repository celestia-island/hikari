import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type { Plugin } from "vite";

/** PlanA UI boot scripts copied verbatim from plana res into the build outDir. */
export const BOOT_SCRIPTS = [
  "browser-check.js",
  "loader-dismiss.js",
  "theme-loader.js",
  "os-prefs.js",
  "tauri-titlebar.js",
];

const RES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../res",
);

/**
 * Vite plugin: after build, copy the shared boot scripts (theme-loader,
 * browser-check, ...) from hikari res/ into the output dir so index.html can
 * reference them as first-class static assets. Keep in sync with the hikari
 * res/ directory — every file there is a copy target.
 *
 * The boot-FAILURE panel is not on this list: it is hikari's
 * `plugins/boot-recovery` plugin now, which paints hikari's shared error
 * landing directly (the hand-rolled `res/fatal-fallback.js` it replaces was
 * retired from this directory).
 *
 * Returning `Plugin` types `configResolved` as Vite's real `ResolvedConfig`,
 * which also makes the `apply: "build"` literal an ordinary assignable value
 * instead of needing `as const` to escape the object-literal widening.
 */
export function bootScriptsPlugin(): Plugin {
  let outDir = "";
  return {
    name: "boot-scripts",
    apply: "build",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      if (!outDir) return;
      for (const name of BOOT_SCRIPTS) {
        const src = resolve(RES_DIR, name);
        if (!existsSync(src)) continue;
        try {
          copyFileSync(src, resolve(outDir, name));
        } catch {
          // best-effort; a missing script only affects the pre-paint bootstrap
        }
      }
    },
  };
}
