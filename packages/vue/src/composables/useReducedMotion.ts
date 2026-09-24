import { watch } from "vue";
import { setReducedMotion } from "../runtime/animationBus";

let initialized = false;

/**
 * Wire the system/user reduced-motion preference into the animation bus
 * (upstreamed from shittim-chest, preference store decoupled).
 *
 * `getUserPref` (optional) returns the user override; when undefined the
 * system `prefers-reduced-motion` media query decides. The `reduce-motion`
 * class is toggled on <html> so CSS can follow.
 *
 * This is an APP-BOOT call and deliberately not per-instance: the latch
 * below makes the first caller the only one that ever runs, and there is no
 * readable state to hand back. A COMPONENT that must gate its own animation
 * on the preference (HkWallpaperBackdrop is the reference) subscribes to the
 * query itself via `useMediaQuery("(prefers-reduced-motion: reduce)")` —
 * reactive, shared per query string, released on unmount.
 */
export function useReducedMotion(getUserPref?: () => boolean | undefined) {
  if (initialized) return;
  initialized = true;

  const mq = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  function sync() {
    const system = mq?.matches ?? false;
    const user = getUserPref?.();
    const active = user !== undefined ? user : system;
    document.documentElement.classList.toggle("reduce-motion", !!active);
    setReducedMotion(!!active);
  }

  mq?.addEventListener("change", sync);
  sync();

  return { sync };
}
