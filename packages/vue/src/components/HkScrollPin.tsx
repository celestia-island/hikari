import { defineComponent, onMounted, ref, type PropType } from "vue";

import "./HkScrollPin.scss";

/** Which edge of the nearest scroll host the pinned content rides. A
 *  vertical scroller pins top/bottom; a horizontal scroller pins
 *  left/right (the component warns in dev when a side contradicts the
 *  host's declared `data-scroll-axis`). */
export type ScrollPinSide = "top" | "bottom" | "left" | "right";

/**
 * How the pin keeps the host's whitespace:
 *
 * - `"auto"` (default) — read the host: a host that paints its gutters
 *   itself (`data-pad-cover`, HkModal) gets `"offset"`; every other host
 *   gets `"bleed"`.
 * - `"offset"` — stop at the host's declared gutter line
 *   (`--hk-scroll-pad-*`); the host paints the zone above/below the pin,
 *   so scrolled content vanishes under the whitespace instead of showing
 *   through a gap. Works for pins anywhere in the flow (toolbars may
 *   precede them).
 * - `"bleed"` — absorb the host's in-flow padding into the pin itself
 *   (`padding: var(--hk-scroll-pad-…) + negative margin`): the pin's own
 *   background paints over the padding zone so the whitespace travels
 *   with the pinned content. Only safe for boundary pins — a top bleed
 *   pin must be the first element of the scroll content (a bottom bleed
 *   pin the last) — a negative margin would otherwise overlap preceding
 *   siblings.
 * - `"none"` — plain `position: sticky` flush at the edge; the host has
 *   no declared padding or the consumer opts out of the contract.
 */
export type ScrollPinStrategy = "auto" | "offset" | "bleed" | "none";

/** Scroll hosts that participate in the pin contract mark their
 *  viewport with this class (HkModal body scroller, HkScrollContainer
 *  viewport) and may declare `--hk-scroll-pad-top/right/bottom/left`
 *  plus `data-scroll-axis="vertical|horizontal|both"`. */
export const SCROLL_HOST_CLASS = "hk-scroll-pin-host";

const AXIS_OK: Record<string, ScrollPinSide[]> = {
  vertical: ["top", "bottom"],
  horizontal: ["left", "right"],
  both: ["top", "bottom", "left", "right"],
};

/**
 * Pinned scroll content with a guaranteed whitespace contract: content
 * placed in an `HkScrollPin` rides one edge of the nearest scroll host
 * and never scrolls away — and the host's padding travels WITH it, so
 * the pinned element keeps its breathing room (the 2026-09-14 wizard
 * report: the step header pinned flush against the modal header because
 * the body padding scrolled away beneath it).
 *
 * The pin is a plain `position: sticky` wrapper — it must sit inside the
 * host's scroll flow (not inside a `position: absolute`/`fixed`
 * ancestor, and not inside an `overflow: hidden` ancestor between it and
 * the host, which would break stickiness).
 */
export default defineComponent({
  name: "HkScrollPin",
  props: {
    /** Edge of the scroll host to pin against. */
    side: {
      type: String as PropType<ScrollPinSide>,
      default: "top",
      validator: (v: string) => ["top", "bottom", "left", "right"].includes(v),
    },
    /** Whitespace strategy — see the type doc. `"auto"` resolves from
     *  the host at mount and is what every consumer should default to. */
    strategy: {
      type: String as PropType<ScrollPinStrategy>,
      default: "auto",
      validator: (v: string) => ["auto", "offset", "bleed", "none"].includes(v),
    },
    /** Override the default stacking height (pins float above scroll
     *  content; hosts retune through `--hk-scroll-pin-z`). */
    z: { type: Number, default: undefined },
  },
  setup(props, { slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    /** Strategy after `"auto"` resolution — rendered as data-strategy so
     *  the SCSS has one total switch to key on. */
    const resolved = ref<"offset" | "bleed" | "none">("bleed");
    let warned = false;

    function warnOnce(message: string): void {
      if (warned || !import.meta.env?.DEV) return;
      warned = true;
      console.warn(`[HkScrollPin] ${message}`);
    }

    function resolveStrategy(): void {
      const el = rootRef.value;
      if (!el) return;
      const host = el.closest(`.${SCROLL_HOST_CLASS}`);
      if (host) {
        const axis = host.getAttribute("data-scroll-axis");
        const allowed = AXIS_OK[axis ?? ""] ?? AXIS_OK.both;
        if (!allowed.includes(props.side)) {
          warnOnce(
            `side="${props.side}" contradicts the nearest scroll host axis "${axis ?? "unmarked"}" — ` +
              `vertical scrollers pin top/bottom, horizontal scrollers pin left/right.`,
          );
        }
      }
      if (props.strategy !== "auto") {
        resolved.value = props.strategy;
        return;
      }
      const covered =
        host !== null &&
        host.hasAttribute("data-pad-cover") &&
        padDeclared(host, props.side);
      resolved.value = covered ? "offset" : "bleed";
      if (host === null) {
        // No marked host: the pin still sticks (nearest scroll ancestor),
        // but the whitespace contract cannot resolve — tell the author.
        warnOnce(
          "no .hk-scroll-pin-host ancestor found — the pin sticks to its nearest scrollable ancestor " +
            "without a whitespace contract; mark the scroll viewport (SCROLL_HOST_CLASS) to opt in.",
        );
      }
    }

    function padDeclared(host: Element, side: ScrollPinSide): boolean {
      const value = getComputedStyle(host).getPropertyValue(`--hk-scroll-pad-${side}`).trim();
      return value !== "" && value !== "0px";
    }

    onMounted(resolveStrategy);

    // Runtime host swaps (teleports, conditional wrappers) re-resolve on
    // the next mount only — a pin that changes host must be re-keyed by
    // the consumer. No listeners are held, so unmount needs no teardown.

    return () => {
      return (
        <div
          ref={rootRef}
          class="hk-scroll-pin"
          data-side={props.side}
          data-strategy={resolved.value}
          style={props.z !== undefined ? { zIndex: String(props.z) } : undefined}
        >
          {slots.default?.()}
        </div>
      );
    };
  },
});
