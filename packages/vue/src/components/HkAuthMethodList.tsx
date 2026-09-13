import { defineComponent } from "vue";
import HkIconButtonGroup from "./HkIconButtonGroup";
import "./HkAuthMethodList.scss";

/**
 * HkAuthMethodList — the auth card's third-party sign-in block (the
 * "other ways to sign in" row under the credentials form).
 *
 * Since 2026-09-13 (user direction) the block renders as the ICON
 * BUTTON GROUP by default: one centered `HkIconButtonGroup` row of
 * icon-only provider buttons (mode "buttons", size md) instead of the
 * stacked full-width [icon | label] buttons. Provider identity is
 * revealed on hover — every item wraps itself in an HkTooltip with the
 * provider label — which matches the platform login-chooser pattern
 * (Windows/macOS account tiles) and keeps the card compact when a
 * deployment offers several providers. The `select` event carries the
 * provider `key` exactly as before, so consumers swap rendering
 * without touching their OAuth flow.
 *
 * The wrapper stays `display: contents`: the divider and the group row
 * remain layout children of HkAuthCard's `.s-auth-methods` slot
 * container (it owns the side padding and vertical rhythm).
 */
export default defineComponent({
  name: "HkAuthMethodList",
  props: {
    /** Optional divider text rendered above the row, e.g. "其他方式登录".
     *  Consumer-localized on purpose: hikari ships no dictionary dependency
     *  onto hosts here. */
    divider: { type: String, default: "" },
    /** Provider entries, in render order. */
    methods: {
      type: Array as unknown as () => Array<{
        key: string;
        /** Accessible name + tooltip text (the hover reveal). */
        label: string;
        /** Prebuilt icon vnode (brand SVG, <img>, …) rendered inside the
         *  icon-only button. Typed loose on purpose (same as
         *  HkIconButtonGroup options): hosts materialize hikari against
         *  their own vue store, and a hard VNode type breaks typecheck
         *  whenever the host's vue minor differs. A missing icon falls
         *  back to the label's initial. */
        icon?: unknown;
        disabled?: boolean;
      }>,
      required: true,
    },
  },
  emits: {
    /** A provider button was clicked. */
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    return () => (
      <div class="s-auth-methods-list">
        {props.divider && (
          <div class="s-auth-methods-divider">
            <span>{props.divider}</span>
          </div>
        )}
        <HkIconButtonGroup
          class="s-auth-methods-group"
          mode="buttons"
          size="md"
          options={props.methods.map((method) => ({
            key: method.key,
            label: method.label,
            icon: method.icon,
            disabled: method.disabled === true,
          }))}
          onSelect={(key: string) => emit("select", key)}
        />
      </div>
    );
  },
});
