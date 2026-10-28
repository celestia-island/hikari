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
