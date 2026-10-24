import { defineComponent, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { DEFAULT_ANIMATION_DURATION_MS } from "../composables/useAnimationLoop";
import HkCrossfade from "./HkCrossfade";

import "./HkTransitionContainer.scss";

/**
 * HkTransitionContainer — the state-keyed morph container.
 *
 * HkCrossfade's height-safe dissolve, PLUS the size choreography the
 * user direction (2026-10-22) asks of every swap surface: when the
 * bound state key changes, the OLD content fades out, the container's
 * width/height smoothly animate to the incoming content's natural
 * size, and the NEW content fades in — one 300ms default, CSS-driven
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

    function readStage(): { w: number; h: number } {
      const el = stageRef.value;
      if (!el) return { w: 0, h: 0 };
      return { w: el.offsetWidth, h: el.offsetHeight };
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
        settleTimer = setTimeout(() => {
          pinned.value = null;
          applyPinned();
          const key = pendingKey;
          pendingKey = null;
          if (key !== null) {
            emit("swap", { key, previous: previousKey, durationMs: props.duration });
            // The handoff consumer reads `previous` to scroll the pane back;
            // it must be the key we just left, not the one we mounted with
            // (audit 2026-10-23: it was never reassigned).
            previousKey = key;
          }
        }, motionDuration() + 40);
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
      void nextTick(() => observe());
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
            component owns the measured size morph around it. */}
          <div ref={stageRef} class="hk-tc-stage">
            <HkCrossfade swapKey={props.swapKey}>
              {slots.default?.()}
            </HkCrossfade>
          </div>
        </Tag>
      );
    };
  },
});
