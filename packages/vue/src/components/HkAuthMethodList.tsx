import { defineComponent } from "vue";
import HkTooltip from "./HkTooltip";
import "./HkAuthMethodList.scss";

/**
 * HkAuthMethodList — the auth card's third-party sign-in block (the
 * "other ways to sign in" row under the credentials form).
 *
 * Since 2026-09-14 (user direction) the block renders as CENTERED
 * INDEPENDENT icon tiles: every provider is its own framed 44px icon
 * button with its own tooltip — NOT a button group. A group track (one
 * shared frame stretched across the card with the icons floating in
 * the middle) reads as an oversized empty box; the button-group
 * component is reserved for its two fundamental jobs — a selector
 * (single/multiple) and a tight action strip (see HkIconButtonGroup).
 *
 * Provider identity is revealed on hover: each tile wraps itself in an
 * HkTooltip carrying the provider label, which matches the platform
 * login-chooser pattern (Windows/macOS account tiles) and keeps the
 * card compact when a deployment offers several providers. The
 * `select` event carries the provider `key` exactly as before, so
 * consumers swap rendering without touching their OAuth flow.
 *
 * The wrapper stays `display: contents`: the divider and the tile row
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
         *  framed tile. Typed loose on purpose (same as HkIconButtonGroup
         *  options): hosts materialize hikari against their own vue store,
         *  and a hard VNode type breaks typecheck whenever the host's vue
         *  minor differs. A missing icon falls back to the label's
         *  initial. */
        icon?: unknown;
        disabled?: boolean;
      }>,
      required: true,
    },
  },
  emits: {
    /** A provider tile was clicked. */
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
        {/* A plain row, deliberately NOT role="group": every tile is an
            independent action (its own frame, its own tooltip), and the
            divider above names the section for sighted users. Group
            semantics belong to the selector/tight-strip components. */}
        <div class="s-auth-methods-tiles">
          {props.methods.map((method) => {
            const tile = (
              <button
                key={method.key}
                type="button"
                class="s-auth-methods-tile"
                data-key={method.key}
                aria-label={method.label}
                title={undefined} // the HkTooltip popup owns the hover text
                disabled={method.disabled === true}
                onClick={() => emit("select", method.key)}
              >
                <span class="s-auth-methods-tile-icon" aria-hidden="true">
                  {method.icon != null
                    ? method.icon
                    : (
                      <span class="s-auth-methods-tile-initial">
                        {method.label.charAt(0).toUpperCase()}
                      </span>
                    )
                  }
                </span>
              </button>
            );
            return (
              <HkTooltip key={method.key} text={method.label} placement="top" delay={300}>
                {tile}
              </HkTooltip>
            );
          })}
        </div>
      </div>
    );
  },
});
