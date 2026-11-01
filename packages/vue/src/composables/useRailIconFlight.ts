import { onScopeDispose, watch } from "vue";

import { useMediaQuery } from "../runtime/useMediaQuery";

/**
 * useRailIconFlight — the rail flip's icon continuity layer (2026-11-02).
 *
 * THE PERCEPTION GAP this closes (user screenshot + direction): the
 * rail/full handoff is a pure OPACITY dissolve (HkCrossfade), so a
 * collapsing sidebar reads as "the icons fade out; new icons fade in" —
 * the small horizontal journey every icon actually makes (expanded rows
 * put the icon column at the row's leading padding; the rail centers it
 * in the 56px column — a few px left) is invisible because nothing ever
 * MOVES. The dissolve primitive cannot carry the motion: its opacity
 * sits on the WHOLE generation wrapper, so no descendant can stay fully
 * opaque while its generation fades, and two half-faded copies of the
 * same glyph sliding apart is exactly the double-exposure artifact
 * dissolves exist to prevent.
 *
 * THE MECHANISM — a flight layer ABOVE both generations, the container-
 * transform grammar (chrome dissolves, content travels):
 *
 * 1. On a density flip the choreographer defers ONE macrotask
 *    (`setTimeout(0)`) and then pairs icons opted in via
 *    `data-flip-icon="<row key>"` BY KEY across the two generations,
 *    identified SEMANTICALLY by HkCrossfade's `data-crossfade-key`
 *    (the entering item's key equals the current one; the leaving item
 *    is the other). Neither Vue's transient transition classes nor a
 *    same-tick rAF is relied on: the macrotask lands after every
 *    microtask — including the entering body's scroll restoration —
 *    while a real browser's dissolve (a 300ms CSS transition) is still
 *    mid-flight. A watchdog-degraded synchronous swap has no leaving
 *    item at all, and the flight stays dormant.
 * 2. Each matched icon is cloned into an absolutely-positioned flight
 *    layer on the swap host, painted at the LEAVING icon's live rect
 *    with its computed color, then animated (WAAPI) to the ENTERING
 *    icon's rect — the delta is signed, so LTR/RTL and expand/collapse
 *    are the same code path.
 * 3. While the flight runs, the LEAVING generation's participating icons
 *    hide (CSS keyed on the host's `data-flipping` + the leave item's
 *    dissolve class): the clone substitutes them at the same geometry,
 *    full opacity — nothing blinks. The ENTERING icons keep the normal
 *    dissolve, so by the time the clone lands and fades (last ~20% of
 *    the window) the real icon underneath is nearly fully dissolved in
 *    and occupies the identical rect — the handoff tax is a sub-frame
 *    dip well under the double-exposure artifact this replaces.
 * 4. Non-participating icons (identity blocks, group carets, badge
 *    dots), the pills, and the labels crossfade exactly as before.
 *
 * GUARDS: skipped entirely under reduced motion, the global animation
 * switch (`html[data-css-animations="0"]`), a missing WAAPI, or when no
 * pair actually moves (identical positions — the dissolve alone is then
 * already seamless). Unmatched keys simply don't fly. A sweep timer
 * (watchdog parity with HkCrossfade's stall budget) removes the layer
 * even where `finish` never fires (rAF-starved tabs); a fresh flip
 * sweeps any previous flight first, so flip-flopping can't stack layers.
 */

/** Row-key attribute on an icon cell that flies across a rail flip. */
export const RAIL_FLIP_ICON_ATTR = "data-flip-icon";
/** Host attribute marking a flight in progress (drives the hide rule). */
export const RAIL_FLIP_ACTIVE_ATTR = "data-flipping";
/** HkCrossfade's per-item identity — the semantic pairing anchor. */
export const RAIL_FLIP_ITEM_ATTR = "data-crossfade-key";
/** Total flight window — parity with the dissolve's --duration-normal. */
export const RAIL_FLIGHT_MS = 300;
/** The clone holds full opacity until this fraction of the window, then
 *  fades over the rest — landing INTO the entering icon's own fade. */
const FLIGHT_HANDOFF_RATIO = 0.78;
/** Sweep fallback: above any healthy flight (HkCrossfade watchdog
 *  parity — 450ms budget + margin) so a stalled clone can never linger. */
export const RAIL_FLIGHT_SWEEP_MS = 600;

/** One matched icon pair across the swap: live leaving geometry, entering
 *  geometry, the leaving icon's computed color (svg stroke = currentColor),
 *  and the entering cell to clone (its dress is the destination's). */
interface FlightPair {
  from: DOMRect;
  to: DOMRect;
  color: string;
  template: HTMLElement;
}

