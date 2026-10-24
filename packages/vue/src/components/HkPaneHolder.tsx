import { defineComponent } from "vue";

import "./HkPaneHolder.scss";

/**
 * HkPaneHolder — the keep-mounted pane slot.
 *
 * The third pane-swap surface, for the class of content the dissolve
 * primitives cannot serve: PERSISTENT panes whose instance must survive
 * while another pane is active — draft stores (an editor whose unsaved
 * state lives in the component), canvases/WebGL stages that are too
 * expensive to rebuild, or sockets that must not unplug.
 *
 * `HkCrossfade` / `HkTransitionContainer` swap by keying: the leaving
 * generation UNMOUNTS when the dissolve completes — exactly wrong for a
 * draft store. This holder instead keeps every pane in the tree and
 * toggles reachability: `display: none` while inactive (out of layout,
 * inert), `display: block` plus a one-shot opacity reveal when it
 * becomes active. The reveal is opacity-ONLY at the family's
 * `--duration-normal`, matching the dissolve language — no movement,
 * ever.
 *
 * Contract:
 * - `active` is a boolean, not a key: the holder IS one pane. A tab
 *   surface renders one holder per persistent pane beside the ordinary
 *   panel slots it already has.
 * - The inactive pane is `display: none` (inert, out of the layout,
 *   unreadable by assistive tech) but its component instances, state
 *   and watchers all LIVE — that is the entire point.
 * - The reveal animation is `hk-pane-holder-in` (opacity 0→1, one
 *   shot, registered with the animation registry); reduced motion and
 *   the global `data-css-animations="0"` switch clamp it to instant,
 *   so the holder never animates for users who opted out.
 * - No leave animation: the outgoing pane simply hides (it is usually
 *   being covered by an incoming ordinary panel whose own dissolve is
 *   the visible exchange).
 */
export const HkPaneHolder = defineComponent({
  name: "HkPaneHolder",
  props: {
    /** Whether THIS pane is the active one. */
    active: { type: Boolean, required: true },
    tag: { type: String, default: "div" },
  },
  setup(props, { slots }) {
    return () => {
      const Tag = props.tag as "div" | "section";
      return (
        <Tag class="hk-pane-holder" data-active={props.active || undefined}>
          {slots.default?.()}
        </Tag>
      );
    };
  },
});

export default HkPaneHolder;
