import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";
import { Asterisk, Fingerprint, KeyRound, MessageSquareText } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { HkAuthCard } from "./HkAuthCard";
import HkAlert from "./HkAlert";
import HkAuthSubmitButton from "./HkAuthSubmitButton";
import HkButton from "./HkButton";
import HkIconButtonGroup, { type HkIconButtonGroupOption } from "./HkIconButtonGroup";
import HkInput from "./HkInput";
import { HkOtpInput } from "./HkOtpInput";
import HkLogo from "./HkLogo";

import "./HkMfaVerifyCard.scss";

/** Every second-factor kind this card can drive. The first three are the
 *  classic second factors a backend announces after the primary login;
 *  `password` joins the list in account-first flows, where the password is
 *  proven on the verify step as one factor among the announced ones. */
export const MFA_FACTOR_KINDS = ["passkey", "totp", "sms", "password"] as const;

/** One announced second factor. */
export type HkMfaFactor = (typeof MFA_FACTOR_KINDS)[number];

/** Type-guard a raw announced kind (server payloads speak plain strings). */
export function hkIsMfaFactor(kind: string): kind is HkMfaFactor {
  return (MFA_FACTOR_KINDS as readonly string[]).includes(kind);
}

/** The factor a freshly opened verify panel starts on. Passkey leads the
 *  ladder (phishing-resistant, one tap); the code entries follow for
 *  accounts without one. `password` is deliberately NOT in the ladder —
 *  it is the fallback choice, never the highlighted default when a
 *  stronger factor exists. Returns null when nothing verifiable remains
 *  (an empty list, or everything already proven). */
export function hkPreferredMfaFactor(factors: readonly string[]): HkMfaFactor | null {
  const announced = factors.filter(hkIsMfaFactor);
  const ladder: readonly HkMfaFactor[] = ["passkey", "totp", "sms"];
  return ladder.find((kind) => announced.includes(kind))
    ?? (announced.includes("password") ? "password" : null);
}

/** Fill a locale string's `{token}` placeholders. hikari's `t()` is a flat
 *  lookup by design, so messages carrying a name (the account being
 *  verified, the already-proven factor) interpolate here. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** The i18n lookup this module's copy helpers need (structurally what
 *  `useI18n().t` returns, so a host shell can borrow it without owning
 *  this component's setup). */
export type HkMfaTranslate = (key: string, fallback?: string) => string;

/** Locale label of one factor. Exported with the copy helpers so a host
 *  shell that renders the verify HEADER itself (the bare mode below, used
 *  by HkLoginFlow's in-card step swap) names the already-proven factor
 *  with the exact same wording the card's own picker tooltip uses. */
export function hkMfaFactorLabel(t: HkMfaTranslate, kind: HkMfaFactor): string {
  if (kind === "passkey") return t("hikari::mfaVerify.factorPasskey", "Passkey");
  if (kind === "totp") return t("hikari::mfaVerify.factorTotp", "TOTP authenticator app");
  if (kind === "password") return t("hikari::mfaVerify.factorPassword", "Account password");
  return t("hikari::mfaVerify.factorSms", "SMS code");
}

/**
 * The verify step's HEADER copy, derived from exactly the inputs the
 * component's own shell derives it from — exported so a host that owns
 * the card frame (bare mode) renders the identical title/subtitle. Two
 * copies of this derivation is how the header and the card body drift
 * apart (the step-two wording changes with `proven`, and the generic
 * subtitle changes with the account name).
 *
 * `title` / `subtitle` overrides win, mirroring the props of the same
 * name; pass `undefined` to take the derived copy.
 */
export function hkMfaVerifyTitle(
  t: HkMfaTranslate,
  options: { title?: string; proven?: string | null } = {},
): string {
  if (options.title !== undefined) return options.title;
  return options.proven
    ? t("hikari::mfaVerify.step2Title", "One more verification")
    : t("hikari::mfaVerify.title", "Verify account");
}

