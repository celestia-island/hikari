import { computed, defineComponent, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { HkCountdownDigit } from "./HkCountdownDigit";
import "./HkScreenIdentifyCard.scss";

/** Where the card parks on the physical screen. Logical, so RTL mirrors
 *  the left/right pair while the card stays at the same corner of the
 *  glass. */
export type ScreenIdentifyPlacement =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

/**
 * HkScreenIdentifyCard — the big numbered card that answers "which
 * screen is this?".
 *
 * Visual grammar (shared by every host, user direction 2026-10-12): a
 * LARGE SQUARE card with a viewport-clamped size, a fixed LIGHT surface
 * and a BLACK number — the mark has to read from across a room and look
 * the same in every theme, so it deliberately does NOT ride the themed
 * surface/ink tokens. The number is the only loud element; the optional
 * screen name and the rolling countdown are corner badges.
 *
 * Presentational only: it paints what it is given. The dwell/countdown
 * state lives in the screen-identify context (`useScreenIdentify`) and
 * the HUD layer comes from `HkScreenIdentifyHost`; mount the card
 * directly only when the caller already owns both.
 */
export default defineComponent({
  name: "HkScreenIdentifyCard",
  props: {
    /** Fleet-wide 1-based screen number (or any short label). */
    number: { type: [Number, String] as PropType<number | string>, required: true },
    /** Stable screen name printed under the number (optional). */
    name: { type: String, default: undefined },
    /** Whole seconds left; 0/absent hides the countdown badge. */
    secondsLeft: { type: Number, default: 0 },
    /** Screen corner. */
    placement: {
      type: String as PropType<ScreenIdentifyPlacement>,
      default: "bottom-left",
      validator: (value: string) =>
        value === "bottom-left" ||
        value === "bottom-right" ||
        value === "top-left" ||
        value === "top-right",
    },
    /** Accessible label override. When absent the card composes one from
     *  the number and the optional name. */
    label: { type: String, default: undefined },
  },
  setup(props) {
    const { t } = useI18n();
    const accessibleLabel = computed<string>(() => {
      if (props.label) return props.label;
      const number = String(props.number);
      if (props.name) {
        return t("hikari::screenIdentify.labelNamed", "Screen {number}, {name}")
          .replace("{number}", number)
          .replace("{name}", props.name);
      }
      return t("hikari::screenIdentify.label", "Screen {number}").replace(
        "{number}",
        number,
      );
    });
    return () => (
      <div
        class="hk-screen-identify"
        data-placement={props.placement}
        role="status"
        aria-label={accessibleLabel.value}
      >
        <span class="hk-screen-identify-num">{props.number}</span>
        {props.name ? <span class="hk-screen-identify-name">{props.name}</span> : null}
        {props.secondsLeft > 0 ? (
          // Seconds left, as hikari's rolling digit — the badge is brief
          // (3s), so the countdown is what makes the dwell legible
          // instead of looking like a flicker.
          <span class="hk-screen-identify-count" aria-hidden="true">
            <HkCountdownDigit value={props.secondsLeft} />
          </span>
        ) : null}
      </div>
    );
  },
});
