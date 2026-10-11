/**
 * @celestia-island/default-theme — the reference PRECOMPILED theme.
 *
 * What a "theme package" is: a folder that ships its own compiled CSS
 * + JS, registers its decor into hikari's theme registry, and is
 * mounted by the host (or auto-mounted by the theme config) with ONE
 * import. This package is the WORKING EXAMPLE the custom-theme docs
 * can point at — it is also hikari's own former brand tray, so the
 * default look ships as "just another theme".
 *
 * Mounting:
 *   import "@celestia-island/default-theme";            // side-effect: CSS + decor
 *   // or explicitly:
 *   import { mountDefaultTheme } from "@celestia-island/default-theme";
 *   mountDefaultTheme();
 */
import { registerThemeDecor } from "@celestia-island/hikari";
import StatusTrayDecor from "./StatusTrayDecor";

export { default as StatusTrayDecor } from "./StatusTrayDecor";

/** Register the default theme's decor (idempotent). */
export function mountDefaultTheme(): void {
  registerThemeDecor({ themeId: "*", slot: "status.tray", component: StatusTrayDecor });
}

// The side-effect mount: importing the package is enough.
mountDefaultTheme();