/** The verify step's subtitle (see hkMfaVerifyTitle). */
export function hkMfaVerifySubtitle(
  t: HkMfaTranslate,
  options: { subtitle?: string; proven?: string | null; accountName?: string } = {},
): string {
  const name = options.accountName ?? "";
  const proven = options.proven && hkIsMfaFactor(options.proven)
    ? hkMfaFactorLabel(t, options.proven)
    : null;
  // A host override wins over the derived sentence, but the placeholders
  // still interpolate: a host that passes its own wording is usually
  // keeping the account name in it, and a literal `{name}` on screen is
  // exactly the kind of silent difference this helper exists to remove.
  if (options.subtitle !== undefined) {
    return fill(options.subtitle, { name, proven: proven ?? "" });
  }
  if (proven) {
    return name
      ? fill(t("hikari::mfaVerify.step2Subtitle",
        "{proven} passed — choose one more method to finish signing in to {name}"),
        { proven, name })
      : fill(t("hikari::mfaVerify.step2SubtitleGeneric",
        "Verified via {proven} — choose one more method to finish signing in"),
        { proven });
  }
  return name
    ? fill(t("hikari::mfaVerify.verifySubtitle",
      "Verifying {name} — complete a sign-in method to continue"), { name })
    : t("hikari::mfaVerify.subtitle", "This account requires an extra verification step");
}

/**
 * HkMfaVerifyCard — the shared second-factor ("verify account", step-up)
 * card for every Celestia front end: the factor picker (slider icon
 * group) over the per-factor proof field, submit, and the secondary
 * actions, inside the HkAuthCard shell.
 *
 * Control contract (same split as HkSignInCard): the card owns ALL local
 * input state — the selected factor, the code cells, the password entry —
 * and never talks to a backend. The consumer injects
 * `onVerify(kind, proof)` and feeds the in-flight state back through
 * `loading`; a passkey proof arrives as `kind="passkey"` with an empty
 * string (the WebAuthn ceremony itself is the proof, and stays
 * consumer-side where the authenticator policy lives). After a rejected
 * proof the consumer calls `clearProof()` through the component ref so
 * the next attempt starts from an empty field.
 *
 * Two-proof flows (an account that must present TWO DISTINCT factors)
 * pass `proven`: the proven kind's picker entry wears the success marker,
 * cannot be re-selected, and the default title/subtitle switch to the
 * "one more verification" wording. The card re-selects and clears its
 * fields whenever the announced set or the proven factor changes.
 *
 * i18n: every visible string defaults to the `hikari::mfaVerify.*` locales
 * (11 languages ship with the card); `title` / `subtitle` overrides win
 * when a host needs its own wording. `{name}` / `{proven}` placeholders in
 * the derived subtitle are filled here.
 *
 * ```tsx
 * <HMfaVerifyCard
 *   factors={step.factors}
 *   proven={proven.value}
 *   account-name="demierge"
 *   logo-src={logo}
 *   loading={verifying.value}
 *   onVerify={(kind, proof) => completeStepUp(kind, proof)}
 *   onBack={() => (step.value = null)}
 * />
 * ```
 */
