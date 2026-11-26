import { defineComponent } from "vue";

import "./HkAuthSsoButton.scss";

/**
 * HkAuthSsoButton — the PRIMARY single-provider sign-in button for auth
 * screens whose whole channel is one redirect ("Continue with Celestia",
 * an org channel that only offers Feishu, …).
 *
 * A single-provider sign-in button for auth screens whose whole channel
 * is one redirect: one large centered square tile with the provider's
 * name in plain sight below it. The visual recipe (framed square,
 * token-based border/surface, brand icon at native colors) descends from
 * the retired auth method tile; the label lives OUTSIDE the button so
 * the click target stays a clean square and the name stays readable at
 * rest.
 *
 * Control contract (same split as every auth card): the button never
 * talks to a backend or builds an OAuth URL — the consumer owns the
 * redirect and injects `on:click`. `icon` is typed loose on purpose
 * (hosts materialize hikari against their own vue store; a hard VNode
 * type breaks typecheck whenever the host's vue minor differs).
 *
 * ```tsx
 * <HkAuthSsoButton
 *   label="Celestia 账号"
 *   icon={<CelestiaMark />}
 *   on:click={() => (window.location.href = beginUrl)}
 * />
 * ```
 */
export const HkAuthSsoButton = defineComponent({
  name: "HkAuthSsoButton",
  props: {
    /** Provider display name — rendered under the tile and used as the
     * button's accessible name. */
    label: { type: String, required: true },
    /** Prebuilt icon vnode (brand SVG, <img>, …) rendered inside the
     * framed square. A missing icon falls back to the label's initial,
     * same as the retired auth method tile's contract. */
    icon: { type: null, default: undefined },
    /** Extra guard on top of the built-in in-flight checks. */
    disabled: { type: Boolean, default: false },
    /** External in-flight state (the consumer already triggered the
     * redirect and is waiting for the navigation to land). */
    loading: { type: Boolean, default: false },
  },
  emits: {
    /** The tile was activated (click or Enter/Space). */
    click: () => true,
  },
  setup(props, { emit }) {
    return () => (
      <div class="hk-auth-sso-button">
        <button
          type="button"
          class="hk-auth-sso-tile"
          aria-label={props.label}
          disabled={props.disabled || props.loading}
          data-loading={props.loading || undefined}
          onClick={() => {
            if (props.disabled || props.loading) return;
            emit("click");
          }}
        >
          <span class="hk-auth-sso-icon" aria-hidden="true">
            {props.icon ?? props.label.trim().charAt(0).toUpperCase()}
          </span>
        </button>
        <span class="hk-auth-sso-label">{props.label}</span>
      </div>
    );
  },
});

export default HkAuthSsoButton;
