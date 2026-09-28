import { defineComponent } from "vue";

import { HkAuthCard } from "./HkAuthCard";
import HkAuthMethodList from "./HkAuthMethodList";

import "./HkThirdPartySignInCard.scss";

/**
 * HkThirdPartySignInCard — the passwordless sign-in card: the auth shell
 * with third-party method tiles as its PRIMARY and ONLY content.
 *
 * For deployments where password login is disabled (the ERP login page in
 * Feishu-only mode, shittim-chest's org channel), the login UI must show
 * centered provider buttons and NOTHING else — no username/password
 * fields, no submit button, no "alternative ways" framing. This card is
 * that composition: `HkAuthCard` (title/subtitle/logo header) with an
 * `HkAuthMethodList` rendered into the card's form-body slot, promoted to
 * primary-flow presence through a context-scoped tile modifier.
 *
 * Control contract (same split as HkSignInCard): the card owns no state
 * and never talks to a backend. The consumer passes the provider
 * `methods` (same item shape as HkAuthMethodList) and binds the OAuth
 * redirect/popup to `select(key)`; the in-flight state feeds back through
 * `loading`, which disables every tile for the duration.
 *
 * Layout contract: the list renders into the card BODY (`.s-auth-form`
 * container), NOT the `methods` slot — that slot's top margin and banding
 * exist to separate "alternative" buttons from a credentials form above,
 * and would read as dead space with nothing above them. The body wrapper
 * (`.s-auth-third-party-body`) restores the methods block's own
 * divider→tile rhythm and centers the row; its scss also scales the tiles
 * up one step, because the standard 44px "alternative row" tile reads
 * undersized when it is the whole card.
 *
 * Slots: `top` (content between the header and the tiles — channel tabs
 * and similar; there is no `<form>` to keep it out of), `footer`
 * (remember-me / protocol rows, forwarded to HkAuthCard's centered
 * footer group) and `logo` (replaces the `logoSrc` image).
 *
 * i18n: hikari ships no dictionary for consumer copy — `title`,
 * `subtitle` and the `divider` text are all consumer-localized on
 * purpose, exactly like HkAuthMethodList's divider.
 *
 * ```tsx
 * <HThirdPartySignInCard
 *   title="Sign in"
 *   subtitle="Continue with Feishu"
 *   :logo-src="logo"
 *   :loading="pending"
 *   :methods="[{ key: 'feishu', label: 'Feishu', icon: feishuIcon }]"
 *   @select="(key) => startOAuth(key)"
 * />
 * ```
 */
export const HkThirdPartySignInCard = defineComponent({
  name: "HkThirdPartySignInCard",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    /** Optional logo image URL for the card header. */
    logoSrc: { type: String, default: undefined },
    /** External in-flight state; disables every tile while true. */
    loading: { type: Boolean, default: false },
    /** Optional divider text above the tiles, forwarded to
     *  HkAuthMethodList (consumer-localized on purpose). */
    divider: { type: String, default: "" },
    /** Provider entries, in render order — same item shape as
     *  HkAuthMethodList's `methods`. */
    methods: {
      type: Array as unknown as () => Array<{
        key: string;
        /** Accessible name + tooltip text (the hover reveal). */
        label: string;
        /** Prebuilt icon vnode rendered inside the framed tile; a
         *  missing icon falls back to the label's initial. */
        icon?: unknown;
        disabled?: boolean;
      }>,
      required: true,
    },
  },
  emits: {
    /** A provider tile was clicked; carries the method `key`. */
    select: (_key: string) => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <HkAuthCard title={props.title} subtitle={props.subtitle}>
        {{
          logo: () =>
            slots.logo ? (
              slots.logo()
            ) : props.logoSrc ? (
              <img class="hk-logo-img" src={props.logoSrc} alt="" style={{ width: "3.5rem", height: "3.5rem" }} />
            ) : null,
          default: () => (
            <>
              {slots.top?.()}
              {/* The wrapper carries BOTH classes: `s-auth-methods` is
                  the container HkAuthMethodList's scoped rules resolve
                  against (tile-row centering, tooltip-wrapper sizing),
                  `s-auth-third-party-body` re-positions it as the card
                  body — see the scss. */}
              <div class="s-auth-methods s-auth-third-party-body">
                {/* `loading` maps onto the per-entry disabled flag so the
                    list itself stays untouched: HkAuthMethodList already
                    renders disabled tiles dead and click-swallowing. An
                    entry's own disabled bit survives (OR, not replace). */}
                <HkAuthMethodList
                  divider={props.divider}
                  methods={
                    props.loading
                      ? props.methods.map((method) => ({ ...method, disabled: true }))
                      : props.methods
                  }
                  onSelect={(key: string) => emit("select", key)}
                />
              </div>
            </>
          ),
          footer: () => slots.footer?.(),
        }}
      </HkAuthCard>
    );
  },
});
