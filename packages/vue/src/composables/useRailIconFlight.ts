import { onScopeDispose, watch } from "vue";

import { drawnScale } from "./layoutGeometry";
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
 * 2. Each MATCHED icon is cloned into a flight layer on the ENTERING
 *    item and animated (WAAPI) from the leaving icon's rect to the
 *    entering one. The delta is signed, so expand/collapse is one code
 *    path; the layer rides the ENTERING item because that box — like
 *    every generation — is pinned at the docked inline-start edge and
 *    never moves while the panel's width animates, in LTR or RTL alike
 *    (the swap HOST tracks the animating clip width and would drag a
 *    host-anchored clone along with it — the 2026-11-02 review's RTL
 *    finding). Clone insets are therefore written as LOGICAL offsets
 *    from that stable inline-start edge, and divided by the ancestor
 *    draw scale (`drawnScale` — a root-level `html { zoom }` multiplies
 *    every measured viewport px by k; values written back in local px
 *    would render k times too far).
 * 3. While the flight runs, the leaving generation's MATCHED icons hide
 *    (CSS keyed on the host's `data-flipping` + the leave item's
 *    dissolve class + the per-cell `data-flip-flying` mark this
 *    composable stamps on exactly the cells it cloned): the clone
 *    substitutes them at the same geometry, full opacity — nothing
 *    blinks. UNMATCHED keyed cells (a rail fallback letter with no
 *    expanded counterpart, say) are never marked, never hidden — they
 *    plain dissolve, exactly as the pairing contract promises. The
 *    ENTERING icons keep the normal dissolve, so by the time the clone
 *    lands and fades (last ~20% of the window) the real icon underneath
 *    is nearly fully dissolved in and occupies the identical rect — the
 *    handoff tax is a sub-frame dip well under the double-exposure
 *    artifact this replaces.
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
 *
 * KNOWN LIMIT (documented, accepted): the window constants assume the
 * dissolve runs at its default timing. A host that sets HkCrossfade's
 * `--hk-crossfade-enter-delay` holds the entering fade back; the flight
 * reads the property off the swap host and widens its window and sweep
 * by the same amount, so the handoff lands after the icon has actually
 * faded in. No shipped rail host sets it today.
 */

/** Row-key attribute on an icon cell that flies across a rail flip. */
export const RAIL_FLIP_ICON_ATTR = "data-flip-icon";
/** Host attribute marking a flight in progress (drives the hide rule). */
export const RAIL_FLIP_ACTIVE_ATTR = "data-flipping";
/** Per-cell mark stamped on exactly the LEAVING icons that were paired
 *  and cloned — the hide rule keys on THIS, never on the opt-in
 *  attribute: an opted-in cell without a partner (a rail fallback with
 *  no expanded counterpart) must dissolve, not vanish. */
export const RAIL_FLIP_FLYING_ATTR = "data-flip-flying";
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

/** Parse HkCrossfade's enter-hold custom property (`"120ms"`, `"0.15s"`,
 *  `""`) into milliseconds. Anything unparsable is no hold at all. */
export function enterDelayMs(value: string): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return value.trim().endsWith("s") && !value.trim().endsWith("ms") ? n * 1000 : n;
}

/** One matched icon pair across the swap: live leaving geometry, entering
 *  geometry, the leaving icon's computed color (svg stroke = currentColor),
 *  and the entering cell to clone (its dress is the destination's). */
interface FlightPair {
  fromEl: HTMLElement;
  from: DOMRect;
  to: DOMRect;
  color: string;
  template: HTMLElement;
}

/** What one flight needs from the swap: the paired icons and the stable
 *  box the flight layer mounts on (the ENTERING item — pinned at the
 *  docked inline-start edge, never moved by the panel's width animation). */
interface FlightStage {
  pairs: FlightPair[];
  stageEl: HTMLElement;
}

