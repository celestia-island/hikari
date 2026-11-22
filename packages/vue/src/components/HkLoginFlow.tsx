import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { asPropType } from "../utils/typing";
import { HkAuthCard } from "./HkAuthCard";
import { HkAuthChannelList, type HkAuthChannelListEntry } from "./HkAuthChannelList";
import { HkMfaVerifyCard, type HkMfaFactor } from "./HkMfaVerifyCard";
import { HkSignInCard } from "./HkSignInCard";
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
  /** Per-channel seed override for the username field. The flow-level
   *  `initialUsername` exists for the account→verify→back round-trip of
   *  ONE channel; a channel that never collects that value (the org
   *  email funnel) overrides with "" so the OTHER channel's account
   *  name never leaks into its field (chest R4 seam finding). */
  initialUsername?: string;
  /** Classic two-field card. Defaults to FALSE — account-first is the
   *  family-wide posture since the MFA redesign: the password is proven
   *  on the verify step as one factor among the announced ones, so the
   *  opening card must not ask for it (2026-11 user direction). */
  passwordField?: boolean;
  submitLabel?: string;
  /** Alternative sign-in rows under the form (rendered only when
   *  non-empty; an empty list omits the whole methods block instead of
   *  padding a dead strip). */
  methods?: HkAuthChannelListEntry[];
  /** Divider text above the rows; consumer-localized on purpose. */
  methodsDivider?: string;
}

/** A channel whose whole sign-in is one redirect (a.celestia.world's
 * "Celestia" row jumping to the central login, an org channel that
 * only offers Feishu): the card renders the standard channel list —
 * one full-width row naming the destination — and `sso-click` sends
 * the host off to build its OAuth URL. */
export interface HkLoginSsoChannel {
  key: string;
  mode: "sso";
  label?: string;
  title?: string;
  subtitle?: string;
  /** Provider mark for the row (brand SVG, <img>, …). Loose-typed like
   *  every auth icon: hosts materialize hikari against their own vue. */
  icon: unknown;
  /** The row's label (accessible name + visible text); defaults to the
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
 * visual — ONE stable shell card (logo, header, the pill segment group
 * hidden when a deployment offers a single channel; a lone dead segment
 * reads as a broken switch) whose body below the tabs crossfades and
 * height-morphs per channel through `HkTransitionContainer`, with the
 * account→verify step as the same fade+height morph between the shell
 * and the MFA card — while staying a CONTROLLED
 * component: no endpoint, no URL building, no factor ladder policy.
 * Each host (the chest migration plus the erp and arona login surfaces,
 * landing as their own PRs) keeps its own auth client and drives the
 * panel through props/events:
 *
 * - `v-model` (channel key) + `channels` — the segment group.
 * - `step` — `'account' | 'verify'`; the host flips it when its ladder
 *   answers with factors, and the panel slides to `HkMfaVerifyCard`
 *   (which never renders on an sso channel: a redirect flow has no
 *   second step by construction — passing `step="verify"` with an sso
 *   channel renders the account card as a fail-safe).
 * - `account-submit(channel, username, password)` — credentials
 *   channel submitted (password is empty while `passwordField` is off).
 * - `method-select(channel, key)` — an alternative method row was picked.
 * - `sso-click(channel)` — the primary sso row was picked.
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
    /** Logo image URL forwarded to the shell card's header. */
    logoSrc: { type: String, default: undefined },
    /** The SHELL card's header title — one stable header across every
     *  channel (2026-11-24 user direction: a channel switch must morph
     *  only the content below the tabs, never dissolve the card). Falls
     *  back to the ACTIVE channel's `title` (then the conventional
     *  sign-in copy) for hosts that still brand per channel; distinct
     *  per-channel fallbacks then swap as instant text, so multi-channel
     *  hosts should pass this once. */
    title: { type: String, default: undefined },
    /** The SHELL card's subtitle — same stability contract as `title`. */
    subtitle: { type: String, default: undefined },
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
    // `verify` carries HkMfaFactor (not a bare string): consumers bind
    // factor-typed handlers (`onVerify={(kind: MfaFactor, …)}`), and a
    // wider `string` param fails TS2322 under strictFunctionTypes —
    // the exact seam break R4 caught against chest's migration.
    verify: (_kind: HkMfaFactor, _proof: string) => true,
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

