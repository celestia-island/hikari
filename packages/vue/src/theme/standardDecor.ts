import HkDivider from "../components/HkDivider";
import HkEmptyState from "../components/HkEmptyState";
import HkSkeleton from "../components/HkSkeleton";
import HkSplash from "../components/HkSplash";
import HkStatusTray from "../components/HkStatusTray";
import { registerThemeDecorBuiltin, type ThemeDecorSlot } from "./themeDecor";

/**
 * Standard theme decor — the decor slots hikari fills ITSELF, as opposed to
 * the per-theme implementations a downstream app registers (chest's tray is
 * the reference implementation this replaces). Same shape as
 * `standardGroups.ts`: registration is NOT a side effect of importing this
 * module — `initTheme()` calls `registerStandardThemeDecor()` right after
 * `registerStandardThemeGroups()` and before its first `applyTheme()`, so a
 * consumer that never calls `initTheme()` (tests, SSR, a host with its own
 * theme engine) gets an untouched registry.
 *
 * These land on the BUILT-IN floor of the decor registry, below both an
 * exact theme id and the `"*"` wildcard: a theme (or a host) that registers
 * its own implementation for a slot replaces hikari's default without
 * having to unregister anything.
 *
 * Deliberate gap — `backdrop` is NOT registered here. A screen backdrop
 * resolves into the wallpaper/shader stack (geometry, blend mode, live
 * surface sampling), which ships as `HkWallpaperBackdrop`; registering it on
 * this floor would make it "a component the host cannot configure away",
 * because `registerThemeDecor` has no unregister and the floor sits below
 * both an exact theme id and the `"*"` wildcard. The HOST therefore owns the
 * registration:
 *
 *   registerThemeDecor({ themeId: "*", slot: "backdrop", component: HkWallpaperBackdrop })
 *
 * Until a host does that, `getThemeDecor("backdrop", …)` is `undefined` and
 * `<HkThemeDecor slot="backdrop" />` renders nothing, which is the correct
 * "no backdrop configured" state — pinned by standardDecor.test.ts so the
 * gap is a decision on record, not an oversight.
 */
export const STANDARD_THEME_DECOR_SLOTS: readonly ThemeDecorSlot[] = [
  "status.tray",
  "placeholder.screen",
  "placeholder.section",
  "empty",
  "divider",
];

// Idempotence latch. Registration is keyed by (themeId, slot) — and the
// built-in floor by slot — so calling this twice would otherwise clobber a
// consumer's own replacement of a slot on every initTheme().
let registered = false;

/**
 * Register hikari's standard decor. Idempotent: the first call wins, later
 * calls are no-ops, so a host may call it explicitly without having to know
 * whether `initTheme()` already did.
 */
export function registerStandardThemeDecor(): void {
  if (registered) return;
  registered = true;
  registerThemeDecorBuiltin({ slot: "status.tray", component: HkStatusTray });
  registerThemeDecorBuiltin({ slot: "placeholder.screen", component: HkSplash });
  registerThemeDecorBuiltin({ slot: "placeholder.section", component: HkSkeleton });
  registerThemeDecorBuiltin({ slot: "empty", component: HkEmptyState });
  registerThemeDecorBuiltin({ slot: "divider", component: HkDivider });
}
