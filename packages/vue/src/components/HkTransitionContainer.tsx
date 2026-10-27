import { defineComponent, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { DEFAULT_ANIMATION_DURATION_MS } from "../composables/useAnimationLoop";
import HkCrossfade from "./HkCrossfade";

import "./HkTransitionContainer.scss";

/** Size delta below which a swap reads as "same box" — sub-pixel
 *  measurement noise must not buy a sequencing beat. */
const SIZE_EPSILON_PX = 1;

/**
 * The swap choreography decision (2026-10-27 user direction), pure so
 * no-layout test environments can pin it directly. The ENTER side is
 * held back one dissolve beat whenever the incoming content needs a
 * different box than the outgoing one:
 *
 * - growing: the box grows WHILE the old content fades out; the new
 *   content fades in only once the box has arrived (the morph can never
 *   clip the incoming content from below);
 * - shrinking: the old content fades at the full old height FIRST, then
 *   the box shrinks while the new (shorter) content fades in — the box
 *   never drops below the incoming height mid-morph, so nothing is
 *   clipped there either (the ResizeObserver stream times the shrink
 *   naturally: the stage keeps the outgoing height until the leave
 *   completes, then collapses, and the observer pins the arrival);
 * - same box: no morph to wait for — the classic simultaneous dissolve
 *   stays (a sequencing beat there would only stutter tabs and labels).
 *
 * A null measurement (no layout: every rect reads zero) reads as "same
 * box" so the choreography degrades to the plain dissolve, never to a
 * broken one.
 */
export function resolveEnterDelay(
  outgoing: { w: number; h: number },
  incoming: { w: number; h: number } | null,
  durationMs: number,
): number {
  if (!incoming || durationMs <= 0) return 0;
  const changed =
    Math.abs(incoming.h - outgoing.h) > SIZE_EPSILON_PX ||
    Math.abs(incoming.w - outgoing.w) > SIZE_EPSILON_PX;
  return changed ? durationMs : 0;
}

/**
 * HkTransitionContainer — the state-keyed morph container.
 *
 * HkCrossfade's height-safe dissolve, PLUS the size choreography the
 * user directions (2026-10-22, refined 2026-10-27) ask of every swap
 * surface: when the bound state key changes, the OLD content fades out,
 * the container's width/height smoothly animate to the incoming
 * content's natural size, and the NEW content fades in — with the
 * sequencing {@link resolveEnterDelay} spells out, so a height-changing
 * swap never clips either generation. One 300ms default, CSS-driven
 * (transition on inline size), with the animation-loop registration
 * kept for the choreography CSS cannot express.
 *
 * Binding: `swapKey` is the identity of the content on stage — the same
 * contract HkCrossfade owns (same value ⇒ no swap). Tabs, segmented
 * controls, editor mode switches, chat-node state labels all reduce to
 * "a key changed; morph to the new panel".
 *
 * Scroll handoff (loose coupling, per the user's spec): the container
 * never touches any scroller itself. Each swap emits a `swap` event
 * carrying `{ key, previous, durationMs }`; the HOST forwards that to
 * its scroll container's PUBLIC interface — the same scrollTo API used
 * for back-to-top and jump-to-line — so the scrollbar adapts to the
 * size change and the caret/anchor coordinate glides instead of
 * teleporting. The scroll container needs zero knowledge of this
 * component.
 *
 * Sizing: a ResizeObserver on the inner stage feeds the container's
 * inline width/height; the CSS transition on those properties does the
 * actual morph (off-thread, cancellable, respects the global animation
 * switch via the duration override to 0s). When the observer is
 * unavailable (older webview, SSR, jsdom) the container degrades to
 * plain auto sizing — a dissolve without the morph, never a broken
 * layout.
 */
export default defineComponent({
  name: "HkTransitionContainer",
  props: {
    /** Identity of the content on stage; changing it starts the morph. */
    swapKey: { type: [String, Number] as PropType<string | number>, required: true },
    /** Which axes morph. `height` is the default (most swap surfaces);
     * `width` for horizontal morphs (segmented panels); `both` for
     * free-floating cards. */
    axis: {
      type: String as PropType<"height" | "width" | "both">,
      default: "height",
    },
    /** Morph + dissolve duration, ms. Family default 300. */
    duration: { type: Number, default: DEFAULT_ANIMATION_DURATION_MS },
    tag: { type: String, default: "div" },
  },
  emits: {
    /** Fired when a swap settles: the host forwards this to its scroll
     * container's public scrollTo interface. */
    swap: (payload: { key: string | number; previous: string | number; durationMs: number }) => true,
  },
  setup(props, { slots, emit }) {
    const hostRef = ref<HTMLElement | null>(null);
    const stageRef = ref<HTMLElement | null>(null);
    // Pinned inline size: `{ w, h }` while morphing, `null` = auto.
    const pinned = ref<{ w: number; h: number } | null>(null);

    let observer: ResizeObserver | null = null;
    let pendingKey: string | number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    /** When the current swap's whole choreography (delayed enter
     *  included) reads as finished, in `performance.now()` time. The
     *  settle timer derives its remaining wait from this, so a swap
     *  whose observer fires late still settles no earlier than the
     *  enter ends. */
    let choreoEndsAt = 0;
    /** The total choreography length reported to the host through the
     *  `swap` event's `durationMs` — a delayed swap runs one beat longer
     *  than the bare dissolve, and a scroll-glide handoff should glide
     *  across the whole choreography, not just its fade. */
    let choreoMs = props.duration;

    function readStage(): { w: number; h: number } {
      const el = stageRef.value;
      if (!el) return { w: 0, h: 0 };
      return { w: el.offsetWidth, h: el.offsetHeight };
    }

    /**
     * The entering generation's item. Found by DATASET comparison, never
     * by interpolating the key into a selector: a key is an opaque
     * identity and may contain quotes — a malformed selector would throw
     * inside this post-flush callback and kill the whole choreography
     * wiring for the swap (stale delay var, dead observer, unhandled
     * rejection; R2 2026-10-27 S1).
     */
    function enteringItem(
      stage: HTMLElement,
      key: string | number,
    ): HTMLElement | null {
      const wanted = String(key);
      for (const el of Array.from(
        stage.querySelectorAll<HTMLElement>(".hk-crossfade-item"),
      )) {
        if (el.dataset.crossfadeKey === wanted) return el;
      }
      return null;
    }

    /**
     * The natural content size of the entering generation. The item
     * itself stretches to the shared grid track (the max of the stacked
     * generations), so during the dissolve its own box masks the
     * incoming content — the CHILDREN carry the natural flow height.
     * Null when nothing measurable exists (no layout: every rect reads
     * zero), which the decision treats as "same box".
     *
     * Known measure blind spots, both degrade to "same box" (the exact
     * pre-choreography dissolve) rather than to a broken swap: text-only
     * slots (no element children to measure) and slots whose only child
     * is height-percentage (it stretches with the track it should be
     * measuring). Real content sections — cards, groups, forms — all
     * measure true.
     */
    function measureIncomingNaturalSize(
      stage: HTMLElement,
      key: string | number,
    ): { w: number; h: number } | null {
      const item = enteringItem(stage, key);
      if (!item) return null;
      const itemTop = item.getBoundingClientRect().top;
      let w = 0;
      let h = 0;
      for (const child of Array.from(item.children)) {
        const r = child.getBoundingClientRect();
        w = Math.max(w, Math.ceil(r.width));
        h = Math.max(h, Math.ceil(r.bottom - itemTop));
      }
      if (w <= 0 && h <= 0) return null;
      return { w, h };
    }

    function applyPinned(): void {
      const el = hostRef.value;
      if (!el) return;
      const p = pinned.value;
      el.style.width = p && props.axis !== "height" ? `${p.w}px` : "";
      el.style.height = p && props.axis !== "width" ? `${p.h}px` : "";
    }

    function observe(): void {
      if (typeof ResizeObserver === "undefined" || !stageRef.value) return;
      observer?.disconnect();
      observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect || pendingKey === null) return;
        // Stage settled at the incoming content's natural size: pin to
        // it (from the outgoing size) → next frame the CSS transition
        // morphs the container; after the duration, release to auto.
        pinned.value = { w: Math.ceil(rect.width), h: Math.ceil(rect.height) };
        applyPinned();
        if (settleTimer !== null) clearTimeout(settleTimer);
        // Settle no earlier than the choreography's true end (a delayed
        // enter runs one beat past the morph), measured from NOW so an
        // observer event that lands mid-swap still waits the right
        // remainder.
        settleTimer = setTimeout(() => {
          pinned.value = null;
          applyPinned();
          // The hold belongs to THIS swap alone: leaving it set would make
          // every NESTED crossfade inside the slot inherit a full beat of
          // delay until the next outer swap happens to rewrite the
          // property (R2 2026-10-27 S2).
          hostRef.value?.style.setProperty("--hk-crossfade-enter-delay", "0ms");
          const key = pendingKey;
          pendingKey = null;
          if (key !== null) {
            emit("swap", { key, previous: previousKey, durationMs: choreoMs });
            // The handoff consumer reads `previous` to scroll the pane back;
            // it must be the key we just left, not the one we mounted with
            // (audit 2026-10-23: it was never reassigned).
            previousKey = key;
          }
        }, Math.max(choreoEndsAt - performance.now(), 0) + 40);
      });
      observer.observe(stageRef.value);
    }

    let previousKey: string | number = props.swapKey;

    watch(() => props.swapKey, (next) => {
      // Pin the OUTGOING size first so the container never collapses
      // through zero while the content swaps underneath.
      pendingKey = next;
      pinned.value = readStage();
      applyPinned();
      // A settle timer armed by a PREVIOUS swap that never fired (the
      // user flipped the key again mid-choreography) must not discharge
      // into THIS swap: it would release the just-pinned outgoing size
      // and emit this swap as settled before its own choreography ends.
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      void nextTick(() => {
        // The choreography decision (2026-10-27): hold the ENTER side one
        // beat whenever the incoming content needs a different box. The
        // hold must be in place before the transition STARTS: Vue adds
        // enter-from + enter-active during the patch, and the double-rAF
        // nextFrame removes enter-from — the style recalc where the
        // opacity transition begins and its delay is read. This post-flush
        // microtask always precedes that frame, so the custom property is
        // in place in time (verified against the installed Vue 3.5
        // runtime, R2 2026-10-27). The leave side and the size morph need
        // no help: the observer stream naturally grows the box during the
        // exit (the stage reads the max of both generations) and shrinks
        // it only after the leave completes.
        const outgoing = pinned.value ?? { w: 0, h: 0 };
        // Without a ResizeObserver there is no morph to wait for — the
        // box snaps to the incoming size, so a hold would only park the
        // new content on a blind beat (R2 2026-10-27): keep master's
        // plain dissolve on that path.
        const measurable =
          typeof ResizeObserver !== "undefined" && stageRef.value != null;
        const incoming = measurable
          ? measureIncomingNaturalSize(stageRef.value!, next)
          : null;
        const delay = resolveEnterDelay(outgoing, incoming, motionDuration());
        hostRef.value?.style.setProperty("--hk-crossfade-enter-delay", `${delay}ms`);
        choreoMs = delay + motionDuration();
        choreoEndsAt = performance.now() + choreoMs;
        observe();
      });
    });

    /**
     * Reduced motion: the morph runs on an INLINE `transitionDuration`,
     * which no stylesheet `@media (prefers-reduced-motion)` can override
     * (inline beats non-important rules) and which the host's
     * `html[data-css-animations="0"]` pin only covers if the host wired
     * useReducedMotion() at boot. So the gate lives HERE (audit
     * 2026-10-23): zero the morph when the OS asks for reduced motion or
     * the host turned the animation switch off. The dissolve side is
     * already handled by HkCrossfade's own media query.
     */
    function motionDuration(): number {
      if (typeof window === "undefined") return props.duration;
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const switchedOff =
        document.documentElement.dataset.cssAnimations === "0";
      return reduced || switchedOff ? 0 : props.duration;
    }

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
      if (settleTimer !== null) clearTimeout(settleTimer);
    });

    return () => {
      const Tag = props.tag as "div" | "section" | "main" | "aside";
      const d = `${motionDuration()}ms`;
      return (
        <Tag
          ref={hostRef}
          class="hk-tc"
          style={{
            transitionProperty:
              props.axis === "both" ? "width, height" : props.axis === "width" ? "width" : "height",
            transitionDuration: d,
          }}
        >
          {/* The stage is HkCrossfade: it owns the opacity dissolve
              (both generations stacked in one grid cell — no exit blank,
              no collapse flash) and the swap-stall watchdog; THIS
              component owns the measured size morph around it — and the
              enter sequencing: the decision above sets the delay
              property per swap, while this prop widens the watchdog and
              animation-bus budgets to cover the worst-case hold. */}
          <div ref={stageRef} class="hk-tc-stage">
            <HkCrossfade swapKey={props.swapKey} enterDelay={motionDuration()}>
              {slots.default?.()}
            </HkCrossfade>
          </div>
        </Tag>
      );
    };
  },
});
