// hi-components/src/auth/mfa_verify_card.rs
// MfaVerifyCard — mirror of the canonical Vue `HkMfaVerifyCard`: the shared
// second-factor ("verify account", step-up) card.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkMfaVerifyCard.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`. That sheet owns exactly
// one rule — the factor-picker wrapper's centering under `.s-auth-form` — and
// the shell/header/form/error vocabulary comes from the shared
// `styles/admin-tokens.scss` (`.s-auth-card-height` / `.s-auth-card` /
// `.s-auth-header` / `.s-auth-form` / `.s-auth-error`, registered for a
// registry-only host by `StyleRegistry::register_vue_chrome`). NO SHELL IS
// RE-IMPLEMENTED where a mirror already exists — exactly the Vue composition:
//   * the card frame/header/form IS the mirrored `AuthCard`
//     (`auth/auth_card.rs`, Vue's `HkAuthCard`),
//   * the primary action IS the mirrored `AuthSubmitButton`
//     (`auth/auth_submit_button.rs`, Vue's `HkAuthSubmitButton`),
//   * the code row IS the mirrored `OtpInput`, the recovery field the mirrored
//     `Input`, the picker the mirrored `IconButtonGroup`, and the secondary
//     actions the mirrored `Button`.
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div.s-auth-card-height                         (AuthCard wrapper)
//     div.s-auth-card
//       div.s-auth-header
//         {logo}                                     (logo slot)
//         h1.s-auth-title                            {title / i18n title}
//         p.s-auth-subtitle                          (when non-empty)
//       div.s-auth-form
//         div.s-mfa-factors                          ← the sheet's own wrapper
//           div.hk-icon-group.hk-icon-group-single.hk-icon-group-slider
//             span.hk-icon-group-slider-thumb
//             span.hk-tooltip-wrapper > button.hk-icon-group-item ×2 (Otp/Recovery)
//         div.s-auth-error [role=alert]              (only while an error shows)
//           span[style="display:contents"] > svg     (the alert glyph)
//           span                                     (the mapped message)
//         ── step = Otp ──
//         div.hk-otp-wrapper > div.hk-otp.hk-otp-md  (the mirrored OtpInput)
//         ── step = Recovery ──
//         div.hk-input-wrapper > …                   (the mirrored Input)
//         div.s-auth-submit > button.hk-btn.hk-btn-primary…   (the submit)
//         button.hk-btn.hk-btn-ghost.hk-btn-md.hk-btn-block   (resend; sms only)
//         button.hk-btn.hk-btn-ghost.hk-btn-md.hk-btn-block   (back)
//
// The step machine is PURE and lives above the component: [`MfaStep`]
// (Otp / Recovery), [`mfa_submit_gate`] (submit door), [`mfa_error_from_code`]
// (server code → [`MfaErrorKind`]) and the resend-countdown helpers. Every
// state bit is a controlled prop, so there is no `use_signal` / `use_state`
// anywhere on the card.
//
// Prop mapping: `step` → [`MfaVerifyCardProps::step`] (Vue: the local
// `selected` ref, promoted to a prop), `code` / `recovery_code` → the active
// proof field (Vue: `code` / `password`), `accountName` → `account_name`,
// `title` / `subtitle` overrides → the same two names, `logoSrc` → the `logo`
// slot (see the deltas), `loading` / `disabled` / `resending` → the same three
// flags, `resendRemaining` → `resend_remaining` (the wave's countdown input),
// `error` / `errorCode` → the two error channels, and the `verify` / `resend`
// / `back` emits → `on_verify` ([`MfaProof`]) / `on_resend` / `on_back`.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * **the factor ladder becomes a two-step machine.** Vue drives
//     passkey/totp/sms/password from the announced server list; this wave's
//     card drives the two CODE-shaped proofs, `MfaStep::Otp` (TOTP *or* SMS —
//     `sms` keeps Vue's arm: separated 3+3 cells, SMS hint, resend row) and
//     `MfaStep::Recovery`. The passkey arm has no portable counterpart (the
//     WebAuthn ceremony is a host-side op) and the password arm is the
//     credential card's own field (`auth/sign_in_card.rs`), so both stay
//     host-side and the picker offers the two steps the card can prove.
//   * **no internal state, no ref handles.** Vue owns `selected` / `code` /
//     `password` and exposes `clearProof()` / `focusPassword()` /
//     `selectedFactor()` through the component ref. A tairitsu 0.5.22
//     component body has no per-instance state (`use_signal` allocates a new
//     Signal per render, `use_state` is one slot shared by every instance), so
//     the host owns the step and both proof fields and clears them through the
//     `code` / `recovery_code` props — the same three bits Vue's ref exposed.
//     `focusPassword` has no analogue (no focus op; the mirrored OtpInput
//     publishes the caret index instead), and `autofocus` is dropped for the
//     same reason.
//   * **`logoSrc` is not mirrored — the `logo` slot is.** `HkLogo` has no Rust
//     mirror in this wave (the same delta `auth/sign_in_card.rs` documents),
//     so a host passes its own logo vnode; Vue's logo slot wins over `logoSrc`
//     there too.
//   * **the error line is the shell's own `.s-auth-error` band**, not
//     `HkAlert` and not `AuthSubmitButton`'s `error` line: Vue's card mounts an
//     `HkAlert` only for the passkey-retry advisory (an arm outside this
//     machine), and the submit mirror's error line belongs to its challenge
//     lifecycle, which this card does not drive. Errors arrive either as host
//     text (`error`, wins) or as a server code (`error_code`) that the pure
//     [`mfa_error_from_code`] maps to a message + its bundle key.
//   * **the countdown is host-driven.** No timer/interval op is available to a
//     state-free component, so the resend cooldown is the controlled
//     `resend_remaining` prop; the card only formats it (`resendIn`) and
//     [`mfa_resend_tick`] is the pure decrement the host applies on its own
//     schedule.
//   * **no `proven` / two-distinct-factor arm.** In the Otp→Recovery machine
//     the recovery code *is* the fallback proof, so Vue's step-two wording,
//     success marker and re-arm-on-`proven` watch have no counterpart.
//   * the picker stays LIVE while `loading` (Vue keeps it live too — only the
//     submit / resend / back actions go dead), and Vue's `separated` follows
//     the announced factor while the mirror follows the `sms` prop.
//   * `AuthCard`'s own documented inert `smoothHeight` delta applies: the
//     `.s-auth-card-height` wrapper renders, but no height is seeded, so a
//     body-height change snaps instead of animating.
//   * i18n: the strings move from Vue's `hikari::mfaVerify.*` namespace to the
//     crate bundle's `components.hk.mfaVerifyCard.*` (same English defaults).