export function useRailIconFlight(
  /** The swap host element (getter — mounts conditionally). `data-flipping`
   *  rides it; the hide rule hangs off it. */
  swapEl: () => HTMLElement | null | undefined,
  /** The density flag whose flips arm the flight (HkSidebarRailSwap's
   *  `rail` prop). */
  rail: () => boolean,
  /** HkCrossfade's key for the ENTERING generation ("rail"/"full" — the
   *  same expression that drives the swap's `swapKey`). */
  enteringKey: () => string,
): void {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  /** Monotonic flight id + the id of the flight currently on stage. A
   *  settle callback (WAAPI finish/cancel, fallback timer) that belongs
   *  to a REPLACED flight must not sweep its successor's layer: the old
   *  animation keeps ticking for up to its full window after a fresh
   *  flip swept the stage (the stale-finish race the 2026-11-02 review's
   *  scratch probe caught). */
  let flightSeq = 0;
  let currentFlightId = -1;
  let layer: HTMLElement | null = null;
  /** The leaving cells this flight hid — unmarked on every sweep so a
   *  cancelled/dissolve-less path never leaves a stale hide mark. */
  let hidden: HTMLElement[] = [];
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let sweepTimer: ReturnType<typeof setTimeout> | null = null;

  /** Idempotent teardown: layer, marks, timers, the host attribute. */
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
    for (const el of hidden) el.removeAttribute(RAIL_FLIP_FLYING_ATTR);
    hidden = [];
    swapEl()?.removeAttribute(RAIL_FLIP_ACTIVE_ATTR);
  };
  onScopeDispose(sweep);

  /** A settle callback from flight `id`: sweep only when that flight is
   *  still the one on stage. */
  const sweepIfCurrent = (id: number): void => {
    if (id === currentFlightId) sweep();
  };

  /** Flight conditions — every skip is a documented veto. */
  const flightCapable = (): boolean => {
    if (typeof document === "undefined" || typeof HTMLElement === "undefined") return false;
    if (reducedMotion.value) return false;
    // The global animation switch pins the dissolve to zero too; a flight
    // over an instant swap would outlive the very transition it mirrors.
    if (document.documentElement.getAttribute("data-css-animations") === "0") return false;
    return typeof HTMLElement.prototype.animate === "function";
  };

  /** Pair the opted-in icons across the two generations mid-swap, and
   *  resolve the stage (the entering item) the layer mounts on. */
  const collectStage = (host: HTMLElement): FlightStage | null => {
    const key = enteringKey();
    let leaving: HTMLElement | null = null;
    let entering: HTMLElement | null = null;
    for (const item of host.querySelectorAll<HTMLElement>(":scope > .hk-crossfade-item")) {
      if (item.getAttribute(RAIL_FLIP_ITEM_ATTR) === key) entering = item;
      else leaving = item;
    }
    // No leaving generation (first paint, watchdog-degraded synchronous
    // swap, dissolve already settled): nothing to fly over.
    if (!leaving || !entering) return null;
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
        fromEl,
        from: fromRect,
        to: toRect,
        color: getComputedStyle(fromEl).color,
        template: toEl,
      });
    }
    return { pairs, stageEl: entering };
  };

  const runFlight = (): void => {
    armTimer = null;
    sweep();
    const flightId = ++flightSeq;
    currentFlightId = flightId;
    const host = swapEl();
    if (!host || !flightCapable()) return;
    const stage = collectStage(host);
    if (!stage || !stage.pairs.length) return;
    const { pairs, stageEl } = stage;
    // Identical positions (a host whose densities don't move the icon
    // column): the dissolve alone is already continuous — no layer.
    if (!pairs.some(({ from, to }) => from.left !== to.left || from.top !== to.top)) return;

    // Timing: the flight mirrors the dissolve's window, widened by any
    // enter hold the host choreographed (see KNOWN LIMIT above).
    const delay = enterDelayMs(
      getComputedStyle(host).getPropertyValue("--hk-crossfade-enter-delay"),
    );
    const flightMs = RAIL_FLIGHT_MS + delay;

    host.setAttribute(RAIL_FLIP_ACTIVE_ATTR, "");
    // Stamp exactly the cells being substituted BEFORE any paint with the
    // layer up: the hide rule reads this mark, so an opted-in cell
    // without a clone partner keeps dissolving (2026-11-02 review S1-1).
    for (const pair of pairs) {
      pair.fromEl.setAttribute(RAIL_FLIP_FLYING_ATTR, "");
      hidden.push(pair.fromEl);
    }
    layer = document.createElement("div");
    layer.className = "hk-sidebar-rail-flight";
    layer.setAttribute("aria-hidden", "true");
    // The stage (entering item) is pinned at the docked inline-start edge
    // and does not move while the panel animates — a stable origin in
    // both directions. Its draw scale converts measured viewport px into
    // the local px the layer's own insets are painted at (root zoom).
    const origin = stageEl.getBoundingClientRect();
    const scale = drawnScale(stageEl);
    const rtl = getComputedStyle(stageEl).direction === "rtl";
    for (const pair of pairs) {
      // Logical inline offset from the stage's stable inline-start edge;
      // physical top (the block axis is direction-free).
      const inlineOffset = rtl ? pair.from.right - origin.right : pair.from.left - origin.left;
      const dx = (pair.to.left - pair.from.left) / scale.x;
      const dy = (pair.to.top - pair.from.top) / scale.y;
      const clone = pair.template.cloneNode(true) as HTMLElement;
      // Neutralize identity: the clone must never match a future pairing
      // query nor the hide rule — it is the flight layer's own citizen.
      clone.removeAttribute(RAIL_FLIP_ICON_ATTR);
      clone.removeAttribute(RAIL_FLIP_FLYING_ATTR);
      clone.className = "hk-sidebar-rail-flight-clone";
      clone.style.insetInlineStart = `${inlineOffset / scale.x}px`;
      clone.style.insetBlockStart = `${(pair.from.top - origin.top) / scale.y}px`;
      clone.style.width = `${pair.from.width / scale.x}px`;
      clone.style.height = `${pair.from.height / scale.y}px`;
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
        { duration: flightMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      // Same duration on every clone: the first settle sweeps the
      // layer — but only while THIS flight is on stage (a replaced
      // flight's late finish is a no-op, never its successor's sweeper).
      anim.addEventListener("finish", () => sweepIfCurrent(flightId));
      anim.addEventListener("cancel", () => sweepIfCurrent(flightId));
      layer.appendChild(clone);
    }
    stageEl.appendChild(layer);
    sweepTimer = setTimeout(() => sweepIfCurrent(flightId), RAIL_FLIGHT_SWEEP_MS + delay);
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
      if (armTimer !== null) clearTimeout(armTimer);
      armTimer = setTimeout(runFlight, 0);
    },
    { flush: "post" },
  );
}
