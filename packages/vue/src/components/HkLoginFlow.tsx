import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useAnchoredTop } from "../composables/useAnchoredTop";
import { useI18n } from "../i18n/context";
import { asPropType } from "../utils/typing";
import { HkAuthChannelList, type HkAuthChannelListEntry } from "./HkAuthChannelList";
import {
  HkMfaVerifyCard,
  hkMfaVerifySubtitle,
  hkMfaVerifyTitle,
  type HkMfaFactor,
} from "./HkMfaVerifyCard";
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
  /** Extra guard over the channel's WHOLE credentials body: the fields
   *  and the submit stay disabled while the host's own gate is closed
   *  (erp's register body: the anti-abuse challenge is still being
   *  solved). Default false — the built-in empty-field check is then the
   *  only guard. Per channel on purpose: one body may be gated while
   *  the other is always submittable. */
  disabled?: boolean;
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
 * visual — ONE stable card (logo, header copy, the pill segment group
 * hidden when a deployment offers a single channel; a lone dead segment
 * reads as a broken switch) whose body crossfades and height-morphs, and
 * whose account→verify move is the same in-card swap — while staying a
 * CONTROLLED component: no endpoint, no URL building, no factor ladder
 * policy. Each host (the chest migration plus the erp and arona login
 * surfaces) keeps its own auth client and drives the panel through
 * props/events:
 *
 * - `v-model` (channel key) + `channels` — the segment group.
 * - `step` — `'account' | 'verify'`; the host flips it when its ladder
 *   answers with factors, and the SAME card swaps its header copy and
 *   body over to the step-up (which never renders on an sso channel: a
 *   redirect flow has no second step by construction — passing
 *   `step="verify"` with an sso channel renders the account body as a
 *   fail-safe).
 * - `account-submit(channel, username, password)` — credentials
 *   channel submitted (password is empty while `passwordField` is off).
 * - `method-select(channel, key)` — an alternative method row was picked.
 * - `sso-click(channel)` — the primary sso row was picked.
 * - `verify(kind, proof)` / `verify-resend` / `verify-back` — the MFA
 *   body's events, re-emitted one level up.
 * - `verifyMethods` — alternative sign-in rows on the verify step (the
 *   third-party providers the account can still sign in through);
 *   `verify-method-select(key)` re-emits a picked row.
 *
 * Card grammar (2026-11-24 user direction, the reason this file looks
 * the way it does): *"where the content can change inside the card, do
 * not let the whole card fly."* The panel is therefore ONE card frame
 * (`.s-auth-card`) for the whole session:
 *
 * - the frame, its padding and its mount animation belong to the panel,
 *   not to a step: the frame node is static, so neither a step nor a
 *   channel swap remounts it (a fresh `.s-auth-card` per step replayed
 *   the frame's own entrance keyframes and handed the user a second
 *   "card appears" animation mid-flow);
 * - the STEP swap crossfades the card's own contents (header copy + body)
 *   inside that frame, keyed on the step: the account generation carries
 *   the channel tabs over the sign-in body, the verify generation carries
 *   the step-up body (`HkMfaVerifyCard bare`);
 * - the CHANNEL swap is a second, NESTED container below the segment
 *   group — a channel switch crossfades only the body and leaves the
 *   tabs and the header copy mounted (the 2026-11-24 stable-shell
 *   direction, unchanged);
 * - the card's TOP edge is pinned while it grows (`useAnchoredTop`):
 *   a height morph inside a vertically centered host re-centers the box,
 *   which moves the top edge AND the content anchored to it — the
 *   literal "the card flies up" in the report. The hook is closed-loop,
 *   so a top-anchored host measures zero drift and nothing is written.
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
 * credentials body remounts when the user navigates back, so the typed
 * name must travel through a prop rather than die with the body).
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
    /** Flow step: `account` (the channel bodies) or `verify` (the
     *  step-up body). Controlled by the host's ladder state. */
    step: { type: String as PropType<"account" | "verify">, default: "account" },
    /** In-flight state of the credentials submit. */
    loading: { type: Boolean, default: false },
    /** Logo image URL forwarded to the card header. */
    logoSrc: { type: String, default: undefined },
    /** The card's header title on the ACCOUNT step — one stable header
     *  across every channel (2026-11-22 user direction: a channel switch
     *  must morph only the content below the tabs, never dissolve the
     *  card). Falls back to the ACTIVE channel's `title` (then the
     *  conventional sign-in copy) for hosts that still brand per channel;
     *  distinct per-channel fallbacks then swap as instant text, so
     *  multi-channel hosts should pass this once. The VERIFY step derives
     *  its own header copy from the step-up vocabulary
     *  (`hkMfaVerifyTitle` / `hkMfaVerifySubtitle`) — a sign-in title
     *  frozen over a step-up body reads as a stuck page. */
    title: { type: String, default: undefined },
    /** The card's header subtitle — same stability contract as `title`. */
    subtitle: { type: String, default: undefined },
    /** The VERIFY step's header title override. Undefined (the default)
     *  takes the step-up vocabulary through `hkMfaVerifyTitle`, i.e. what
     *  the standalone step-up card has always said — the flow does NOT
     *  reuse `title` here (a sign-in title frozen over a step-up body
     *  reads as a stuck page), but a host that brands its panel must be
     *  able to brand BOTH steps, or the header contradicts the marketing
     *  copy on the second one. */
    verifyTitle: { type: String, default: undefined },
    /** The verify step's header subtitle override (see `verifyTitle`);
     *  the `{name}` / `{proven}` interpolation still applies. */
    verifySubtitle: { type: String, default: undefined },
    /** Seed for the credentials body's username field — survives the
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
    /** Alternative sign-in rows on the verify step: the third-party
     *  providers the account can still sign in through (a linked OAuth
     *  identity). A row is not a factor — see HkMfaVerifyCard.methods.
     *  Rendered only when non-empty. */
    verifyMethods: {
      type: Array as PropType<readonly HkAuthChannelListEntry[]>,
      default: () => [],
    },
    /** Divider text above the verify step's rows; consumer-localized. */
    verifyMethodsDivider: { type: String, default: undefined },
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
    /** A third-party sign-in row was picked on the verify step — the
     *  provider's key, as `method-select` carries on the account step. */
    "verify-method-select": (_key: string) => true,
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

    /** The card frame's anchored box (see useAnchoredTop): the step and
     *  channel swaps grow/shrink the card, and in a centered host that
     *  reflows the frame — pinning the top edge is what keeps the panel
     *  still while it grows downward. */
    const anchorRef = ref<HTMLElement | null>(null);
    useAnchoredTop(anchorRef);

    const currentChannel = computed(
      () =>
        props.channels.find((channel) => channel.key === props.modelValue) ??
        props.channels[0],
    );

    // Anti-strobe on EVERY swap (the chest round-22 field report
    // HkStepFlow's dropFlowFocus used to cover): a field still focused
    // inside the LEAVING generation re-anchors the Android autofill panel
    // on every layout beat of the morph — and HkCrossfade marks the
    // leaving item `inert`, so a control that survives into the dissolve
    // is blurred by the browser only when that attribute lands, i.e. one
    // beat into the motion. Both triggers blur EARLY, before the patch
    // (a pre-flush watch), with scopes that keep the channel rule's
    // accessibility promise:
    //
    // - CHANNEL swap: only `.hk-login-flow-body` (the swapped body) — the
    //   tab buttons live outside it and the activated tab must keep focus
    //   (keyboard a11y).
    // - STEP swap: the WHOLE panel. Everything on stage takes part in the
    //   dissolve (tabs included — the verify generation has none), so no
    //   control may stay focused inside the leaving item. The entering
    //   step-up body claims the caret itself (autofocus).
    //
    // MUT:step-swap-no-blur (dropping the step watch leaves the username
    // field focused through the inert window — the account→verify focus
    // pin goes red). MUT:channel-blur-scope-fold (widening the channel
    // watch to the whole flow blurs the activated tab and its pin goes
    // red).
    function blurFocusIn(scope: string): void {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(scope)) {
        active.blur();
      }
    }
    watch(() => props.step, () => blurFocusIn(".hk-login-flow"));
    watch(() => currentChannel.value?.key, () => blurFocusIn(".hk-login-flow-body"));

    /** Segment label precedence: explicit label > the conventional-key
     *  locale > the raw key. The conventional keys cover every Celestia
     *  deployment today, so most hosts pass no labels at all. */
    function channelLabel(channel: HkLoginChannel): string {
      if (channel.label) return channel.label;
      if (channel.key === "cloud") return t("hikari::loginFlow.channelCloud", "Celestia Cloud");
      if (channel.key === "org") return t("hikari::loginFlow.channelOrg", "Organization login");
      return channel.key;
    }

    /** Consumer handles: forwarded from the inner MFA body. `clearProof`
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

    /** The card's header block. Rendered by the flow rather than by
     *  HkAuthCard because it lives INSIDE the step swap (the verify step
     *  renames the panel: "Sign in" → "Verify account") while the frame
     *  around it must not remount. Class names are HkAuthCard's, so the
     *  header geometry is the shared one — no host can tell the
     *  difference, and the panel's own bare bodies keep the same lanes. */
    function headerEl(title: string, subtitle: string) {
      return (
        <div class="s-auth-header">
          {props.logoSrc ? (
            <img
              class="hk-logo-img"
              src={props.logoSrc}
              alt=""
              style={{ width: "3.5rem", height: "3.5rem" }}
            />
          ) : null}
          <h1 class="s-auth-title">{title}</h1>
          {subtitle ? <p class="s-auth-subtitle">{subtitle}</p> : null}
        </div>
      );
    }

    function renderCredentialsBody(channel: HkLoginCredentialsChannel) {
      const methods = channel.methods ?? [];
      return (
        <HkSignInCard
          key={channel.key}
          bare
          loading={props.loading}
          disabled={channel.disabled ?? false}
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

      // The header copy: flow-level copy wins on the account step;
      // per-channel fallbacks keep single-channel hosts working
      // unchanged. The verify step derives the step-up vocabulary.
      const accountTitle = props.title ?? channel.title ?? (channel.mode === "credentials"
        ? t("hikari::loginFlow.signInTitle", "Sign in")
        : channelLabel(channel));
      const accountSubtitle = props.subtitle ?? channel.subtitle ?? (channel.mode === "credentials"
        ? t("hikari::loginFlow.signInSubtitle", "Welcome back")
        : "");

      // The fail-safe of the old design, kept: verify only ever renders
      // for a credentials channel (a redirect flow has no second step).
      const verifying = props.step === "verify" && channel.mode === "credentials";

      return (
        <div class="hk-login-flow">
          {slots.top?.()}
          {/* The anchored box: the card grows DOWNWARD from here, and the
           * hook paints it back onto this top whenever a centered host
           * re-centers the taller frame (see useAnchoredTop). Wrapping
           * the FRAME (rather than the panel root) keeps a notice
           * appearing above the card from dragging the card with it:
           * the notice takes its own row above this box. */}
          <div class="hk-login-flow-anchor" ref={anchorRef}>
            {/* ONE card frame for the whole session: the step swap below
             * is a swap of this frame's CONTENTS. .s-auth-card also
             * carries the panel's mount entrance, which therefore plays
             * once per page instead of once per step. */}
            <div class="s-auth-card hk-login-flow-card">
              {/* OUTER tier — keyed on the STEP: the account generation
               * (header + segment group + the nested channel body) or the
               * verify generation (header + step-up body). One fade +
               * height morph, inside the still frame. */}
              <HkTransitionContainer
                swapKey={verifying ? "verify" : "account"}
                axis="height"
              >
                {verifying ? (
                  <div key="verify" class="hk-login-flow-step">
                    {headerEl(
                      hkMfaVerifyTitle(t, {
                        title: props.verifyTitle,
                        proven: props.verifyProven,
                      }),
                      hkMfaVerifySubtitle(t, {
                        subtitle: props.verifySubtitle,
                        proven: props.verifyProven,
                        accountName: props.verifyAccountName,
                      }),
                    )}
                    {/* `hk-login-flow-body` marks the SWAPPED body of a
                     *  generation (see the anti-strobe watch): the verify
                     *  generation's body block is its form block, the
                     *  account generation's is the inner channel
                     *  container. No tabs render in this generation, so
                     *  scoping here can never capture a tab trigger. */}
                    <div class="s-auth-form hk-login-flow-body">
                      <HkMfaVerifyCard
                        ref={mfaRef}
                        bare
                        factors={props.verifyFactors}
                        proven={props.verifyProven}
                        accountName={props.verifyAccountName}
                        loading={props.verifyLoading}
                        resending={props.verifyResending}
                        passkeyRetryHint={props.passkeyRetryHint}
                        methods={props.verifyMethods}
                        methodsDivider={props.verifyMethodsDivider}
                        autofocus
                        onVerify={(kind: HkMfaFactor, proof: string) => emit("verify", kind, proof)}
                        onResend={() => emit("verify-resend")}
                        onBack={() => emit("verify-back")}
                        onMethod-select={(key: string) => emit("verify-method-select", key)}
                      />
                    </div>
                  </div>
                ) : (
                  <div key="account" class="hk-login-flow-step">
                    {headerEl(accountTitle, accountSubtitle)}
                    <div class="s-auth-form">
                      {/* The segment group rides ABOVE the swapped body —
                       * stable across channel switches. */}
                      {tabsEl()}
                      {/* INNER tier — keyed on the CHANNEL: a channel
                       * switch crossfades only this body; the frame, the
                       * header and the tabs never dissolve. */}
                      <HkTransitionContainer
                        // The class lands on the container's root Tag
                        // because HkTransitionContainer does not set
                        // inheritAttrs:false — an implicit contract the
                        // blur scope above and its pin depend on: adding
                        // that flag there silently breaks both.
                        class="hk-login-flow-body"
                        swapKey={channel.key}
                        axis="height"
                      >
                        {channel.mode === "credentials"
                          ? renderCredentialsBody(channel)
                          : renderSsoBody(channel)}
                      </HkTransitionContainer>
                    </div>
                  </div>
                )}
              </HkTransitionContainer>
            </div>
          </div>
          {slots.below?.()}
        </div>
      );
    };
  },
});

export default HkLoginFlow;