use hikari_icons::MdiIcon;

use crate::auth::auth_card::{AuthCard, AuthCardProps};
use crate::auth::auth_submit_button::{AuthSubmitButton, AuthSubmitButtonProps};
use crate::basic::{
    Button, ButtonSize, ButtonVariant, HkIconButtonGroupOption, IconButtonGroup,
    IconButtonGroupMode, IconButtonGroupVariant, Input, OtpInput,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct MfaVerifyCardComponent;

/// The code length Vue hard-codes on the OtpInput row (`length={6}`).
pub const MFA_OTP_LENGTH: i32 = 6;

/// Vue's submit floor (`code.value.trim().length < 6` blocks the submit), the
/// same figure for both code-shaped proofs.
pub const MFA_CODE_MIN_CHARS: usize = 6;

/// The two proofs this card drives (see the header delta about the Vue factor
/// ladder).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum MfaStep {
    /// The six-cell authenticator/SMS code (`sms` picks the separated shape).
    #[default]
    Otp,
    /// The fallback recovery code, a free-text field.
    Recovery,
}

impl MfaStep {
    /// The picker order (Vue's ladder head first: the primary proof).
    pub const ALL: [MfaStep; 2] = [MfaStep::Otp, MfaStep::Recovery];

    /// The stable identity — the picker key (`data-key`) and the `MfaProof`
    /// tag the host receives.
    pub fn key(self) -> &'static str {
        match self {
            MfaStep::Otp => "otp",
            MfaStep::Recovery => "recovery",
        }
    }

    /// Type-guard a raw key back into the machine (the picker's callback
    /// arrives as a string).
    pub fn from_key(key: &str) -> Option<Self> {
        match key {
            "otp" => Some(MfaStep::Otp),
            "recovery" => Some(MfaStep::Recovery),
            _ => None,
        }
    }

    /// The picker glyph. Delta vs Vue (documented): `lucide-vue-next`'s
    /// `KeyRound` / `FilePenLine` have no packed `MdiIcon` twin — the crate's
    /// set is a deliberately small subset — so the OTP step wears
    /// `ClockOutline` (the time-based code) and the recovery step `FileEdit`
    /// (the printed recovery sheet), the same nearest-glyph call the `Alert`
    /// and `Toast` mirrors document.
    pub fn icon(self) -> MdiIcon {
        match self {
            MfaStep::Otp => MdiIcon::ClockOutline,
            MfaStep::Recovery => MdiIcon::FileEdit,
        }
    }

    /// The picker label (also the per-item tooltip).
    pub fn label(self) -> String {
        match self {
            MfaStep::Otp => {
                hikari_i18n::t("components.hk.mfaVerifyCard.factorOtp", "Verification code")
            }
            MfaStep::Recovery => hikari_i18n::t(
                "components.hk.mfaVerifyCard.factorRecovery",
                "Recovery code",
            ),
        }
    }

    /// The field's message line under the proof input. `sms` only narrows the
    /// OTP arm (Vue: the totp / sms hint split).
    pub fn hint(self, sms: bool) -> String {
        match self {
            MfaStep::Otp if sms => hikari_i18n::t(
                "components.hk.mfaVerifyCard.smsHint",
                "Enter the 6-digit SMS code",
            ),
            MfaStep::Otp => hikari_i18n::t(
                "components.hk.mfaVerifyCard.totpHint",
                "Enter the 6-digit TOTP code",
            ),
            MfaStep::Recovery => hikari_i18n::t(
                "components.hk.mfaVerifyCard.recoveryHint",
                "Enter one of your recovery codes",
            ),
        }
    }

    /// The proof field's `name` attribute (Vue: `name="mfa-verify-password"` on
    /// its non-code arm).
    pub fn input_name(self) -> &'static str {
        match self {
            MfaStep::Otp => "mfa-verify-otp",
            MfaStep::Recovery => "mfa-verify-recovery",
        }
    }

    /// The shortest proof this step accepts — Vue's single
    /// `trim().length < 6` guard, applied per step.
    pub fn min_proof_chars(self) -> usize {
        match self {
            MfaStep::Otp => MFA_OTP_LENGTH as usize,
            MfaStep::Recovery => MFA_CODE_MIN_CHARS,
        }
    }
}

