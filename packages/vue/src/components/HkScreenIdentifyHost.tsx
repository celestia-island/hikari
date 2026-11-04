import { defineComponent, type PropType } from "vue";

import { useScreenIdentify } from "../runtime/useScreenIdentify";
import HkAmbientLayer from "./HkAmbientLayer";
import HkScreenIdentifyCard, {
  type ScreenIdentifyPlacement,
} from "./HkScreenIdentifyCard";

/**
 * HkScreenIdentifyHost — mount ONCE per window to render the
 * screen-identify card.
 *
 * It is the glue between the two halves of the identify contract:
 *
 *   - `useScreenIdentify()` owns the payload, the dwell and the
 *     countdown (any part of the app may call `showScreenIdentify`);
 *   - `HkAmbientLayer` owns the LAYER — the card rides the ambient HUD
 *     root, which paints above every popup, the modal backdrop
 *     included.
 *
 * The host decides nothing else: no transport, no numbering, no app
 * policy. Mount it next to the shell chrome:
 *
 * ```tsx
 * <HkScreenIdentifyHost />
 * ```
 *
 * Callers that want no countdown can pass `durationMs: 0` to
 * `showScreenIdentify` (the card then stays until dismissed).
 */
export default defineComponent({
  name: "HkScreenIdentifyHost",
  props: {
    /** Screen corner; defaults to the shared bottom-left seat. */
    placement: {
      type: String as PropType<ScreenIdentifyPlacement>,
      default: "bottom-left",
    },
    /** Accessible label override forwarded to the card. */
    label: { type: String, default: undefined },
  },
  setup(props) {
    const identify = useScreenIdentify();
    return () => {
      if (!identify.active.value) return null;
      return (
        // No label on the layer: the card carries the status role and
        // the accessible name; a second landmark for a decorative host
        // would just add noise.
        <HkAmbientLayer>
          <HkScreenIdentifyCard
            number={identify.number.value}
            name={identify.name.value}
            secondsLeft={identify.secondsLeft.value}
            placement={props.placement}
            label={props.label}
          />
        </HkAmbientLayer>
      );
    };
  },
});
