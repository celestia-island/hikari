/**
 * Safe-area context — reactive viewport insets for notched phones.
 *
 * CSS `env(safe-area-inset-*)` is not observable from JS, so apps that
 * need to position fixed toolbars / input bars above the home indicator
 * (or below a notch) had no shared way to react to changes (rotation,
 * keyboard). This composable mounts hidden sentinel elements whose
 * dimensions ARE the `env(safe-area-inset-*)` values, reads them on
 * viewport resize, and exposes the four numbers as a reactive ref plus
 * mirrored `--hk-safe-area-{top,right,bottom,left}` CSS variables on
 * `:root` for declarative consumers.
 *
 * `useSafeArea()` is a shared singleton: the first caller mounts the
 * sentinels; the last release removes them. Component callers
 * auto-release on unmount.
 */
import { getCurrentInstance, onUnmounted, readonly, ref, type Ref } from "vue";

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const insets = ref<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
let consumers = 0;
let mounted = false;
let observer: ResizeObserver | null = null;
let vvListener: (() => void) | null = null;
let resizeListener: (() => void) | null = null;

const SIDES = ["top", "right", "bottom", "left"] as const;
type Side = (typeof SIDES)[number];

function sideId(side: Side): string {
  return `hk-safe-area-sentinel-${side}`;
}

function ensureSentinels(): void {
  if (mounted || typeof document === "undefined") return;
  mounted = true;

  const read = () => {
    const next: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const side of SIDES) {
      const el = document.getElementById(sideId(side));
      if (!el) continue;
      const cs = getComputedStyle(el);
      const dim = side === "top" || side === "bottom" ? cs.height : cs.width;
      const n = Number.parseFloat(dim);
      next[side] = Number.isFinite(n) ? n : 0;
      document.documentElement.style.setProperty(
        `--hk-safe-area-${side}`,
        `${next[side]}px`,
      );
    }
    insets.value = next;
  };

  for (const side of SIDES) {
    const el = document.createElement("div");
    el.id = sideId(side);
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "position: fixed",
      side === "bottom" ? "bottom: 0" : "top: 0",
      side === "right" ? "right: 0" : "left: 0",
      "visibility: hidden",
      "pointer-events: none",
      "z-index: -2147483648",
      side === "top" || side === "bottom"
        ? `height: env(safe-area-inset-${side}, 0px); width: 0`
        : `width: env(safe-area-inset-${side}, 0px); height: 0`,
    ].join(";");
    document.documentElement.appendChild(el);
  }

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(read);
    for (const side of SIDES) {
      const el = document.getElementById(sideId(side));
      if (el) observer.observe(el);
    }
  }
  if (typeof visualViewport !== "undefined" && visualViewport !== null) {
    vvListener = read;
    visualViewport.addEventListener("resize", vvListener);
  }
  resizeListener = read;
  window.addEventListener("resize", resizeListener, { passive: true });
  read();
}

function teardownSentinels(): void {
  observer?.disconnect();
  observer = null;
  if (vvListener && typeof visualViewport !== "undefined" && visualViewport !== null) {
    visualViewport.removeEventListener("resize", vvListener);
  }
  vvListener = null;
  if (resizeListener) {
    window.removeEventListener("resize", resizeListener);
  }
  resizeListener = null;
  for (const side of SIDES) {
    document.getElementById(sideId(side))?.remove();
    // Reset the mirrored variables so stale insets don't linger after the
    // last consumer releases (fresh values re-appear on next mount).
    document.documentElement.style.removeProperty(`--hk-safe-area-${side}`);
  }
  mounted = false;
}

/**
 * Reactive safe-area insets (px) + mirrored CSS variables
 * (`--hk-safe-area-{top,right,bottom,left}`). Singleton; safe to call from
 * many components — the sentinels live while at least one consumer exists
 * (component callers auto-release on unmount).
 */
export function useSafeArea(): {
  insets: Readonly<Ref<SafeAreaInsets>>;
  release: () => void;
} {
  ensureSentinels();
  consumers += 1;
  const release = () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers === 0) teardownSentinels();
  };
  if (getCurrentInstance() !== null) {
    onUnmounted(release);
  }
  return { insets: readonly(insets), release };
}

export type { SafeAreaInsets };