/// What a press on the primary button does (Vue's `attemptVerify` guard as a
/// value, so the door is unit-testable without a renderer).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MfaSubmitGate {
    /// The proof is complete and the card is idle: publish it.
    Ready,
    /// Busy (`loading` / `disabled`, either one blocks like Vue's early
    /// return): publish nothing.
    Busy,
    /// Too short: publish nothing (Vue's `trim().length < 6` block).
    Incomplete,
}

impl MfaSubmitGate {
    /// Whether the gate publishes the proof.
    pub fn is_ready(self) -> bool {
        matches!(self, MfaSubmitGate::Ready)
    }

    /// Whether the gate swallows the press.
    pub fn blocks(self) -> bool {
        !self.is_ready()
    }
}

/// Vue's `code.value.trim()` — the proof as it is handed to the host.
pub fn mfa_proof_text(raw: &str) -> String {
    raw.trim().to_string()
}

/// Vue's `attemptVerify` guard, step-aware: busy first (Vue returns before it
/// looks at the proof), then the length floor.
pub fn mfa_submit_gate(step: MfaStep, proof: &str, loading: bool, disabled: bool) -> MfaSubmitGate {
    if loading || disabled {
        return MfaSubmitGate::Busy;
    }
    if mfa_proof_text(proof).chars().count() < step.min_proof_chars() {
        return MfaSubmitGate::Incomplete;
    }
    MfaSubmitGate::Ready
}

/// One verified proof handed to the host (Vue: `emit("verify", kind, proof)`).
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct MfaProof {
    /// Which proof the user presented.
    pub step: MfaStep,
    /// The trimmed proof text (the code / recovery code).
    pub proof: String,
}

/// The server's rejection codes this card can name. Unknown codes fall back to
/// [`MfaErrorKind::Unknown`] — a verification failure is never silent.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MfaErrorKind {
    /// The code was well-formed but rejected.
    InvalidCode,
    /// The code window closed.
    Expired,
    /// Too many attempts in the window.
    RateLimited,
    /// The account is locked out.
    Locked,
    /// The request never reached the server.
    Network,
    /// Anything the card cannot name.
    Unknown,
}

impl MfaErrorKind {
    /// The bundle key of this message (`components.hk.mfaVerifyCard.*`).
    pub fn message_key(self) -> &'static str {
        match self {
            MfaErrorKind::InvalidCode => "components.hk.mfaVerifyCard.errorInvalidCode",
            MfaErrorKind::Expired => "components.hk.mfaVerifyCard.errorExpired",
            MfaErrorKind::RateLimited => "components.hk.mfaVerifyCard.errorRateLimited",
            MfaErrorKind::Locked => "components.hk.mfaVerifyCard.errorLocked",
            MfaErrorKind::Network => "components.hk.mfaVerifyCard.errorNetwork",
            MfaErrorKind::Unknown => "components.hk.mfaVerifyCard.errorUnknown",
        }
    }

    /// The English default of [`MfaErrorKind::message_key`].
    pub fn fallback(self) -> &'static str {
        match self {
            MfaErrorKind::InvalidCode => "That verification code is not valid",
            MfaErrorKind::Expired => "That code has expired — request a new one",
            MfaErrorKind::RateLimited => "Too many attempts — wait a moment and try again",
            MfaErrorKind::Locked => "This account is temporarily locked",
            MfaErrorKind::Network => "Could not reach the server — check your connection",
            MfaErrorKind::Unknown => "Verification failed — try again",
        }
    }

    /// The resolved message (bundle first, English fallback second).
    pub fn message(self) -> String {
        hikari_i18n::t(self.message_key(), self.fallback())
    }
}

/// Map a server rejection code onto [`MfaErrorKind`]. The comparison is
/// forgiving on purpose: payloads speak `invalid_code`, `invalid-code` and
/// `INVALID_CODE` interchangeably, so the code is trimmed, lower-cased and
/// dash-normalized before the lookup.
pub fn mfa_error_from_code(code: &str) -> MfaErrorKind {
    let normalized = code.trim().to_ascii_lowercase().replace('-', "_");
    match normalized.as_str() {
        "invalid_code" | "code_invalid" | "mfa_invalid_code" | "invalid" => {
            MfaErrorKind::InvalidCode
        }
        "code_expired" | "mfa_code_expired" | "expired" => MfaErrorKind::Expired,
        "too_many_attempts" | "rate_limited" | "too_many_requests" => MfaErrorKind::RateLimited,
        "locked" | "account_locked" | "mfa_locked" => MfaErrorKind::Locked,
        "network" | "network_error" | "timeout" => MfaErrorKind::Network,
        _ => MfaErrorKind::Unknown,
    }
}

/// The message the error band shows: the host's own text wins, the mapped
/// server code is the fallback, nothing means no band.
pub fn mfa_error_text(error: Option<&str>, error_code: Option<&str>) -> Option<String> {
    if let Some(text) = error.filter(|text| !text.trim().is_empty()) {
        return Some(text.to_string());
    }
    error_code
        .filter(|code| !code.trim().is_empty())
        .map(|code| mfa_error_from_code(code).message())
}

/// The card title: the host override wins verbatim (Vue tests
/// `props.title !== undefined`, so an empty override is an empty title), else
/// the bundle's default.
pub fn mfa_title(title: Option<&str>) -> String {
    match title {
        Some(title) => title.to_string(),
        None => hikari_i18n::t("components.hk.mfaVerifyCard.title", "Verify account"),
    }
}

