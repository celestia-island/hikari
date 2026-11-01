import { onScopeDispose, watch } from "vue";

import { drawnScale } from "./layoutGeometry";
import { releaseMediaQuery, useMediaQuery } from "../runtime/useMediaQuery";

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
 * 2. Each MATCHED icon is cloned into a flight layer on the SWAP HOST
 *    and animated (WAAPI) from the leaving icon's rect to the entering
 *    one. The delta is signed, so expand/collapse is one code path. The
 *    host is the right stage for two reasons, each the inverse of the
 *    other's failure mode (both from the 2026-11-02 review): its
 *    inline-START edge is the docked edge `align-self: flex-start`
 *    pins — stable while only the inline-END edge tracks the animating
 *    clip width, in LTR and RTL alike (a PHYSICAL left anchor would
 *    drift by the whole width increment in RTL); and the host sits
 *    OUTSIDE both dissolving items, whose opacity the clones must not
 *    inherit — an entering-item stage would multiply every clone by the
 *    item's enter fade (`enter-from` holds opacity 0 until Vue's second
 *    rAF, one frame AFTER this flight arms) and the substituted icons
 *    would blink out for exactly the frames the flight exists to cure.
 *    Clone insets are therefore written as LOGICAL offsets from the
 *    stable inline-start edge, and divided by the ancestor draw scale
 *    (`drawnScale` — a root-level `html { zoom }` multiplies every
 *    measured viewport px by k; values written back in local px would
 *    render k times too far).
 * 3. THE SINGLE-GLYPH CONTRACT (2026-11-02 user direction: the flight
 *    used to double-expose — the flying clone crossed paths with the
 *    entering icon dissolving in at the destination, two glyphs on
 *    screen at once). Both ends of every matched pair are marked
 *    `data-flip-flying` and hidden for the flight's whole window (the
 *    rule keys on the host's `data-flipping` + the mark — item-local
 *    dissolve classes are deliberately NOT part of the selector: they
 *    are transient engine state, and the mark itself already names
 *    exactly the substituted cells): the clone is therefore the ONE
 *    visible glyph of that destination, from arm to landing. The clone
 *    holds full opacity the entire way (no end fade — the fade was the
 *    old handoff, and it is what showed two glyphs); it lands exactly
 *    as the entering dissolve reaches 100%, because both windows read
 *    the same theme duration. The sweep then removes the clone and
 *    unmarks the entering icon in one task — one paint shows the real
 *    icon alone. Even a slipped frame is benign: two identical opaque
 *    glyphs at the SAME rect read as one (the old artifact was two
 *    glyphs at DIFFERENT rects mid-crossing). UNMATCHED keyed cells (a
 *    rail fallback letter with no expanded counterpart) are never
 *    marked, never hidden — they plain dissolve, as the pairing
 *    contract promises.
 * 4. Non-participating icons (identity blocks, group carets, badge
 *    dots), the pills, and the labels crossfade exactly as before.
 *
 * TIMING IS TOKEN-DERIVED, NOT HARDCODED (2026-11-02 user direction):
 * the flight window reads the theme's `--duration-normal` off the swap
 * host's computed style — the very variable HkCrossfade's dissolve
 * consumes — so a retuned theme retunes the flight with it.
 * `RAIL_FLIGHT_MS` survives only as the fallback for environments
 * where custom properties cannot be read (the test DOM); the sweep
 * budget is the derived window plus a fixed margin.
 *
 * GUARDS: skipped entirely under reduced motion, the global animation
 * switch (`html[data-css-animations="0"]`), a missing WAAPI, or when no
 * pair actually moves (identical positions — the dissolve alone is then
 * already seamless). Unmatched keys simply don't fly. A sweep timer
 * (watchdog parity with HkCrossfade's stall budget) removes the layer
 * even where `finish` never fires (rAF-starved tabs); a fresh flip
 * sweeps any previous flight first, so flip-flopping can't stack layers.
 *
 * The same read covers HkCrossfade's `--hk-crossfade-enter-delay`: a
 * host that holds the entering fade back gets a widened window and
 * sweep, and the single-glyph contract makes the alignment exact — the
 * clone covers the destination until the real icon is fully faded in.
 * No shipped rail host sets it today.
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
/** Flight-window FALLBACK for when `--duration-normal` yields no
 *  parsable time: environments that resolve no custom properties (the
 *  test DOM), or a value cssDurationMs cannot read (`calc(…)`, `0s` —
 *  a 0s theme means an instant dissolve; the fallback flight covers
 *  the swap's settle frames and stays single-glyph). A real browser
 *  reads the theme token — see TIMING above. */
export const RAIL_FLIGHT_MS = 300;
/** Sweep margin on top of the (token-derived) flight window: above any
 *  healthy completion (HkCrossfade watchdog parity) so a stalled clone
 *  can never linger, however long the theme draws the dissolve. */
export const RAIL_FLIGHT_SWEEP_MARGIN_MS = 300;

/** Parse a CSS time custom property (`"120ms"`, `"0.15s"`, `""`) into
 *  milliseconds. Anything unparsable or non-positive is 0 — the caller
 *  decides what 0 means (no hold, or the fallback window). */
export function cssDurationMs(value: string): number {
  if (!value) return 0;
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return value.trim().endsWith("s") && !value.trim().endsWith("ms") ? n * 1000 : n;
}

/** Back-compat alias: HkCrossfade's enter hold parses like any duration. */
export const enterDelayMs = cssDurationMs;

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

/** What one flight needs from the swap: the paired icons. */
interface FlightStage {
  pairs: FlightPair[];
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
  onScopeDispose(() => releaseMediaQuery("(prefers-reduced-motion: reduce)"));

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
    return { pairs };
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
    const { pairs } = stage;
    // Identical positions (a host whose densities don't move the icon
    // column): the dissolve alone is already continuous — no layer.
    if (!pairs.some(({ from, to }) => from.left !== to.left || from.top !== to.top)) return;

    // Timing is TOKEN-DERIVED: the flight window reads the theme's
    // --duration-normal (the very variable the dissolve consumes), plus
    // any enter hold the host choreographed. Both ends of the window
    // therefore align with the entering fade without a single
    // hard-coded mirror of the theme's number.
    const vars = getComputedStyle(host);
    const delay = cssDurationMs(vars.getPropertyValue("--hk-crossfade-enter-delay"));
    const dissolveMs =
      cssDurationMs(vars.getPropertyValue("--duration-normal")) || RAIL_FLIGHT_MS;
    const flightMs = dissolveMs + delay;
    const sweepMs = flightMs + RAIL_FLIGHT_SWEEP_MARGIN_MS;

    host.setAttribute(RAIL_FLIP_ACTIVE_ATTR, "");
    // The fallback sweep arms BEFORE any clone animates: a throwing
    // `animate` mid-loop must not strand the freshly hidden marks until
    // the next flip (2026-11-02 review).
    // Stamp BOTH ends of every matched pair BEFORE any paint with the
    // layer up — the single-glyph contract: the leaving cell hides
    // because the clone substitutes it, and the ENTERING cell hides
    // because the clone IS it until landing; two glyphs of one
    // destination must never share a frame. Unmatched opted-in cells
    // stay unmarked and dissolve (2026-11-02 review S1-1). The clone
    // strips the mark again right after cloneNode, so the layer never
    // hides its own citizens.
    for (const pair of pairs) {
      pair.fromEl.setAttribute(RAIL_FLIP_FLYING_ATTR, "");
      pair.template.setAttribute(RAIL_FLIP_FLYING_ATTR, "");
      hidden.push(pair.fromEl, pair.template);
    }
    layer = document.createElement("div");
    layer.className = "hk-sidebar-rail-flight";
    layer.setAttribute("aria-hidden", "true");
    sweepTimer = setTimeout(() => sweepIfCurrent(flightId), sweepMs);
    // The host's inline-start edge is the docked edge — a stable origin
    // in both directions (see the mechanism note above). Its draw scale
    // converts measured viewport px into the local px the layer's own
    // insets are painted at (root zoom).
    const origin = host.getBoundingClientRect();
    const scale = drawnScale(host);
    const rtl = getComputedStyle(host).direction === "rtl";
    for (const pair of pairs) {
      // Logical inline offset from the stage's stable inline-start edge;
      // physical top (the block axis is direction-free).
      // Logical inline offset from the stage's stable inline-start
      // edge, measured INWARD (an inline-start inset grows toward the
      // content: from the LEFT edge in LTR, from the RIGHT edge in RTL —
      // the icon's right edge sits inside the host's, so the RTL value
      // is origin.right − from.right; the sign the other way round
      // pushed every clone outside the docked edge and the clip ate the
      // whole flight — 2026-11-02 review).
      const inlineOffset = rtl
        ? origin.right - pair.from.right
        : pair.from.left - origin.left;
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
      // Pure travel: full opacity the whole way, `fill: forwards` so a
      // frame that slips past finish still shows the clone AT the
      // landing rect (same-geometry overlap with the real icon reads
      // as one glyph) instead of snapping back to the origin.
      const anim = clone.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: `translate(${dx}px, ${dy}px)` },
        ],
        {
          duration: flightMs,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );
      // Same duration on every clone: the first settle sweeps the
      // layer — but only while THIS flight is on stage (a replaced
      // flight's late finish is a no-op, never its successor's sweeper).
      anim.addEventListener("finish", () => sweepIfCurrent(flightId));
      anim.addEventListener("cancel", () => sweepIfCurrent(flightId));
      layer.appendChild(clone);
    }
    host.appendChild(layer);
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
