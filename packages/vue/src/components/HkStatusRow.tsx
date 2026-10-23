import { defineComponent, type PropType, type VNode } from "vue";

import "./HkStatusRow.scss";

/**
 * HkStatusRow — the family's standard status-card row (task-3 D,
 * user ruling 2026-10-23): one anatomy for every "a thing and its
 * state" listing — the registration wizard's members, the desktop
 * services panel, future install checklists.
 *
 * Anatomy (deliberately fixed):
 * - a 3px status RAIL on the card's left edge — the state at a glance;
 * - an icon CHIP (rounded square, status-tinted wash, default slot);
 * - TITLE + STATUS LINE stacked in the body;
 * - an optional trailing ACTION slot (a button, a copy affordance).
 *
 * The `tone` prop is the single state axis: neutral | info (primary) |
 * success | warning | error. Hosts map their domain states onto tones
 * — the row never guesses.
 */
export type HkStatusRowTone = "neutral" | "info" | "success" | "warning" | "error";

export const HkStatusRow = defineComponent({
  name: "HkStatusRow",
  props: {
    /** The state axis — hosts map domain states onto tones. */
    tone: {
      type: String as PropType<HkStatusRowTone>,
      default: "neutral",
      validator: (v: unknown) =>
        v === "neutral" || v === "info" || v === "success" || v === "warning" || v === "error",
    },
    /** Heading line (the member/service name). */
    title: { type: String, required: true },
    /** Status line under the title (state prose). */
    status: { type: String, default: "" },
    /** Quiet variant: dashed edge + reduced opacity for absent rows. */
    absent: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <div
        class={{
          "hk-status-row": true,
          [`hk-status-row--${props.tone}`]: true,
          "hk-status-row--absent": props.absent,
        }}
      >
        <span class="hk-status-row__chip">{slots.icon?.()}</span>
        <div class="hk-status-row__body">
          <span class="hk-status-row__title">{props.title}</span>
          {props.status ? <span class="hk-status-row__status">{props.status}</span> : null}
          {slots.extra?.()}
        </div>
        {slots.action?.() ? <div class="hk-status-row__action">{slots.action?.()}</div> : null}
      </div>
    );
  },
});

export default HkStatusRow;