/// The card subtitle: the host override wins verbatim, else the
/// account-aware derivation (`{name}` filled in here — `hikari_i18n::t` is a
/// flat lookup by design).
pub fn mfa_subtitle(subtitle: Option<&str>, account_name: &str) -> String {
    if let Some(subtitle) = subtitle {
        return subtitle.to_string();
    }
    if account_name.is_empty() {
        hikari_i18n::t(
            "components.hk.mfaVerifyCard.subtitle",
            "This account requires an extra verification step",
        )
    } else {
        hikari_i18n::t(
            "components.hk.mfaVerifyCard.verifySubtitle",
            "Verifying {name} — complete a sign-in method to continue",
        )
        .replace("{name}", account_name)
    }
}

/// The resend cooldown remaining, as a plain number (`None` = no cooldown).
pub fn mfa_resend_seconds(remaining: Option<u32>) -> u32 {
    remaining.unwrap_or(0)
}

/// One second of the resend cooldown, saturating at zero: the pure decrement
/// the host applies on its own schedule.
pub fn mfa_resend_tick(remaining: u32) -> u32 {
    remaining.saturating_sub(1)
}

/// Whether the resend action is available again (`> 0` is a running cooldown).
pub fn mfa_resend_ready(remaining: Option<u32>) -> bool {
    mfa_resend_seconds(remaining) == 0
}

/// Vue's resend enablement (`resending || loading || disabled`) plus the wave's
/// cooldown: a running countdown blocks the press.
pub fn mfa_resend_disabled(
    resending: bool,
    loading: bool,
    disabled: bool,
    remaining: Option<u32>,
) -> bool {
    resending || loading || disabled || !mfa_resend_ready(remaining)
}

/// The resend button's label: Vue's busy label while sending, the countdown
/// while the cooldown runs, the plain verb otherwise.
pub fn mfa_resend_label(resending: bool, remaining: Option<u32>) -> String {
    if resending {
        return mfa_busy_label();
    }
    let seconds = mfa_resend_seconds(remaining);
    if seconds == 0 {
        hikari_i18n::t("components.hk.mfaVerifyCard.resend", "Resend code")
    } else {
        hikari_i18n::t(
            "components.hk.mfaVerifyCard.resendIn",
            "Resend in {seconds}s",
        )
        .replace("{seconds}", &seconds.to_string())
    }
}

/// Vue's `busyLabel()` — the in-flight verb reused by the submit and the
/// resend buttons.
pub fn mfa_busy_label() -> String {
    hikari_i18n::t("components.hk.mfaVerifyCard.loading", "Verifying…")
}

/// The primary button's idle label (Vue: `hikari::mfaVerify.verify`).
pub fn mfa_verify_label() -> String {
    hikari_i18n::t("components.hk.mfaVerifyCard.verify", "Verify and sign in")
}

/// The secondary action's label (Vue: `hikari::mfaVerify.back`).
pub fn mfa_back_label() -> String {
    hikari_i18n::t("components.hk.mfaVerifyCard.back", "Back to sign in")
}

/// The recovery field's native placeholder.
pub fn mfa_recovery_placeholder() -> String {
    hikari_i18n::t(
        "components.hk.mfaVerifyCard.recoveryPlaceholder",
        "Enter a recovery code",
    )
}

/// The OTP row's accessible name (Vue: `ariaLabel={codeFields}`).
pub fn mfa_code_fields_label() -> String {
    hikari_i18n::t(
        "components.hk.mfaVerifyCard.codeFields",
        "Verification code",
    )
}

/// One OTP cell's accessible name (Vue's `cellAriaLabel`, 1-based position).
pub fn mfa_code_cell_label(index: usize) -> String {
    hikari_i18n::t("components.hk.mfaVerifyCard.codeCell", "Digit {index}")
        .replace("{index}", &index.to_string())
}

/// The two class hooks this card itself emits (the shell classes belong to
/// [`AuthCard`], the primitives' classes to their own mirrors).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MfaVerifyCardClass {
    /// The factor-picker wrapper — the ONLY class this component's own sheet
    /// paints (`.s-auth-form .s-mfa-factors`).
    Factors,
    /// The error band (from the shared `admin-tokens` vocabulary).
    Error,
}

impl MfaVerifyCardClass {
    /// The class exactly as the Vue sheets spell it.
    pub fn class_name(self) -> &'static str {
        match self {
            MfaVerifyCardClass::Factors => "s-mfa-factors",
            MfaVerifyCardClass::Error => "s-auth-error",
        }
    }
}

/// lucide `triangle-alert`, the error band's leading glyph. Trusted static
/// markup through `dangerous_inner_html` on its own `display:contents` host —
/// an rsx `svg {}` child would land in the HTML namespace (the crate-wide SVG
/// rule), and the band's flex row lays the glyph out as if it were a direct
/// child.
const MFA_ERROR_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>"#;

/// The error band's glyph on its paint-inert host.
fn mfa_error_glyph() -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: MFA_ERROR_GLYPH_SVG,
        }
    }
}

/// The picker's two entries, in machine order.
fn mfa_picker_options() -> Vec<HkIconButtonGroupOption> {
    MfaStep::ALL
        .iter()
        .map(|step| HkIconButtonGroupOption::new(step.key(), step.icon(), step.label()))
        .collect()
}

#[define_props]
pub struct MfaVerifyCardProps {
    /// The proof on stage (Vue: the local `selected` ref, controlled here).
    #[default]
    pub step: MfaStep,

