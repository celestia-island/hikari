/**
 * Poisoned-location router guard (family runtime).
 *
 * Companion to {@link installHistorySafetyNet}: that net folds what
 * REACHES the history layer; this guard folds what reaches the ROUTER
 * first, so a poisoned target dies as an in-app redirect (landing
 * route) instead of ever composing a URL at all. Both layers share the
 * same literal set — defense in depth, with the guard giving the nicer
 * UX (no address-bar flicker) and the net giving the structural
 * guarantee (covers producers that bypass the router entirely).
 *
 * Upstreamed from shittim-chest #622/#754.
 */

import { installHistorySafetyNet, type HistorySafetyNetOptions } from "./historySafetyNet";

/** Bare literals that read as a producer bug, never a real target. */
const POISONED_LITERALS = new Set(["undefined", "null", "nan"]);

/** Structural slice of vue-router's Router — the guard only hooks
 *  beforeEach, so any router-shaped object works (no vue-router dep:
 *  hikari stays UI-library-scoped). */
export interface GuardRouter {
  beforeEach: (fn: (to: GuardRoute, ...rest: unknown[]) => unknown) => void;
}

export interface GuardRoute {
  path?: string | null;
  fullPath?: string;
  [k: string]: unknown;
}

export interface NavigationSafetyNetOptions extends HistorySafetyNetOptions {
  /** Route shape the guard registers against. The History patch
   *  installs even without a router (direct pushState producers). */
  router?: GuardRouter;
}

/** Register the beforeEach poisoned-target fold on a router. */
export function createPoisonedLocationGuard(
  router: GuardRouter,
  fallback = "/",
): void {
  router.beforeEach((to: GuardRoute) => {
    const path = to.path ?? "";
    if (!path.startsWith("/") || POISONED_LITERALS.has(path)) {
      console.warn(
        `[Router] Blocked poisoned navigation target "${path}" (fullPath "${to.fullPath}") — redirecting to "${fallback}"`,
      );
      return fallback;
    }
    return true;
  });
}

/** One-call navigation safety: the History-prototype net plus the
 *  router-level poisoned-target guard. Install before the first
 *  navigation (module scope of the app's router setup is ideal). */
export function installNavigationSafetyNet(options: NavigationSafetyNetOptions = {}): void {
  installHistorySafetyNet(options);
  if (options.router) createPoisonedLocationGuard(options.router, options.fallback ?? "/");
}
