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