    /// The OTP code (Vue: `code`).
    #[default]
    pub code: String,

    /// The recovery code (Vue owns this in `password` for its non-code arm).
    #[default]
    pub recovery_code: String,

    /// The account being verified — drives the "verifying {name}" subtitle
    /// (Vue: `accountName`).
    #[default]
    pub account_name: String,

    /// Title override; unset keeps the bundle's verify wording.
    pub title: Option<String>,

    /// Subtitle override; unset keeps the account-aware derivation.
    pub subtitle: Option<String>,

    /// Card header logo (Vue: the `logo` slot — see the `logoSrc` delta).
    pub logo: Option<Element>,

    /// The SMS arm of the OTP step: the separated 3+3 cell shape, the SMS hint
    /// and the resend row (Vue: `selected === "sms"`).
    #[default]
    pub sms: bool,

    /// External in-flight state; disables the actions and the proof field.
    #[default]
    pub loading: bool,

    /// Extra guard on top of the in-flight checks.
    #[default]
    pub disabled: bool,

    /// In-flight state of the resend action (swaps its label for the busy
    /// verb, exactly like Vue).
    #[default]
    pub resending: bool,

    /// Seconds left on the resend cooldown (the wave's controlled countdown:
    /// `Some(0)` / `None` mean "ready", any `> 0` blocks the press).
    pub resend_remaining: Option<u32>,

    /// Host-localized error text; wins over [`MfaVerifyCardProps::error_code`].
    pub error: Option<String>,

    /// The server's rejection code, mapped through [`mfa_error_from_code`].
    pub error_code: Option<String>,

    /// The user asks to prove the active step (Vue: the `verify` emit).
    pub on_verify: Option<EventHandler<MfaProof>>,

    /// The picker moved to another step (Vue: `update:modelValue`).
    pub on_step_change: Option<EventHandler<MfaStep>>,

    /// The OTP code changed (Vue: `update:modelValue` on the OtpInput).
    pub on_code_change: Option<EventHandler<String>>,

    /// The recovery code changed.
    pub on_recovery_change: Option<EventHandler<String>>,

    /// SMS resend requested (only wired on the `sms` arm).
    pub on_resend: Option<EventHandler<()>>,

    /// Abandon the step-up (Vue: the `back` emit).
    pub on_back: Option<EventHandler<()>>,
}

#[component]
pub fn MfaVerifyCard(props: MfaVerifyCardProps) -> Element {
    let step = props.step;
    // The active proof: the gate, the button copy and the emit all read this
    // one value, so the rendered button and the emitted proof cannot disagree.
    let proof = if step == MfaStep::Otp {
        props.code.clone()
    } else {
        props.recovery_code.clone()
    };
    let loading = props.loading;
    let disabled = props.disabled;
    let gate = mfa_submit_gate(step, &proof, loading, disabled);

    let title = mfa_title(props.title.as_deref());
    let picker_label = title.clone();
    let subtitle = mfa_subtitle(props.subtitle.as_deref(), &props.account_name);
    let error_text = mfa_error_text(props.error.as_deref(), props.error_code.as_deref());
    let submit_label = if loading {
        mfa_busy_label()
    } else {
        mfa_verify_label()
    };
    let resend_label = mfa_resend_label(props.resending, props.resend_remaining);
    let resend_disabled =
        mfa_resend_disabled(props.resending, loading, disabled, props.resend_remaining);

    // One unit-intent closure serves the Enter path (the OTP/Input
    // `submit_on_enter` prop) and the submit button's `on_submit`, so both
    // doors run the SAME gate instead of two drifting copies of Vue's guard.
    let submit_unit: Option<EventHandler<()>> = props.on_verify.clone().map(|verify| {
        let proof = proof.clone();
        event_handler(move |_unit: ()| {
            if mfa_submit_gate(step, &proof, loading, disabled).is_ready() {
                verify.call(MfaProof {
                    step,
                    proof: mfa_proof_text(&proof),
                });
            }
        })
    });
    let resend_click: Option<EventHandler<MouseEvent>> = props.on_resend.clone().map(|handler| {
        event_handler(move |_event: MouseEvent| {
            handler.call(());
        })
    });
    let back_click: Option<EventHandler<MouseEvent>> = props.on_back.clone().map(|handler| {
        event_handler(move |_event: MouseEvent| {
            handler.call(());
        })
    });
    // Vue's `onSelect`: an unknown key is a no-op (a re-click of the active
    // step is swallowed by the group's radio rule already).
    let step_select: Option<EventHandler<String>> = props.on_step_change.clone().map(|handler| {
        event_handler(move |key: String| {
            if let Some(next) = MfaStep::from_key(&key) {
                handler.call(next);
            }
        })
    });

    let code_fields = mfa_code_fields_label();
    let cell_aria = Callback::new(|index: usize| mfa_code_cell_label(index));

    // Vue's default slot, in render order: the picker, the error band, the
    // proof field, then the three actions.
    let body = rsx! {
        div {
            class: MfaVerifyCardClass::Factors.class_name(),
            IconButtonGroup {
                options: mfa_picker_options(),
                value: Some(step.key().to_string()),
                mode: IconButtonGroupMode::Single,
                variant: IconButtonGroupVariant::Slider,
                aria_label: Some(picker_label),
                on_select: step_select,
            }
        }
        if let Some(error) = error_text {
            div {
                class: MfaVerifyCardClass::Error.class_name(),
                "role": "alert",
                {mfa_error_glyph()}
                span { "{error}" }
            }
        }
        if step == MfaStep::Otp {
            OtpInput {
                model_value: props.code.clone(),
                length: MFA_OTP_LENGTH,
                separated: props.sms,
                hint: Some(MfaStep::Otp.hint(props.sms)),
                aria_label: Some(code_fields),
                cell_aria_label: Some(cell_aria),
                disabled: loading || disabled,
                auto_submit: true,
                submit_on_enter: submit_unit.clone(),
                on_input: props.on_code_change.clone(),
            }
        } else {
            Input {
                model_value: props.recovery_code.clone(),
                name: Some(MfaStep::Recovery.input_name().to_string()),
                autocomplete: Some("one-time-code".to_string()),
                placeholder: Some(mfa_recovery_placeholder()),
                hint: Some(MfaStep::Recovery.hint(false)),
                disabled: loading || disabled,
                submit_on_enter: submit_unit.clone(),
                oninput: props.on_recovery_change.clone(),
            }
        }
        AuthSubmitButton {
            label: Some(submit_label),
            block: true,
            loading: loading,
            disabled: gate.blocks(),
            on_submit: submit_unit,
        }
        if props.sms {
            Button {
                variant: ButtonVariant::Ghost,
                size: ButtonSize::Md,
                block: true,
                disabled: resend_disabled,
                label: Some(resend_label),
                onclick: resend_click,
            }
        }
        Button {
            variant: ButtonVariant::Ghost,
            size: ButtonSize::Md,
            block: true,
            disabled: loading,
            label: Some(mfa_back_label()),
            onclick: back_click,
        }
    };

    AuthCard(AuthCardProps {
        title,
        subtitle: Some(subtitle),
        logo: props.logo.clone(),
        children: body,
        ..Default::default()
    })
}

