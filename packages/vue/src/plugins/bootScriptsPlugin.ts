import { copyFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

/** PlanA UI boot scripts copied verbatim from plana res into the build outDir. */
export const BOOT_SCRIPTS = [
  "browser-check.js",
  "loader-dismiss.js",
  "theme-loader.js",
  "fatal-fallback.js",
  "os-prefs.js",
  "tauri-titlebar.js",
];

const RES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../res",
);

/**
 * Vite plugin: after build, copy the shared boot scripts (theme-loader,
 * fatal-fallback, browser-check, ...) from hikari res/ into the output dir so
 * index.html can reference them as first-class static assets. Keep in sync
 * with the hikari res/ directory — every file there is a copy target.
 */
export function bootScriptsPlugin() {
  let outDir = "";
  return {
    name: "boot-scripts",
    apply: "build" as const,
    configResolved(cfg: any) {
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
