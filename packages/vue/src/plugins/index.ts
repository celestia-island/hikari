export { bootScriptsPlugin } from "./bootScriptsPlugin";
export { buildHashPlugin } from "./buildHashPlugin";
// Repo-internal re-export only. CONSUMERS must import the published subpath
// `@celestia-island/hikari/plugins/boot-chrome`, which resolves straight to the
// self-contained ESM module (this barrel is TypeScript, and a TypeScript entry
// under node_modules cannot be loaded from a vite config — see boot-chrome.mjs).
export type { BootChromePluginOptions } from "./boot-chrome.mjs";
export {
  bootChromePlugin,
  BOOT_CHROME_SCRIPT,
  BOOT_CHROME_URL,
} from "./boot-chrome.mjs";
// Same repo-internal-only rule as boot-chrome above: CONSUMERS must import the
// published subpath `@celestia-island/hikari/plugins/boot-recovery`, which
// resolves straight to the self-contained ESM module (this barrel is
// TypeScript, and a TypeScript entry under node_modules cannot be loaded from a
// vite config — see boot-recovery.mjs).
export type { BootRecoveryPluginOptions } from "./boot-recovery.mjs";
export {
  bootRecoveryPlugin,
  bootRecoveryScript,
  isMangledOrigin,
  BOOT_RECOVERY_ATTR,
  BOOT_RECOVERY_CANONICAL_ORIGIN,
  BOOT_RECOVERY_DEADLINE_MS,
  BOOT_RECOVERY_DEFAULTS,
  BOOT_RECOVERY_DISMISSED_CLASS,
  BOOT_RECOVERY_LOADING_SELECTOR,
  BOOT_RECOVERY_MESSAGE,
  BOOT_RECOVERY_RETRY,
} from "./boot-recovery.mjs";