impl StyledComponent for MfaVerifyCardComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-mfa-factors` name literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMfaVerifyCard.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "mfa-verify-card"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mfa_step_keys_round_trip_through_the_machine() {
        assert_eq!(MfaStep::Otp.key(), "otp");
        assert_eq!(MfaStep::Recovery.key(), "recovery");
        assert_eq!(MfaStep::from_key("otp"), Some(MfaStep::Otp));
        assert_eq!(MfaStep::from_key("recovery"), Some(MfaStep::Recovery));
        // Unknown keys are no-ops, like Vue's `hkIsMfaFactor` guard.
        assert_eq!(MfaStep::from_key("passkey"), None);
        assert_eq!(MfaStep::from_key(""), None);
        // The ladder order and the field names are fixed.
        assert_eq!(MfaStep::ALL, [MfaStep::Otp, MfaStep::Recovery]);
        assert_eq!(MfaStep::Otp.input_name(), "mfa-verify-otp");
        assert_eq!(MfaStep::Recovery.input_name(), "mfa-verify-recovery");
        assert_eq!(MfaStep::default(), MfaStep::Otp);
    }

    #[test]
    fn mfa_step_labels_and_hints_come_from_the_bundle() {
        // `hikari_i18n::t` answers the English fallback in a test binary (no
        // locale loaded), so these are the Vue defaults verbatim.
        assert_eq!(MfaStep::Otp.label(), "Verification code");
        assert_eq!(MfaStep::Recovery.label(), "Recovery code");
        assert_eq!(MfaStep::Otp.hint(false), "Enter the 6-digit TOTP code");
        assert_eq!(MfaStep::Otp.hint(true), "Enter the 6-digit SMS code");
        assert_eq!(
            MfaStep::Recovery.hint(true),
            "Enter one of your recovery codes"
        );
        assert_eq!(mfa_busy_label(), "Verifying…");
        assert_eq!(mfa_verify_label(), "Verify and sign in");
        assert_eq!(mfa_back_label(), "Back to sign in");
        assert_eq!(mfa_recovery_placeholder(), "Enter a recovery code");
        assert_eq!(mfa_code_fields_label(), "Verification code");
        assert_eq!(mfa_code_cell_label(1), "Digit 1");
        assert_eq!(mfa_code_cell_label(6), "Digit 6");
    }

    #[test]
    fn mfa_submit_gate_needs_a_complete_proof() {
        // Both steps floor at Vue's six trimmed characters.
        assert_eq!(MfaStep::Otp.min_proof_chars(), 6);
        assert_eq!(MfaStep::Recovery.min_proof_chars(), 6);
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "12345", false, false),
            MfaSubmitGate::Incomplete
        );
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "123456", false, false),
            MfaSubmitGate::Ready
        );
        assert_eq!(
            mfa_submit_gate(MfaStep::Recovery, "AB-12", false, false),
            MfaSubmitGate::Incomplete
        );
        assert_eq!(
            mfa_submit_gate(MfaStep::Recovery, "ABCD-EF12", false, false),
            MfaSubmitGate::Ready
        );
        // Vue trims before measuring, so padding never shortens a real code…
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "  123456  ", false, false),
            MfaSubmitGate::Ready
        );
        // … and whitespace alone is never a proof.
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "      ", false, false),
            MfaSubmitGate::Incomplete
        );
        assert!(MfaSubmitGate::Ready.is_ready());
        assert!(MfaSubmitGate::Incomplete.blocks());
        assert!(MfaSubmitGate::Busy.blocks());
    }

    #[test]
    fn mfa_submit_gate_yields_to_the_busy_state_first() {
        // Vue returns on `loading || disabled` BEFORE looking at the proof, so
        // a full code on a busy card is still Busy — not Ready.
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "123456", true, false),
            MfaSubmitGate::Busy
        );
        assert_eq!(
            mfa_submit_gate(MfaStep::Otp, "123456", false, true),
            MfaSubmitGate::Busy
        );
        assert_eq!(
            mfa_submit_gate(MfaStep::Recovery, "", true, true),
            MfaSubmitGate::Busy
        );
    }

    #[test]
    fn mfa_proof_text_trims_the_edges_only() {
        assert_eq!(mfa_proof_text("  123456 "), "123456");
        assert_eq!(mfa_proof_text("ABCD EF12"), "ABCD EF12");
        assert_eq!(mfa_proof_text(""), "");
        // The host receives the trimmed text, tagged with the step.
        assert_eq!(
            MfaProof {
                step: MfaStep::Recovery,
                proof: mfa_proof_text("  ABCD-EF12  "),
            },
            MfaProof {
                step: MfaStep::Recovery,
                proof: "ABCD-EF12".to_string(),
            }
        );
    }

    #[test]
    fn mfa_error_codes_map_onto_the_kinds() {
        assert_eq!(
            mfa_error_from_code("invalid_code"),
            MfaErrorKind::InvalidCode
        );
        // Payload spellings vary; the lookup normalizes them.
        assert_eq!(
            mfa_error_from_code("  INVALID-CODE "),
            MfaErrorKind::InvalidCode
        );
        assert_eq!(mfa_error_from_code("code_expired"), MfaErrorKind::Expired);
        assert_eq!(
            mfa_error_from_code("too_many_attempts"),
            MfaErrorKind::RateLimited
        );
        assert_eq!(mfa_error_from_code("account_locked"), MfaErrorKind::Locked);
        assert_eq!(mfa_error_from_code("network_error"), MfaErrorKind::Network);
        // Anything unknown is still a named failure, never a silent one.
        assert_eq!(mfa_error_from_code("gremlins"), MfaErrorKind::Unknown);
        assert_eq!(mfa_error_from_code(""), MfaErrorKind::Unknown);

        for kind in [
            MfaErrorKind::InvalidCode,
            MfaErrorKind::Expired,
            MfaErrorKind::RateLimited,
            MfaErrorKind::Locked,
            MfaErrorKind::Network,
            MfaErrorKind::Unknown,
        ] {
            assert!(
                kind.message_key()
                    .starts_with("components.hk.mfaVerifyCard."),
                "every error message is a bundle key: {}",
                kind.message_key()
            );
            assert!(!kind.fallback().is_empty());
            assert_eq!(kind.message(), kind.fallback());
        }
    }

    #[test]
    fn mfa_error_text_prefers_the_host_string() {
        assert_eq!(mfa_error_text(None, None), None);
        assert_eq!(mfa_error_text(Some("   "), None), None);
        // Host text wins over a mapped code.
        assert_eq!(
            mfa_error_text(Some("Wrong code"), Some("code_expired")),
            Some("Wrong code".to_string())
        );
        // A code alone resolves through the mapping.
        assert_eq!(
            mfa_error_text(None, Some("code_expired")),
            Some("That code has expired — request a new one".to_string())
        );
        assert_eq!(
            mfa_error_text(None, Some("  ")),
            None,
            "a blank code is not an error"
        );
    }

    #[test]
    fn mfa_titles_fill_the_account_name() {
        assert_eq!(mfa_title(None), "Verify account");
        // An override wins verbatim, even an empty one (Vue's
        // `!== undefined` test).
        assert_eq!(mfa_title(Some("Confirm it's you")), "Confirm it's you");
        assert_eq!(mfa_title(Some("")), "");
        assert_eq!(
            mfa_subtitle(None, ""),
            "This account requires an extra verification step"
        );
        assert_eq!(
            mfa_subtitle(None, "demierge"),
            "Verifying demierge — complete a sign-in method to continue"
        );
        assert_eq!(
            mfa_subtitle(Some("Pick a factor"), "demierge"),
            "Pick a factor"
        );
    }

    #[test]
    fn mfa_resend_countdown_labels_and_gates() {
        // No cooldown: the plain verb, and the press is free.
        assert_eq!(mfa_resend_label(false, None), "Resend code");
        assert_eq!(mfa_resend_label(false, Some(0)), "Resend code");
        assert!(mfa_resend_ready(None));
        assert!(mfa_resend_ready(Some(0)));
        // Running cooldown: the countdown label and a dead press.
        assert_eq!(mfa_resend_label(false, Some(30)), "Resend in 30s");
        assert!(!mfa_resend_ready(Some(30)));
        assert!(mfa_resend_disabled(false, false, false, Some(30)));
        assert!(!mfa_resend_disabled(false, false, false, Some(0)));
        // Vue's own three blocks survive the countdown addition.
        assert!(mfa_resend_disabled(true, false, false, None));
        assert!(mfa_resend_disabled(false, true, false, None));
        assert!(mfa_resend_disabled(false, false, true, None));
        // The in-flight label is Vue's busy verb, not a countdown.
        assert_eq!(mfa_resend_label(true, Some(30)), "Verifying…");
        // The tick saturates at zero.
        assert_eq!(mfa_resend_tick(30), 29);
        assert_eq!(mfa_resend_tick(1), 0);
        assert_eq!(mfa_resend_tick(0), 0);
        assert_eq!(mfa_resend_seconds(None), 0);
    }

    #[test]
    fn mfa_class_names_match_the_sheets() {
        // The one class this component's own sheet paints.
        assert_eq!(MfaVerifyCardClass::Factors.class_name(), "s-mfa-factors");
        // The error band comes from the shared admin-tokens vocabulary.
        assert_eq!(MfaVerifyCardClass::Error.class_name(), "s-auth-error");
    }

    #[test]
    fn mfa_defaults_match_the_vue_props() {
        let props = MfaVerifyCardProps::default();
        assert_eq!(props.step, MfaStep::Otp);
        assert_eq!(props.code, "");
        assert_eq!(props.recovery_code, "");
        assert_eq!(props.account_name, "");
        assert!(props.title.is_none());
        assert!(props.subtitle.is_none());
        assert!(props.logo.is_none());
        assert!(!props.sms);
        assert!(!props.loading);
        assert!(!props.disabled);
        assert!(!props.resending);
        assert!(props.resend_remaining.is_none());
        assert!(props.error.is_none());
        assert!(props.error_code.is_none());
        assert!(props.on_verify.is_none());
        assert!(props.on_step_change.is_none());
        assert!(props.on_code_change.is_none());
        assert!(props.on_recovery_change.is_none());
        assert!(props.on_resend.is_none());
        assert!(props.on_back.is_none());
    }

    #[test]
    fn mfa_renders_the_otp_step_contract() {
        let html = MfaVerifyCard(MfaVerifyCardProps {
            code: "123456".to_string(),
            account_name: "demierge".to_string(),
            error_code: Some("invalid_code".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The composed AuthCard shell.
            r#"class="s-auth-card-height""#,
            r#"class="s-auth-card""#,
            r#"class="s-auth-header""#,
            r#"class="s-auth-title""#,
            "Verify account",
            r#"class="s-auth-subtitle""#,
            "Verifying demierge — complete a sign-in method to continue",
            // The sheet's own picker wrapper + the picker itself.
            r#"class="s-mfa-factors""#,
            "hk-icon-group",
            "hk-icon-group-single",
            "hk-icon-group-slider",
            r#"aria-label="Verify account""#,
            r#"data-key="otp""#,
            r#"data-key="recovery""#,
            r#"aria-checked="true""#,
            // The error band: role + mapped message + the glyph host.
            r#"class="s-auth-error""#,
            r#"role="alert""#,
            "That verification code is not valid",
            "lucide-triangle-alert",
            r#"style="display:contents""#,
            // The OTP row + its hint.
            r#"class="hk-otp-wrapper""#,
            "Enter the 6-digit TOTP code",
            r#"aria-label="Digit 1""#,
            // The three actions, through their mirrors.
            r#"class="s-auth-submit""#,
            "Verify and sign in",
            "Back to sign in",
            "hk-btn-primary",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // One cell per character, no separated gap outside the sms arm.
        assert_eq!(html.matches("hk-otp-cell").count(), 6, "{html}");
        assert!(!html.contains("hk-otp-gap"), "{html}");
        // The recovery field is NOT on stage.
        assert!(!html.contains("mfa-verify-recovery"), "{html}");
        // The resend row belongs to the sms arm only.
        assert!(!html.contains("Resend code"), "{html}");
        // A complete code on an idle card opens the submit door: nothing on
        // the surface is disabled (`disabled` is a presence attribute, so the
        // substring covers the button AND the OTP cells).
        assert!(!html.contains("disabled="), "{html}");
    }

    #[test]
    fn mfa_renders_the_recovery_step_contract() {
        let html = MfaVerifyCard(MfaVerifyCardProps {
            step: MfaStep::Recovery,
            recovery_code: "ABCD-EF12".to_string(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="s-auth-card""#,
            r#"class="s-auth-form""#,
            r#"class="hk-input-wrapper""#,
            r#"name="mfa-verify-recovery""#,
            r#"autocomplete="one-time-code""#,
            "Enter a recovery code",
            "Enter one of your recovery codes",
            "Verify and sign in",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The OTP row is gone with its step.
        assert!(!html.contains("hk-otp-wrapper"), "{html}");
        // No error → no band at all.
        assert!(!html.contains("s-auth-error"), "{html}");
        // The generic subtitle when no account is named.
        assert!(
            html.contains("This account requires an extra verification step"),
            "{html}"
        );
        // The complete recovery code opens the submit door too.
        assert!(!html.contains("disabled="), "{html}");
    }

    #[test]
    fn mfa_renders_the_sms_countdown_and_busy_arms() {
        let html = MfaVerifyCard(MfaVerifyCardProps {
            sms: true,
            resend_remaining: Some(30),
            loading: true,
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The sms arm: separated cells + the SMS hint.
            "hk-otp-gap",
            "Enter the 6-digit SMS code",
            // The countdown label and its dead press.
            "Resend in 30s",
            // The busy verb replaces the submit label.
            "Verifying…",
            "Back to sign in",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // One separated gap on a six-cell row.
        assert_eq!(html.matches("hk-otp-gap").count(), 1, "{html}");
        // The actions are dead while busy.
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
    }

    #[test]
    fn mfa_styles_come_from_the_canonical_vue_sheet() {
        let css = MfaVerifyCardComponent::styles();
        assert!(
            css.contains(".s-auth-form .s-mfa-factors"),
            "mfa css must carry the factor-picker wrapper rule"
        );
        assert!(
            css.contains("align-items: center"),
            "the wrapper centers the picker horizontally"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored mfa sheet"
        );
        assert_eq!(MfaVerifyCardComponent::name(), "mfa-verify-card");
    }
}
