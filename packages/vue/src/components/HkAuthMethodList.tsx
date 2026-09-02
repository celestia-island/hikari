import { defineComponent, type PropType, type VNode } from "vue";
import HkButton from "./HkButton";
import "./HkAuthMethodList.scss";

/**
 * HkAuthMethodList — full-width stacked third-party sign-in buttons for
 * auth cards (the ERP login's provider-button grammar, componentized).
 *
 * Every button renders [icon | label] with a FIXED icon column and a FIXED
 * label column (CSS var `--auth-methods-label-width`, default 8em), so the
 * icons and the label text start at the same x on every row regardless of
 * label length; because every content block is then the same width, the
 * row can stay centered like any HkButton without the columns drifting.
 *
 * Render it through HkAuthCard's `methods` slot: the card owns the
 * full-width block layout and the vertical rhythm, and the footer's
 * checkbox rows keep their centered-group behavior instead of being
 * dragged full width with the buttons.
 */
export default defineComponent({
  name: "HkAuthMethodList",
  props: {
    /** Optional divider text rendered above the buttons, e.g. "其他方式登录".
     *  Consumer-localized on purpose: hikari ships no dictionary dependency
     *  onto hosts here. */
    divider: { type: String, default: "" },
    /** Provider entries, in render order. */
    methods: {
      type: Array as unknown as () => Array<{
        key: string;
        label: string;
        /** Prebuilt icon vnode (brand SVG, <img>, …) — `null` renders an
         *  empty fixed-width column so the labels still align. The column
         *  is fixed-size, so any ~16-20px glyph aligns. */
        icon?: VNode | null;
        disabled?: boolean;
      }>,
      required: true,
    },
  },
  emits: {
    /** A method button was clicked. */
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    return () => (
      <>
        {props.divider && (
          <div class="s-auth-methods-divider">
            <span>{props.divider}</span>
          </div>
        )}
        {props.methods.map((method) => (
          <HkButton
            key={method.key}
            variant="outline"
            size="md"
            block
            disabled={method.disabled === true}
            onClick={() => emit("select", method.key)}
          >
            <span class="s-auth-methods-icon">{method.icon}</span>
            <span class="s-auth-methods-label">{method.label}</span>
          </HkButton>
        ))}
      </>
    );
  },
});