export const HkMfaVerifyCard = defineComponent({
  name: "HkMfaVerifyCard",
  props: {
    /** The factor kinds this account announced, server order. Raw
     *  strings are welcome — unknown kinds are filtered, and an emptied
     *  list renders a picker-less card rather than a dead one. */
    factors: { type: Array as PropType<readonly string[]>, default: () => [] },
    /** The kind already proven in a two-proof flow: pinned with the
     *  success marker, un-selectable, excluded from the default pick. */
    proven: { type: String, default: undefined },
    /** The account being verified — drives the "verifying {name}"
     *  subtitle. Empty falls back to the generic subtitle. */
    accountName: { type: String, default: "" },
    /** Title override; defaults to the verify / step-two locale. */
    title: { type: String, default: undefined },
    /** Subtitle override; defaults to the account-aware derivation. */
    subtitle: { type: String, default: undefined },
    /** Optional logo image URL for the card header. */
    logoSrc: { type: String, default: undefined },
    /** External in-flight state; disables every control while true. */
    loading: { type: Boolean, default: false },
    /** Extra guard on top of the built-in in-flight checks. */
    disabled: { type: Boolean, default: false },
    /** In-flight state of the SMS resend; swaps the resend label. */
    resending: { type: Boolean, default: false },
    /** Advisory text under the passkey submit (a failed scoped ceremony
     *  nudging toward the picker's other entries). Rendered only when
     *  set — the consumer owns the failure bookkeeping that decides it. */
    passkeyRetryHint: { type: String, default: undefined },
    /** Focus the factor ON STAGE when the card mounts (the verify step
     *  just opened) and whenever the selected factor changes: the proof
     *  field for `totp` / `sms` (HkOtpInput owns that one) / `password`,
     *  or the passkey action for a factor with no field at all. A card
     *  that only focused its text fields left the caret on `<body>` for a
     *  passkey-only account — and a host swapping this card in for
     *  another body (HkLoginFlow's step swap) then had nowhere to hand
     *  focus to. */
    autofocus: { type: Boolean, default: false },
    /** Render ONLY the step-up body — the factor picker, the proof field,
     *  the submit and the back action, with NO HkAuthCard shell (no card
     *  frame, no header): for a host that owns a stable card and swaps
     *  this body inside it. HkLoginFlow is the consumer that needs it —
     *  its account→verify move is a swap INSIDE one card (2026-11-24 user
     *  direction: "where the content can change inside the card, do not
     *  let the whole card fly"), so the header copy comes from the host
     *  (`hkMfaVerifyTitle` / `hkMfaVerifySubtitle`, the exact derivation
     *  this card's own shell uses) and the frame stays put. The body
     *  renders as a bare fragment so the host's `.s-auth-form` block keeps
     *  owning the column rhythm. Read once at setup (a static shape, like
     *  HkSignInCard's bare / HkAuthCard's smoothHeight): toggle it by
     *  remounting, not by flipping a ref. */
    bare: { type: Boolean, default: false },
  },
  emits: {
    /** The user asks to prove `kind`; `proof` is the password text, the
     *  composed code, or "" for passkey (the ceremony is consumer-side). */
    verify: (_kind: HkMfaFactor, _proof: string) => true,
    /** SMS resend requested (only wired while `sms` is selected). */
    resend: () => true,
    /** Abandon the step-up (back to the credentials card). */
    back: () => true,
  },
  setup(props, { emit, slots, expose }) {
    const { t } = useI18n();

    /** Announced + drivable kinds, server order preserved. */
    const knownFactors = computed(() => props.factors.filter(hkIsMfaFactor));
    /** The proven kind — only if it is one the card can name. */
    const provenKind = computed(() =>
      props.proven && hkIsMfaFactor(props.proven) ? props.proven : null);
    /** The kinds still selectable this visit (two-proof flow skips the
     *  pinned one — it is DONE, not a candidate for the next proof). */
    const selectableFactors = computed(() =>
      knownFactors.value.filter((kind) => kind !== provenKind.value));

    const selected = ref<HkMfaFactor>("totp");
    const code = ref("");
    const password = ref("");

    /** (Re)select the default factor for the current visit state and
     *  clear both proof fields. Runs at mount and whenever the announced
     *  set or the proven factor changes (the two-proof step-two re-arm). */
    function rearm() {
      const list = selectableFactors.value;
      selected.value = hkPreferredMfaFactor(list) ?? list[0] ?? "password";
      code.value = "";
      password.value = "";
      focusStage();
    }

    watch(
      () => `${knownFactors.value.join(",")}|${provenKind.value ?? ""}`,
      () => rearm(),
    );
    rearm();

    // ── proof-field focus ────────────────────────────────────────────
    const passwordRef = ref<{ $el?: HTMLElement } | null>(null);
    /** The passkey action — the only focusable proof entry for a factor
     *  without a text field. */
    const passkeyRef = ref<{ $el?: HTMLElement } | null>(null);
    function focusPassword() {
      void nextTick(() => {
        (passwordRef.value?.$el as HTMLElement | undefined)
          ?.querySelector("input")
          ?.focus();
      });
    }

    /** Focus the factor on stage. `autofocus` covers the whole card, not
     *  just its text fields: a passkey-only account has no input, and
     *  leaving focus on `<body>` after a step swap strands keyboard and
     *  screen-reader users (A2 review finding — the entering generation
     *  must claim the caret whenever the leaving one loses it). */
    function focusStage() {
      if (!props.autofocus) return;
      if (selected.value === "password") {
        focusPassword();
        return;
      }
      if (selected.value === "passkey") {
        void nextTick(() => {
          (passkeyRef.value?.$el as HTMLElement | undefined)
            ?.querySelector("button")
            ?.focus();
        });
        return;
      }
      // totp / sms: HkOtpInput owns its own autofocus (first cell).
    }

    /** Switching factors starts a fresh proof (a half-typed code must
     *  not leak into the SMS entry); the password entry takes focus so a
     *  single-factor password account can type straight away. */
    function onSelect(next: string | string[]) {
      const value = Array.isArray(next) ? next[0] : next;
      if (!hkIsMfaFactor(value) || !selectableFactors.value.includes(value)) return;
      if (value === selected.value) return;
      selected.value = value;
      code.value = "";
      password.value = "";
      focusStage();
    }

    async function attemptVerify(): Promise<void> {
      if (props.loading || props.disabled) return;
      const kind = selected.value;
      // The submit buttons disable themselves on an incomplete proof;
      // this guard keeps the Enter/auto-submit paths honest.
      if (kind === "passkey") {
        emit("verify", "passkey", "");
        return;
      }
      if (kind === "password") {
        if (!password.value) return;
        emit("verify", "password", password.value);
        return;
      }
      if (code.value.trim().length < 6) return;
      emit("verify", kind, code.value.trim());
    }

    /** Consumer handles: `clearProof` empties the active field after a
     *  rejected proof; `focusPassword` re-arms the password entry's
     *  focus; `selectedFactor` reports the factor on stage (a step-two
     *  host needs the kind it just proved when the server does not echo
     *  it back). */
    function clearProof() {
      code.value = "";
      password.value = "";
    }

    expose({
      clearProof,
      focusPassword,
      selectedFactor: () => selected.value,
    });

    // ── derived strings (single source: the exported copy helpers, so a
    // host that renders this step's header cannot drift from the body) ──
    const factorLabel = (kind: HkMfaFactor): string => hkMfaFactorLabel(t, kind);

    const titleText = computed(() =>
      hkMfaVerifyTitle(t, { title: props.title, proven: provenKind.value }));

    const subtitleText = computed(() =>
      hkMfaVerifySubtitle(t, {
        subtitle: props.subtitle,
        proven: provenKind.value,
        accountName: props.accountName,
      }));

    /** Glyph per factor for the icon-only picker — the labels ride the
     *  tooltip. The password entry wears the asterisk, the dot-matrix
     *  sign-in input's own shape. */
    const factorIcon = (kind: HkMfaFactor) => {
      if (kind === "passkey") return <Fingerprint size={22} />;
      if (kind === "totp") return <KeyRound size={22} />;
      if (kind === "password") return <Asterisk size={22} />;
      return <MessageSquareText size={22} />;
    };

    const pickerOptions = computed<HkIconButtonGroupOption[]>(() =>
      knownFactors.value.map((kind) => {
        // Two-proof step two: the proven factor is DONE — it stays in the
        // picker pinned (success marker, disabled, "already verified"
        // tooltip) so the user can see what they already presented, but
        // it is not a candidate for the next proof.
        if (kind === provenKind.value) {
          return {
            key: kind,
            label: factorLabel(kind),
            icon: factorIcon(kind),
            disabled: true,
            marker: "success" as const,
            tooltip: t("hikari::mfaVerify.provenTooltip", "Already verified"),
          };
        }
        return {
          key: kind,
          label: factorLabel(kind),
          icon: factorIcon(kind),
        };
      }));

    // Resolved per render: a runtime locale switch must reach the
    // in-flight labels on the next render, not stay frozen at setup.
    const busyLabel = () => t("hikari::mfaVerify.loading", "Verifying…");

    /** The step-up body every mode shares: the factor picker over the
     *  per-factor proof field, the submit and the secondary actions.
     *  Standalone the card's own `.s-auth-form` owns the column rhythm;
     *  in bare mode these render straight into the HOST's `.s-auth-form`,
     *  which is the same block with the same gap — one body, two shells,
     *  never two bodies. */
    const bodyFragment = () => (
      <>
        {pickerOptions.value.length > 0 && (
          <div class="s-mfa-factors">
            <HkIconButtonGroup
              mode="single"
              variant="slider"
              modelValue={selected.value}
              onUpdate:modelValue={onSelect}
              aria-label={titleText.value}
              options={pickerOptions.value}
            />
          </div>
        )}
        {selected.value === "passkey" ? (
          <>
            {/* Exactly ONE primary action per factor — the passkey
                ceremony IS the step-up, so pairing it with a generic
                code submit drew two equal-weight buttons that ran
                the same handler (user report 2026-09-18). */}
            <HkAuthSubmitButton
              ref={passkeyRef}
              label={props.loading ? busyLabel()
                : t("hikari::mfaVerify.usePasskey", "Verify with Passkey")}
              block
              loading={props.loading}
              disabled={props.loading || props.disabled}
              doSubmit={attemptVerify}
            />
            {props.passkeyRetryHint && (
              <HkAlert
                variant="warning"
                size="sm"
                message={props.passkeyRetryHint}
              />
            )}
          </>
        ) : selected.value === "password" ? (
          <>
            {/* The password factor re-wears the exact sign-in
                input (dot-matrix surface, hold-to-reveal). */}
            <HkInput
              ref={passwordRef}
              variant="password"
              modelValue={password.value}
              onUpdate:modelValue={(v: string) => (password.value = v)}
              name="mfa-verify-password"
              autocomplete="current-password"
              placeholder={t("hikari::mfaVerify.passwordPlaceholder", "Enter your password")}
              disabled={props.loading || props.disabled}
              submitOnEnter={attemptVerify}
            />
            <HkAuthSubmitButton
              label={props.loading ? busyLabel()
                : t("hikari::mfaVerify.verify", "Verify and sign in")}
              block
              loading={props.loading}
              disabled={props.loading || props.disabled || !password.value}
              doSubmit={attemptVerify}
            />
          </>
        ) : (
          <>
            <HkOtpInput
              modelValue={code.value}
              onUpdate:modelValue={(v: string) => (code.value = v)}
              length={6}
              // SMS codes are handed out in the "123 456" shape; the
              // split mirrors what the user is reading off the phone.
              separated={selected.value === "sms"}
              autofocus={props.autofocus}
              ariaLabel={t("hikari::mfaVerify.codeFields", "Verification code")}
              cellAriaLabel={(index: number) =>
                fill(t("hikari::mfaVerify.codeCell", "Digit {index}"), { index: String(index) })}
              hint={selected.value === "totp"
                ? t("hikari::mfaVerify.totpHint", "Enter the 6-digit TOTP code")
                : t("hikari::mfaVerify.smsHint", "Enter the 6-digit SMS code")}
              disabled={props.loading || props.disabled}
              autoSubmit
              submitOnEnter={attemptVerify}
            />
            <HkAuthSubmitButton
              label={props.loading ? busyLabel()
                : t("hikari::mfaVerify.verify", "Verify and sign in")}
              block
              loading={props.loading}
              disabled={props.loading || props.disabled || code.value.trim().length < 6}
              doSubmit={attemptVerify}
            />
          </>
        )}
        {selected.value === "sms" && (
          <HkButton
            variant="ghost"
            size="md"
            block
            disabled={props.resending || props.loading || props.disabled}
            onClick={() => emit("resend")}
          >
            {props.resending ? busyLabel()
              : t("hikari::mfaVerify.resend", "Resend code")}
          </HkButton>
        )}
        <HkButton
          variant="ghost"
          size="md"
          block
          disabled={props.loading}
          onClick={() => emit("back")}
        >
          {t("hikari::mfaVerify.back", "Back to sign in")}
        </HkButton>
      </>
    );

    // Bare mode: the body alone — the host owns the card frame (and any
    // transition choreography around it).
    if (props.bare) {
      return () => bodyFragment();
    }

    return () => (
      <HkAuthCard title={titleText.value} subtitle={subtitleText.value}>
        {{
          logo: () =>
            slots.logo
              ? slots.logo()
              : props.logoSrc
                ? <HkLogo size="lg" src={props.logoSrc} />
                : null,
          default: () => bodyFragment(),
        }}
      </HkAuthCard>
    );
  },
});

export default HkMfaVerifyCard;