export function useRailIconFlight(
  /** The swap host element (getter — mounts conditionally). The layer is
   *  appended here and `data-flipping` rides it. */
  swapEl: () => HTMLElement | null | undefined,
  /** The density flag whose flips arm the flight (HkSidebarRailSwap's
   *  `rail` prop). */
  rail: () => boolean,
  /** HkCrossfade's key for the ENTERING generation ("rail"/"full" — the
   *  same expression that drives the swap's `swapKey`). */
  enteringKey: () => string,
): void {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  let layer: HTMLElement | null = null;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let sweepTimer: ReturnType<typeof setTimeout> | null = null;

  /** Idempotent teardown: layer, timers, the host attribute. */
  const sweep = (): void => {
    if (armTimer !== null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
    if (sweepTimer !== null) {
      clearTimeout(sweepTimer);
      sweepTimer = null;
    }
    layer?.remove();
    layer = null;
    swapEl()?.removeAttribute(RAIL_FLIP_ACTIVE_ATTR);
  };
  onScopeDispose(sweep);

  /** Flight conditions — every skip is a documented veto. */
  const flightCapable = (): boolean => {
    if (typeof document === "undefined" || typeof HTMLElement === "undefined") return false;
    if (reducedMotion.value) return false;
    // The global animation switch pins the dissolve to zero too; a flight
    // over an instant swap would outlive the very transition it mirrors.
    if (document.documentElement.getAttribute("data-css-animations") === "0") return false;
    return typeof HTMLElement.prototype.animate === "function";
  };

  /** Pair the opted-in icons across the two generations mid-dissolve. */
  const collectPairs = (host: HTMLElement): FlightPair[] => {
    const key = enteringKey();
    let leaving: HTMLElement | null = null;
    let entering: HTMLElement | null = null;
    for (const item of host.querySelectorAll<HTMLElement>(":scope > .hk-crossfade-item")) {
      if (item.getAttribute(RAIL_FLIP_ITEM_ATTR) === key) entering = item;
      else leaving = item;
    }
    // No leaving generation (first paint, watchdog-degraded synchronous
    // swap, dissolve already settled): nothing to fly over.
    if (!leaving || !entering) return [];
    const byKey = (root: HTMLElement): Map<string, HTMLElement> => {
      const map = new Map<string, HTMLElement>();
      for (const icon of root.querySelectorAll<HTMLElement>(`[${RAIL_FLIP_ICON_ATTR}]`)) {
        const iconKey = icon.getAttribute(RAIL_FLIP_ICON_ATTR);
        if (iconKey !== null && !map.has(iconKey)) map.set(iconKey, icon);
      }
      return map;
    };
    const from = byKey(leaving);
    const to = byKey(entering);
    const pairs: FlightPair[] = [];
    for (const [iconKey, fromEl] of from) {
      const toEl = to.get(iconKey);
      if (!toEl) continue; // destination without a source (or vice versa) just dissolves
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      // Unrendered cells (display:none subtree, detached test nodes): no
      // geometry to fly.
      if (!fromRect.width || !fromRect.height || !toRect.width || !toRect.height) continue;
      pairs.push({
        from: fromRect,
        to: toRect,
        color: getComputedStyle(fromEl).color,
        template: toEl,
      });
    }
    return pairs;
  };

  const runFlight = (): void => {
    armTimer = null;
    sweep();
    const host = swapEl();
    if (!host || !flightCapable()) return;
    const pairs = collectPairs(host);
    if (!pairs.length) return;
    // Identical positions (a host whose densities don't move the icon
    // column): the dissolve alone is already continuous — no layer.
    if (!pairs.some(({ from, to }) => from.left !== to.left || from.top !== to.top)) return;

    host.setAttribute(RAIL_FLIP_ACTIVE_ATTR, "");
    layer = document.createElement("div");
    layer.className = "hk-sidebar-rail-flight";
    layer.setAttribute("aria-hidden", "true");
    const origin = host.getBoundingClientRect();
    for (const pair of pairs) {
      const dx = pair.to.left - pair.from.left;
      const dy = pair.to.top - pair.from.top;
      const clone = pair.template.cloneNode(true) as HTMLElement;
      // Neutralize identity: the clone must never match a future pairing
      // query nor the hide rule — it is the flight layer's own citizen.
      clone.removeAttribute(RAIL_FLIP_ICON_ATTR);
      clone.className = "hk-sidebar-rail-flight-clone";
      clone.style.left = `${pair.from.left - origin.left}px`;
      clone.style.top = `${pair.from.top - origin.top}px`;
      clone.style.width = `${pair.from.width}px`;
      clone.style.height = `${pair.from.height}px`;
      clone.style.color = pair.color;
      const anim = clone.animate(
        [
          { transform: "translate(0, 0)", opacity: "1" },
          {
            transform: `translate(${dx}px, ${dy}px)`,
            opacity: "1",
            offset: FLIGHT_HANDOFF_RATIO,
          },
          { transform: `translate(${dx}px, ${dy}px)`, opacity: "0" },
        ],
        { duration: RAIL_FLIGHT_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      // Same duration on every clone: the first settle sweeps the layer.
      anim.addEventListener("finish", sweep);
      anim.addEventListener("cancel", sweep);
      layer.appendChild(clone);
    }
    host.appendChild(layer);
    sweepTimer = setTimeout(sweep, RAIL_FLIGHT_SWEEP_MS);
  };

  watch(
    rail,
    () => {
      // One macrotask before measuring — deliberately NOT a rAF chain:
      // Vue's transition engine is rAF-gated, so a rAF here would race
      // the dissolve's own frames (and in a stylesheet-less environment
      // the leave completes on the FIRST frame, before a second rAF ever
      // runs). A macrotask lands after all microtasks — the entering
      // body's scroll restoration included — while the browser's CSS
      // dissolve is still playing. Two undiscolved frames before the
      // clones substitute the leaving icons at their live rects; no
      // blink (the substitution is same-geometry, full-opacity).
      armTimer = setTimeout(runFlight, 0);
    },
    { flush: "post" },
  );
}