    // Anti-strobe on the channel swap (the chest round-22 field report
    // HkStepFlow's dropFlowFocus used to cover): a field still focused
    // INSIDE the leaving body re-anchors the Android autofill panel on
    // every layout beat of the morph. The tab buttons are deliberately
    // OUTSIDE the blur scope — the activated tab must keep focus
    // (keyboard a11y).
    watch(() => currentChannel.value?.key, () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.closest(".hk-login-flow-body")
      ) {
        active.blur();
      }
    });

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

    function renderCredentialsBody(channel: HkLoginCredentialsChannel) {
      const methods = channel.methods ?? [];
      return (
        <HkSignInCard
          key={channel.key}
          bare
          loading={props.loading}
          passwordField={channel.passwordField ?? false}
          usernameType={channel.usernameType ?? "text"}
          usernamePlaceholder={channel.usernamePlaceholder}
          usernameAutocomplete={channel.usernameAutocomplete}
          submitLabel={channel.submitLabel}
          initialUsername={channel.initialUsername ?? props.initialUsername}
          onSubmit={(username: string, password: string) =>
            emit("account-submit", channel.key, username, password)
          }
        >
          {{
            // Forward the icon slot ONLY when the host passed one — an
            // unconditional lambda would shadow HkSignInCard's own
            // <User> fallback and leave the field icon-less (the same
            // dead-slot rule as methods/footer).
            ...(slots.usernameIcon
              ? { usernameIcon: () => slots.usernameIcon?.({ channel: channel.key }) }
              : {}),
            ...(methods.length > 0
              ? {
                  methods: () => (
                    <HkAuthChannelList
                      divider={channel.methodsDivider}
                      methods={methods}
                      onSelect={(key: string) => emit("method-select", channel.key, key)}
                    />
                  ),
                }
              : {}),
            // The footer wrapper must not exist when no footer was
            // passed (HkAuthCard's dead-space rule; the bare fragment
            // renders the wrapper itself whenever the slot is present).
            ...(slots.footer
              ? { footer: () => slots.footer?.({ channel: channel.key }) }
              : {}),
          }}
        </HkSignInCard>
      );
    }

    function renderSsoBody(channel: HkLoginSsoChannel) {
      return (
        <div key={channel.key} class="hk-login-flow-sso">
          <HkAuthChannelList
            methods={[
              {
                key: channel.key,
                label: channel.buttonLabel ?? channelLabel(channel),
                icon: channel.icon,
                disabled: channel.disabled,
              },
            ]}
            onSelect={() => emit("sso-click", channel.key)}
          />
        </div>
      );
    }

    return () => {
      const channel = currentChannel.value;
      if (!channel) return null;

      // The stable shell header: flow-level copy wins; per-channel
      // fallbacks keep single-channel hosts working unchanged.
      const shellTitle = props.title ?? channel.title ?? (channel.mode === "credentials"
        ? t("hikari::loginFlow.signInTitle", "Sign in")
        : channelLabel(channel));
      const shellSubtitle = props.subtitle ?? channel.subtitle ?? (channel.mode === "credentials"
        ? t("hikari::loginFlow.signInSubtitle", "Welcome back")
        : "");

      // The fail-safe of the old design, kept: verify only ever renders
      // for a credentials channel (a redirect flow has no second step).
      const verifying = props.step === "verify" && channel.mode === "credentials";

      return (
        <div class="hk-login-flow">
          {slots.top?.()}
          {/* Two transition tiers (2026-11-24 user direction — "switching
           * the top segment group only crossfades the content below it
           * and morphs the height; use the library's existing component,
           * do not destroy the whole card"):
           *
           * - the OUTER container is keyed on the STEP ("account" vs
           *   "verify"): the account generation is ONE stable shell card
           *   (logo + header + segment group), the verify generation is
           *   the MFA card — a step move morphs between the two cards.
           * - the INNER container is keyed on the CHANNEL and lives in
           *   the shell's body BELOW the segment group: a channel switch
           *   crossfades only the credentials form / the sso row list
           *   and morphs the height — the shell, its header and the tabs
           *   are NOT inside the swapped region and never dissolve.
           *
           * The shell card opts out of its own smooth-height wrapper:
           * inside this flow the inner container owns the height
           * choreography, and a second measuring wrapper would chain its
           * 300ms transition after the container's (a telescoping
           * double-morph). */}
          <HkTransitionContainer swapKey={verifying ? "verify" : "account"} axis="height">
            {verifying ? (
              <HkMfaVerifyCard
                key="verify"
                ref={mfaRef}
                factors={props.verifyFactors}
                proven={props.verifyProven}
                accountName={props.verifyAccountName}
                logoSrc={props.logoSrc}
                loading={props.verifyLoading}
                resending={props.verifyResending}
                passkeyRetryHint={props.passkeyRetryHint}
                autofocus
                onVerify={(kind: HkMfaFactor, proof: string) => emit("verify", kind, proof)}
                onResend={() => emit("verify-resend")}
                onBack={() => emit("verify-back")}
              />
            ) : (
              <HkAuthCard key="account" title={shellTitle} subtitle={shellSubtitle} smoothHeight={false}>
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
                      {/* The segment group rides ABOVE the swapped body —
                        * stable across channel switches. */}
                      {tabsEl()}
                      <HkTransitionContainer
                        class="hk-login-flow-body"
                        swapKey={channel.key}
                        axis="height"
                      >
                        {channel.mode === "credentials"
                          ? renderCredentialsBody(channel)
                          : renderSsoBody(channel)}
                      </HkTransitionContainer>
                    </>
                  ),
                }}
              </HkAuthCard>
            )}
          </HkTransitionContainer>
          {slots.below?.()}
        </div>
      );
    };
  },
});

export default HkLoginFlow;
