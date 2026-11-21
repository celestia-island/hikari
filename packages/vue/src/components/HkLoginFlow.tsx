import { computed, defineComponent, ref, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { asPropType } from "../utils/typing";
import { HkAuthCard } from "./HkAuthCard";
import HkAuthMethodList, { type HkAuthMethodListEntry } from "./HkAuthMethodList";
import { HkAuthSsoButton } from "./HkAuthSsoButton";
import { HkMfaVerifyCard } from "./HkMfaVerifyCard";
import { HkSignInCard } from "./HkSignInCard";
import HkStepFlow from "./HkStepFlow";
import HkTabs from "./HkTabs";
import HkTransitionContainer from "./HkTransitionContainer";

import "./HkLoginFlow.scss";

/** A channel whose sign-in is a credentials handshake the host drives:
 * the card collects the account name (password only when the host opts
 * in) and `account-submit` carries it to the host's ladder. */
export interface HkLoginCredentialsChannel {
  key: string;
  mode: "credentials";
  /** Segment label; defaults to the `hikari::loginFlow.channel*` locale
   * for the conventional `cloud` / `org` keys, else the key itself. */
  label?: string;
  /** Card title; defaults to `hikari::loginFlow.signInTitle`. */
  title?: string;
  /** Card subtitle; defaults to `hikari::loginFlow.signInSubtitle`. */
  subtitle?: string;
  /** Username-field type; `email` renders the identifier login. */
  usernameType?: "text" | "email";
  usernamePlaceholder?: string;
  /** Autocomplete token forwarded to the username field (e.g. "email"
   *  on identifier logins); HkSignInCard's runtime credential policy
   *  resolves the default. */
  usernameAutocomplete?: string;
  /** Classic two-field card. Defaults to FALSE — account-first is the
   *  family-wide posture since the MFA redesign: the password is proven
   *  on the verify step as one factor among the announced ones, so the
   *  opening card must not ask for it (2026-11 user direction). */
  passwordField?: boolean;
  submitLabel?: string;
  /** Alternative sign-in tiles under the form (rendered only when
   *  non-empty; an empty list omits the whole methods block instead of
   *  padding a dead strip). */
  methods?: HkAuthMethodListEntry[];
  /** Divider text above the tiles; consumer-localized on purpose. */
  methodsDivider?: string;
}

/** A channel whose whole sign-in is one redirect (a.celestia.world's
 * "Celestia" tile jumping to the central login, an org channel that
 * only offers Feishu): the card renders one centered primary tile and
 * `sso-click` sends the host off to build its OAuth URL. */
export interface HkLoginSsoChannel {
  key: string;
  mode: "sso";
  label?: string;
  title?: string;
  subtitle?: string;
  /** Provider mark for the tile (brand SVG, <img>, …). Loose-typed like
   *  every auth icon: hosts materialize hikari against their own vue. */
  icon: unknown;
  /** Accessible name + the line under the tile; defaults to the channel
   *  label. */
  buttonLabel?: string;
  disabled?: boolean;
}

export type HkLoginChannel = HkLoginCredentialsChannel | HkLoginSsoChannel;

/**
 * HkLoginFlow — the full sign-in panel every Celestia front end shares:
 * the channel segment group ("Celestia / 组织登录") over a per-channel
 * card, with the account→verify step machine built in.
 *
 * This is the business-level composition above the auth kit (extracted
 * from shittim-chest's LoginView, 2026-11 user direction: the login
 * screen had drifted into per-app reimplementations). It owns EVERYTHING
 * visual — the pill segment group (hidden when a deployment offers a
 * single channel; a lone dead segment reads as a broken switch), the
 * height-morphing channel swap, the direction-aware account→verify
 * slide, the methods tiles, the MFA card — while staying a CONTROLLED
 * component: no endpoint, no URL building, no factor ladder policy.
 * The host (chest, erp, arona, …) keeps its own auth client and drives
 * the panel through props/events:
 *
 * - `v-model` (channel key) + `channels` — the segment group.
 * - `step` — `'account' | 'verify'`; the host flips it when its ladder
 *   answers with factors, and the panel slides to `HkMfaVerifyCard`
 *   (which never renders on an sso channel: a redirect flow has no
 *   second step by construction — passing `step="verify"` with an sso
 *   channel renders the account card as a fail-safe).
 * - `account-submit(channel, username, password)` — credentials
 *   channel submitted (password is empty while `passwordField` is off).
 * - `method-select(channel, key)` — an alternative tile was picked.
 * - `sso-click(channel)` — the primary sso tile was picked.
 * - `verify(kind, proof)` / `verify-resend` / `verify-back` — the MFA
 *   card's events, re-emitted one level up.
 *
 * Copy rules locked by the chest blueprint (LoginView.test.ts, kept
 * verbatim here): segment labels are ALWAYS the panel's own locale keys,
 * never a server-provided provider name (a provider label leaked into
 * the channel tabs once and read as "log in to ERP" instead of "log in
 * with your organization"); the group renders only for 2+ channels; an
 * empty `methods` list omits the block entirely (a null-rendered slot
 * still pads the card's methods strip).
 *
 * `initialUsername` rides the account→verify→back round-trip (the
 * credentials card remounts when the user navigates back, so the typed
 * name must travel through a prop rather than die with the card).
 *
 * ```tsx
 * <HkLoginFlow
 *   v-model={channel.value}
 *   channels={channels}
 *   step={mfa.value ? "verify" : "account"}
 *   loading={pending.value}
 *   verifyFactors={mfa.value?.factors ?? []}
 *   onAccount-submit={onBegin}
 *   onVerify={onVerify}
 * />
 * ```
 */
export const HkLoginFlow = defineComponent({
  name: "HkLoginFlow",
  props: {
    /** The deployment's sign-in channels. One entry renders a plain
     *  card (no segment group); two entries render the pill group. */
    channels: {
      type: asPropType<HkLoginChannel[]>(Array),
      required: true,
    },
    /** Active channel key (`v-model`). */
    modelValue: { type: String, required: true },
    /** Flow step: `account` (the channel cards) or `verify` (the MFA
     *  card). Controlled by the host's ladder state. */
    step: { type: String as PropType<"account" | "verify">, default: "account" },
    /** In-flight state of the credentials submit. */
    loading: { type: Boolean, default: false },
    /** Logo image URL forwarded to the active card's header. */
    logoSrc: { type: String, default: undefined },
    /** Seed for the credentials card's username field — survives the
     *  verify round-trip (see HkSignInCard.initialUsername). */
    initialUsername: { type: String, default: "" },
    // --- verify-step pass-through (HkMfaVerifyCard props) ---
    verifyFactors: {
      type: Array as PropType<readonly string[]>,
      default: () => [],
    },
    verifyProven: { type: String, default: undefined },
    verifyAccountName: { type: String, default: "" },
    verifyLoading: { type: Boolean, default: false },
    verifyResending: { type: Boolean, default: false },
    passkeyRetryHint: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_key: string) => true,
    "account-submit": (_channel: string, _username: string, _password: string) => true,
    "method-select": (_channel: string, _key: string) => true,
    "sso-click": (_channel: string) => true,
    verify: (_kind: string, _proof: string) => true,
    "verify-resend": () => true,
    "verify-back": () => true,
  },
  setup(props, { emit, slots, expose }) {
    const { t } = useI18n();
    /** HkMfaVerifyCard's exposed handles, forwarded one level up so
     *  hosts never hold a ref into the panel's internals: `clearProof`
     *  empties the field after a rejected proof, `focusPassword`
     *  re-arms the password entry, `selectedFactor` reports the factor
     *  on stage (a two-proof host needs the kind it just proved when
     *  the server does not echo it back). Vue's instance type does not
     *  carry expose() members, so the binding carries the declared
     *  handle type. */
    type MfaCardHandle = {
      clearProof: () => void;
      focusPassword: () => void;
      selectedFactor: () => unknown;
    };
    const mfaRef = ref<MfaCardHandle | null>(null);

    const currentChannel = computed(
      () =>
        props.channels.find((channel) => channel.key === props.modelValue) ??
        props.channels[0],
    );

    /** Segment label precedence: explicit label > the conventional-key
     *  locale > the raw key. The conventional keys cover every Celestia
     *  deployment today, so most hosts pass no labels at all. */
    function channelLabel(channel: HkLoginChannel): string {
      if (channel.label) return channel.label;
      if (channel.key === "cloud") return t("hikari::loginFlow.channelCloud", "Celestia Cloud");
      if (channel.key === "org") return t("hikari::loginFlow.channelOrg", "Organization login");
      return channel.key;
    }

    /** Consumer handles: forwarded from the inner MFA card. `clearProof`
     *  empties the active field after a rejected proof; `selectedFactor`
     *  reports the factor on stage; `focusPassword` re-arms focus. */
    expose({
      clearProof: () => mfaRef.value?.clearProof(),
      focusPassword: () => mfaRef.value?.focusPassword(),
      selectedFactor: () => mfaRef.value?.selectedFactor(),
    });

    const tabsEl = () =>
      props.channels.length > 1 ? (
        <HkTabs
          variant="pill"
          modelValue={currentChannel.value?.key}
          onUpdate:modelValue={(key: string) => emit("update:modelValue", key)}
          tabs={props.channels.map((channel) => ({
            key: channel.key,
            label: channelLabel(channel),
          }))}
          renderPanels={false}
        />
      ) : null;

    function renderCredentialsCard(channel: HkLoginCredentialsChannel) {
      const methods = channel.methods ?? [];
      return (
        <HkSignInCard
          key={channel.key}
          title={channel.title ?? t("hikari::loginFlow.signInTitle", "Sign in")}
          subtitle={channel.subtitle ?? t("hikari::loginFlow.signInSubtitle", "Welcome back")}
          logoSrc={props.logoSrc}
          loading={props.loading}
          passwordField={channel.passwordField ?? false}
          usernameType={channel.usernameType ?? "text"}
          usernamePlaceholder={channel.usernamePlaceholder}
          usernameAutocomplete={channel.usernameAutocomplete}
          submitLabel={channel.submitLabel}
          initialUsername={props.initialUsername}
          onSubmit={(username: string, password: string) =>
            emit("account-submit", channel.key, username, password)
          }
        >
          {{
            // top is the channel-tabs slot: rendered OUTSIDE the card's
            // <form> so segment clicks never trigger a submit.
            top: () => tabsEl(),
            usernameIcon: () => slots.usernameIcon?.({ channel: channel.key }),
            ...(methods.length > 0
              ? {
                  methods: () => (
                    <HkAuthMethodList
                      divider={channel.methodsDivider}
                      methods={methods}
                      onSelect={(key: string) => emit("method-select", channel.key, key)}
                    />
                  ),
                }
              : {}),
            footer: () => slots.footer?.({ channel: channel.key }),
          }}
        </HkSignInCard>
      );
    }

    function renderSsoCard(channel: HkLoginSsoChannel) {
      return (
        <HkAuthCard
          key={channel.key}
          title={channel.title ?? channelLabel(channel)}
          subtitle={channel.subtitle}
        >
          {{
            logo: () =>
              props.logoSrc ? (
                <img
                  class="hk-logo-img"
                  src={props.logoSrc}
                  alt=""
                  style={{ width: "3.5rem", height: "3.5rem" }}
                />
              ) : null,
            default: () => (
              <>
                {tabsEl()}
                <div class="hk-login-flow-sso">
                  <HkAuthSsoButton
                    label={channel.buttonLabel ?? channelLabel(channel)}
                    icon={channel.icon}
                    disabled={channel.disabled}
                    onClick={() => emit("sso-click", channel.key)}
                  />
                </div>
              </>
            ),
          }}
        </HkAuthCard>
      );
    }

    return () => {
      const channel = currentChannel.value;
      if (!channel) return null;

      return (
        <div class="hk-login-flow">
          {slots.top?.()}
          <HkTransitionContainer
            swapKey={props.step === "verify" ? "verify" : channel.key}
            axis="height"
          >
            <HkStepFlow
              steps={[
                { key: "account", label: "account" },
                { key: "verify", label: "verify" },
              ]}
              modelValue={
                props.step === "verify" &&
                channel.mode === "credentials"
                  ? "verify"
                  : "account"
              }
              hideTimeline
            >
              {{
                account: () =>
                  channel.mode === "credentials"
                    ? renderCredentialsCard(channel)
                    : renderSsoCard(channel),
                verify: () => (
                  <HkMfaVerifyCard
                    ref={mfaRef}
                    factors={props.verifyFactors}
                    proven={props.verifyProven}
                    accountName={props.verifyAccountName}
                    logoSrc={props.logoSrc}
                    loading={props.verifyLoading}
                    resending={props.verifyResending}
                    passkeyRetryHint={props.passkeyRetryHint}
                    autofocus
                    onVerify={(kind: string, proof: string) => emit("verify", kind, proof)}
                    onResend={() => emit("verify-resend")}
                    onBack={() => emit("verify-back")}
                  />
                ),
              }}
            </HkStepFlow>
          </HkTransitionContainer>
          {slots.below?.()}
        </div>
      );
    };
  },
});

export default HkLoginFlow;
