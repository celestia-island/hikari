// hi-components/src/auth/password_surface.rs
// PasswordSurface — mirror of the canonical Vue `HkPasswordSurface`: the
// rendering engine behind `HkInput variant="password"` (the field's
// wrapper / label / error / hint chrome stays HkInput's, exactly as Vue).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPasswordSurface.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-pwd*` class names are literal and
// identical in both forms. DOM contract (mirrors the Vue render output; the
// Vue render returns a fragment of the box + the hint lane, and so does this):
//
//   div.hk-pwd-box.hk-pwd-box-{sm|md|lg} [+class] [host style]
//       [data-focused] [data-error] [data-disabled] [data-fw]
//     div.hk-pwd-lock.hk-pwd-lock-{empty|filled} [.hk-pwd-lock-custom]
//         <caller #prefix / #prefixIcon content> | <lock svg 16×16>
//     div.hk-pwd-dots > span[style="display:contents"] > <dot-matrix svg>
//     span.hk-pwd-placeholder                     (lane 1, when shown)
//       span.hk-pwd-placeholder-text "{placeholder}"
//     span.hk-pwd-blur-hint "{passwordEntered}"   (lane 2, when shown)
//     span.hk-pwd-select-hint "{allSelected}"     (lane 3, when shown)
//     <reveal_content slot>                       (lane 4 — [D] host content)
//     input.hk-pwd-input
//         type="password" value id name autocomplete="off"
//         data-1p-ignore="" data-lpignore="true"
//         [disabled] [readonly] [required]
//     span.hk-tooltip-wrapper > span.hk-tooltip-trigger > span.hk-pwd-strength
//         [data-level] role="img" aria-label      (trailing=strength, see Tooltip)
//     button.hk-pwd-eye [data-revealing] type="button" aria-label (trailing=eye)
//     span.hk-pwd-suffix                          (caller #suffix / #suffixIcon)
//   div.hk-pwd-hints
//     div > span.hk-pwd-hint[data-variant="caps"]  (feedback.caps_lock)
//     div > span.hk-pwd-hint[data-variant="fw"]    (feedback.full_width)
//
// Vue prop mapping: `modelValue` → [`PasswordSurfaceProps::value`], `error` →
// [`PasswordSurfaceProps::error`], `passwordTrailing` →
// [`PasswordSurfaceProps::trailing`], `revealTrigger` →
// [`PasswordSurfaceProps::reveal_trigger`], `strengthEvaluator` →
// [`PasswordSurfaceProps::host_strength`] ([D5]), `size` → [`PasswordSize`],
// `update:modelValue` → `on_value_change`, the reveal intent →
// `on_visibility_change`, and Vue's local refs (`revealing` / `focused` /
// `capsLock` / `fullWidthPaused` / `allSelected` / `pendingClear`) → the
// controlled pair `visible` + `feedback`. `revealStrategy` and
// `revealAutoHideMs` have no analogue ([D1]); the `#prefix`/`#prefixIcon`/
// `#suffix`/`#suffixIcon` slots keep Vue's precedence (`#prefix` beats
// `#prefixIcon`, an explicit suffix stands the built-in affordance down).
//
// The pure layer (the whole point of this mirror — the render function only
// assembles): `password_level` / `password_strength_level` (the traffic
// light), `password_rule_table` / `password_validation` (Vue's exported
// `validatePassword`), `password_candidates` (see [D3]), `password_reveal_gate`
// / `password_reveal_intent` / `password_reveal_release` (the visibility
// toggle gate), `password_lanes` / `password_resolved_placeholder` (which
// overlay lane shows what), `password_apply_input` (pending-clear + the
// full-width filter), `password_focus_feedback` / `password_input_feedback`
// (the controlled feedback transitions), `password_enter_submits` (the submit
// gate), `password_dots` / `password_dots_svg` (the dot matrix geometry),
// `password_box_classes` / `password_lock_classes` / `password_box_flags`.
//
// State (L48): this component stores NOTHING. Every bit Vue keeps in a local
// `ref` is a controlled prop here — `value`, `visible`, and the flag bundle
// `feedback` — and every transition Vue applies locally is published through
// a callback (`on_value_change`, `on_feedback_change`,
// `on_visibility_change`) so the host owns the state exactly like HkInput's
// `modelValue`/`update:modelValue` pair. The one thread_local is the IME
// composition flag (no `KeyboardEvent::is_composing` in tairitsu 0.5.22 —
// the same singleton call as `basic/otp_input.rs`); it never drives rendering.
//
// Deltas vs Vue (documented, not accidental):
//   [D1] NO CANVAS. Vue paints everything on a `<canvas>`: the dot matrix
//     (with pointer-driven ripples), the reveal pass (filter / sweep / noise
//     / plain strategies, the revealKinematogram painters) and the autofill
//     flash. tairitsu exposes no 2D context, so Vue's
//     `<canvas class="hk-pwd-dots">` becomes a `div` carrying the same class
//     (the sheet's full-bleed rules are element-agnostic) whose child is a
//     STATIC SVG (`password_dots_svg`) on a `display:contents` host — tairitsu's
//     elements are created in the HTML namespace, so an rsx `svg {}` child
//     never paints (L49) — and the reveal is HOST CONTENT (`reveal_content`,
//     rendered only while `visible`). Consequences: no ripples, no breathing
//     animation, no per-frame jitter, `revealStrategy` / `revealAutoHideMs`
//     have no analogue (there is nothing to paint and no timer to run), and
//     the dots paint in `currentColor` instead of the JS-sampled
//     `--hi-color-primary-rgb` (Vue reads it off `document.documentElement`).
//   [D2] NO POINTER/DOCUMENT LISTENERS. Vue ends a hold-reveal on a
//     `document`-level `pointerup` (once) plus `pointercancel`; tairitsu
//     binds handlers to elements only, so the eye publishes the release on its
//     OWN `pointerup`. A release outside the eye therefore never hides — the
//     host can end the reveal from its own pointerup handler through
//     `on_visibility_change(false)`. `contextmenu` (Vue's long-press callout
//     guard) is not an rsx event and is dropped.
//   [D3] ADDITIVE: a password GENERATOR. Vue ships no generator; its exported
//     pure utils are `passwordLevel` + `validatePassword` only. The mirror
//     adds a deterministic candidate generator (`password_candidates`) so a
//     host can offer suggestions without inventing its own alphabet policy.
//     It is a pure API — the surface never renders it.
//   [D4] The DOM `input` NEVER flips to `type="text"`: Vue's reveal is canvas
//     paint only (HkInput's own header states this), and the mirror keeps
//     `type="password"` at all times. While `visible`, the placeholder /
//     blur-hint lanes stand down and the eye carries `data-revealing`.
//   [D5] `strengthEvaluator` (a JS function prop, called inside Vue's render
//     with a try/catch fallback) has no Rust analogue. The host passes its
//     classifier's verdict as `host_strength`; `None` means "use the built-in
//     `password_level`". A host that wants Vue's throw-fallback simply omits
//     the prop.
//   [D6] `autocomplete` resolves through Vue's runtime credential policy
//     (`credentialAutocomplete("password", "off")` → `"off"` in a browser,
//     `"new-password"` inside a Tauri webview). The mirror cannot probe the
//     shell, so the prop's `None` renders Vue's browser default `"off"` and the
//     host passes `"new-password"` itself on native.
//   [D7] Caps-lock and all-selected feedback are HOST-OBSERVED. Vue reads
//     `KeyboardEvent.getModifierState("CapsLock")` and the input's
//     selection range; tairitsu's `KeyboardEvent` carries no modifier state and
//     there is no selection API, so both arrive through `feedback` (the
//     component renders them exactly like Vue).
//   [D8] No generated ids, no attribute fan-out, no marquee, no autofill
//     polling, no focus reclaim / refocus (no `focus()` API): Vue's
//     `{...restAttrs}` bag, `HkPlaceholderMarquee`, the 500ms
//     `checkAutofill()` poll, the blur-window refocus and the
//     `clearAndFocus()` caret move have no analogue. The intents survive as
//     callbacks: `on_focus_request` (placeholder tap) and `on_clear`
//     (blur-hint click: Vue emits `""` then focuses).
//   [D9] `data-flash` and the ripple are dropped with the canvas (see [D1]);
//     the sheet's `hk-pwd-flash` keyframes are therefore never triggered.
//   [D10] i18n keys read `components.hk.*` through `hikari_i18n::t` instead of
//     Vue's `hikari::*` catalog keys; the fallbacks are the Vue English
//     strings, so the English DOM is identical. The new leaves are listed in
//     the wave receipt; the four pre-existing `hk.passwordInput.*` entries in
//     the crate bundle are reused as-is.
//   [D11] a host `class` is appended to `.hk-pwd-box` and a host `style` is
//     applied to it (Vue merges the fallthrough class/style itself, and
//     `inheritAttrs: false` keeps them off the input).
//   [D12] string LENGTHS are counted in Unicode scalar values
//     (`chars().count()`), where Vue counts UTF-16 code units: identical for
//     BMP text, and an astral glyph (an emoji) counts once instead of twice —
//     reachable only by the strength tiers and the policy's length rule.

use std::cell::Cell;

use hikari_i18n::t;

use crate::feedback::{Tooltip, TooltipPlacement};
use crate::prelude::*;
use crate::styled::StyledComponent;
use tairitsu_vdom::PointerEvent;

pub struct PasswordSurfaceComponent;

// ── enums ────────────────────────────────────────────────────────────────

/// Vue's `size` (`"sm" | "md" | "lg"`, default `md`): class-only, the sheet
/// owns the box height per step.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PasswordSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl PasswordSize {
    /// The `hk-pwd-box-{size}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            PasswordSize::Sm => "hk-pwd-box-sm",
            PasswordSize::Md => "hk-pwd-box-md",
            PasswordSize::Lg => "hk-pwd-box-lg",
        }
    }
}

/// Vue's `passwordTrailing` (`"eye" | "strength" | "none"`, default `eye`):
/// which right-edge affordance the box renders.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PasswordTrailing {
    #[default]
    Eye,
    Strength,
    None,
}

impl PasswordTrailing {
    /// The Vue prop token (also the `PasswordTrailing` contract for hosts).
    pub fn token(self) -> &'static str {
        match self {
            PasswordTrailing::Eye => "eye",
            PasswordTrailing::Strength => "strength",
            PasswordTrailing::None => "none",
        }
    }
}

/// Vue's `revealTrigger` (`"hold" | "toggle"`, default `hold`): how the eye
/// reveal is triggered, which is also what its accessible name says.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum PasswordRevealTrigger {
    #[default]
    Hold,
    Toggle,
}

/// Vue's `PasswordLevel` (the traffic-light step, `utils/password.ts`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PasswordLevel {
    Weak,
    Fair,
    Strong,
}

impl PasswordLevel {
    /// The `data-level` token exactly as the sheet matches it.
    pub fn token(self) -> &'static str {
        match self {
            PasswordLevel::Weak => "weak",
            PasswordLevel::Fair => "fair",
            PasswordLevel::Strong => "strong",
        }
    }

    /// The i18n key of the localized level name (Vue:
    /// `hikari::passwordInput.strength{Weak,Fair,Strong}`).
    pub fn label_key(self) -> &'static str {
        match self {
            PasswordLevel::Weak => "components.hk.passwordInput.strengthWeak",
            PasswordLevel::Fair => "components.hk.passwordInput.strengthFair",
            PasswordLevel::Strong => "components.hk.passwordInput.strengthStrong",
        }
    }

    /// The English fallback for [`PasswordLevel::label_key`] — Vue's catalog
    /// text.
    pub fn label_fallback(self) -> &'static str {
        match self {
            PasswordLevel::Weak => "Weak",
            PasswordLevel::Fair => "Fair",
            PasswordLevel::Strong => "Strong",
        }
    }
}

// ── the controlled feedback bundle ───────────────────────────────────────

/// Every transient flag Vue keeps in a local `ref` on this surface. The host
/// owns it and passes it in; the component publishes the transitions it can
/// derive through `on_feedback_change` (see the header deltas for the two the
/// host must observe itself: caps-lock and all-selected).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct PasswordFeedback {
    /// Vue: `focused`.
    pub focused: bool,
    /// Vue: `capsLock` (host-observed, [D7]).
    pub caps_lock: bool,
    /// Vue: `fullWidthPaused` — also the `data-fw` marker on the box.
    pub full_width: bool,
    /// Vue: `allSelected` (host-observed, [D7]).
    pub all_selected: bool,
    /// Vue: `pendingClear` — the entered password awaits the first keystroke.
    pub pending_clear: bool,
}

impl PasswordFeedback {
    /// Vue's `onBlur` reset: `focused`, `pendingClear`, `capsLock`,
    /// `fullWidthPaused` and `allSelected` all drop together.
    pub fn blurred() -> Self {
        Self::default()
    }
}

// ── strength (the traffic light) ─────────────────────────────────────────

/// Vue's `passwordLevel` (`utils/password.ts`), ported literally:
/// `strong` needs ≥ 10 chars + upper + lower + special, `fair` ≥ 8 chars +
/// letter + digit, everything else `weak`, and an empty value has no level
/// at all.
pub fn password_level(value: &str) -> Option<PasswordLevel> {
    if value.is_empty() {
        return None;
    }
    let length = value.chars().count();
    let has_letter = value.chars().any(|ch| ch.is_ascii_alphabetic());
    let has_digit = value.chars().any(|ch| ch.is_ascii_digit());
    let has_upper = value.chars().any(|ch| ch.is_ascii_uppercase());
    let has_lower = value.chars().any(|ch| ch.is_ascii_lowercase());
    let has_special = value.chars().any(|ch| !ch.is_ascii_alphanumeric());
    if length >= 10 && has_upper && has_lower && has_special {
        return Some(PasswordLevel::Strong);
    }
    if length >= 8 && has_letter && has_digit {
        return Some(PasswordLevel::Fair);
    }
    Some(PasswordLevel::Weak)
}

/// The level the surface should show: Vue's `level` computed — `null` unless
/// the affordance is the strength dot and the field has a value, otherwise the
/// host's classifier ([D5]) or the built-in [`password_level`].
pub fn password_strength_level(
    trailing: PasswordTrailing,
    value: &str,
    host_level: Option<PasswordLevel>,
) -> Option<PasswordLevel> {
    if trailing != PasswordTrailing::Strength || value.is_empty() {
        return None;
    }
    host_level.or_else(|| password_level(value))
}

/// Vue renders the dot only when the caller supplied no suffix slot and the
/// trailing affordance is the strength dot with a level to show.
pub fn password_show_strength(
    trailing: PasswordTrailing,
    level: Option<PasswordLevel>,
    has_custom_suffix: bool,
) -> bool {
    !has_custom_suffix && trailing == PasswordTrailing::Strength && level.is_some()
}

/// The localized level name (`Weak` / `Fair` / `Strong`).
pub fn password_level_label(level: PasswordLevel) -> String {
    t(level.label_key(), level.label_fallback())
}

/// Vue's `strengthTooltip`: `"<Password strength>: <level>"`, or the empty
/// string while there is no level (the dot is not rendered then).
pub fn password_strength_tooltip(level: Option<PasswordLevel>) -> String {
    match level {
        Some(level) => format!(
            "{}: {}",
            t(
                "components.hk.passwordInput.strengthLabel",
                "Password strength"
            ),
            password_level_label(level)
        ),
        None => String::new(),
    }
}

// ── rules / validation (Vue `validatePassword`) ──────────────────────────

/// The three rules of Vue's `validatePassword`, in their evaluation order —
/// the FIRST failing rule is the one whose `errorKey` Vue returns.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PasswordRule {
    /// `password === confirmPassword`.
    Match,
    /// `password.length >= min_length`.
    MinLength,
    /// The alphabet requirement (letters + digits in Vue's default policy).
    Variety,
}

impl PasswordRule {
    /// The rule token (a stable key for a host's own checklist UI).
    pub fn token(self) -> &'static str {
        match self {
            PasswordRule::Match => "mismatch",
            PasswordRule::MinLength => "minLength",
            PasswordRule::Variety => "variety",
        }
    }

    /// Vue's `errorKey` leaf under the caller's prefix
    /// (`common.validation.passwordMismatch` / `.minLength` /
    /// `.passwordNeedsVariety`).
    pub fn error_key(self) -> &'static str {
        match self {
            PasswordRule::Match => "passwordMismatch",
            PasswordRule::MinLength => "minLength",
            PasswordRule::Variety => "passwordNeedsVariety",
        }
    }
}

/// One row of the rule pass table: the rule and whether the pair satisfies it.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct PasswordRuleState {
    pub rule: PasswordRule,
    pub passed: bool,
}

/// The policy [`password_rule_table`] / [`password_validation`] /
/// [`password_candidates`] evaluate against. Vue hard-codes `≥ 8` chars and
/// "letters + digits" inside `validatePassword`; they are explicit here so a
/// host can tighten them, and the default reproduces Vue exactly.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct PasswordPolicy {
    pub min_length: usize,
    pub require_letters: bool,
    pub require_digits: bool,
}

impl Default for PasswordPolicy {
    fn default() -> Self {
        Self {
            min_length: 8,
            require_letters: true,
            require_digits: true,
        }
    }
}

impl PasswordPolicy {
    /// Whether the value carries the required alphabet.
    pub fn alphabet_ok(self, password: &str) -> bool {
        let has_letter = password.chars().any(|ch| ch.is_ascii_alphabetic());
        let has_digit = password.chars().any(|ch| ch.is_ascii_digit());
        (!self.require_letters || has_letter) && (!self.require_digits || has_digit)
    }

    /// Whether the value alone satisfies the length + alphabet rules (the
    /// "confirm" rule is about the PAIR, so it is not part of this test).
    pub fn accepts(self, password: &str) -> bool {
        password.chars().count() >= self.min_length && self.alphabet_ok(password)
    }
}

/// The rule pass table (Vue evaluates the same three predicates, but only
/// reports the first failure — see [`password_validation`]). Callers render a
/// checklist from this; the surface itself does not draw one (Vue's surface
/// does not either — the validator is an exported util).
pub fn password_rule_table(
    password: &str,
    confirm: &str,
    policy: &PasswordPolicy,
) -> Vec<PasswordRuleState> {
    vec![
        PasswordRuleState {
            rule: PasswordRule::Match,
            passed: password == confirm,
        },
        PasswordRuleState {
            rule: PasswordRule::MinLength,
            passed: password.chars().count() >= policy.min_length,
        },
        PasswordRuleState {
            rule: PasswordRule::Variety,
            passed: policy.alphabet_ok(password),
        },
    ]
}

/// Vue's `validatePassword`: the first failing rule, or `None` when the pair
/// is valid. The order IS the contract (Vue returns the first failure, since
/// each branch returns immediately).
pub fn password_validation(
    password: &str,
    confirm: &str,
    policy: &PasswordPolicy,
) -> Option<PasswordRule> {
    password_rule_table(password, confirm, policy)
        .into_iter()
        .find(|state| !state.passed)
        .map(|state| state.rule)
}

/// Vue's `errorKey` for a failed validation: the prefix is the caller's
/// (`"common.validation"` in Vue) and the leaf comes from
/// [`PasswordRule::error_key`].
pub fn password_error_key(rule: PasswordRule, prefix: &str) -> String {
    format!("{prefix}.{}", rule.error_key())
}

// ── candidates (an additive generator, [D3]) ─────────────────────────────

/// The ambiguous-glyph-free alphabets the generator draws from (`l`, `I`, `O`,
/// `0`, `1` are omitted so a generated candidate can be read back reliably).
const PASSWORD_LOWER: &str = "abcdefghijkmnopqrstuvwxyz";
const PASSWORD_UPPER: &str = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_DIGITS: &str = "23456789";
const PASSWORD_SPECIAL: &str = "!@#$%^&*-_=+?";
/// The pool every non-guaranteed position draws from — the union of the four
/// alphabets above (kept literally in sync with them).
const PASSWORD_MIXED: &str =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+?";
/// Generated candidates are never shorter than this, so one candidate satisfies
/// both the default policy and the `strong` strength step.
const PASSWORD_CANDIDATE_LENGTH: usize = 12;

/// One deterministic LCG step (Numerical Recipes constants) returning the high
/// 31 bits — the generator's whole entropy source, so the same seed always
/// yields the same candidates.
fn password_next_random(state: &mut u64) -> u64 {
    *state = state
        .wrapping_mul(6_364_136_223_846_793_005)
        .wrapping_add(1_442_695_040_888_963_407);
    *state >> 33
}

/// Draw one character from an ASCII alphabet (every alphabet above is ASCII by
/// construction, so byte indexing is the character index).
fn password_pick(alphabet: &str, state: &mut u64) -> char {
    let bytes = alphabet.as_bytes();
    let index = (password_next_random(state) as usize) % bytes.len();
    char::from(bytes[index])
}

/// A deterministic list of candidate passwords (additive, see [D3]).
///
/// Every candidate is at least [`PASSWORD_CANDIDATE_LENGTH`] long and carries
/// one lower-case letter, one upper-case letter, one digit and one special
/// character, drawn from the ambiguous-glyph-free alphabets above; positions
/// are then Fisher-Yates shuffled so the guaranteed characters are not at
/// fixed offsets. Same `seed` ⇒ same list; a different seed ⇒ a different list.
/// A host that renders these into the field's `value` is responsible for the
/// suggestion UI — the surface itself never generates anything.
pub fn password_candidates(policy: &PasswordPolicy, seed: u64, count: usize) -> Vec<String> {
    let length = policy.min_length.max(PASSWORD_CANDIDATE_LENGTH);
    let mut state = seed;
    (0..count)
        .map(|_| {
            let mut pool: Vec<char> = Vec::with_capacity(length);
            pool.push(password_pick(PASSWORD_LOWER, &mut state));
            pool.push(password_pick(PASSWORD_UPPER, &mut state));
            pool.push(password_pick(PASSWORD_DIGITS, &mut state));
            pool.push(password_pick(PASSWORD_SPECIAL, &mut state));
            while pool.len() < length {
                pool.push(password_pick(PASSWORD_MIXED, &mut state));
            }
            for index in (1..pool.len()).rev() {
                let swap_with = (password_next_random(&mut state) as usize) % (index + 1);
                pool.swap(index, swap_with);
            }
            pool.into_iter().collect()
        })
        .collect()
}

// ── the visibility toggle gate ───────────────────────────────────────────

/// Everything the eye affordance needs, resolved once by
/// [`password_reveal_gate`].
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct PasswordRevealGate {
    /// The eye is rendered at all (Vue: `passwordTrailing === "eye"`,
    /// not disabled, no caller suffix).
    pub show_eye: bool,
    /// A press can start a reveal (Vue's `startReveal` guard: a non-empty
    /// value and not disabled — readonly keeps the reveal, exactly like Vue).
    pub can_reveal: bool,
    /// The trigger is click-to-toggle rather than press-and-hold.
    pub toggle: bool,
    /// The controlled reveal state this gate was resolved against.
    pub visible: bool,
    /// The eye's `aria-label` i18n key.
    pub label_key: &'static str,
    /// The eye's `aria-label` English fallback (Vue's catalog text).
    pub label_fallback: &'static str,
}

/// Vue's reveal gate, assembled: the render gate (`showEye`), the press gate
/// (`startReveal`'s early return), the trigger mode, the live reveal state and
/// the localized label (`hold` → "Hold to show password", `toggle` →
/// "Show"/"Hide password").
pub fn password_reveal_gate(
    trailing: PasswordTrailing,
    trigger: PasswordRevealTrigger,
    value: &str,
    disabled: bool,
    visible: bool,
    has_custom_suffix: bool,
) -> PasswordRevealGate {
    let toggle = trigger == PasswordRevealTrigger::Toggle;
    let (label_key, label_fallback) = match (toggle, visible) {
        (true, true) => (
            "components.hk.input.hidePassword",
            PasswordRevealGate::HIDE_FALLBACK,
        ),
        (true, false) => (
            "components.hk.input.showPassword",
            PasswordRevealGate::SHOW_FALLBACK,
        ),
        (false, _) => (
            "components.hk.passwordInput.holdToReveal",
            PasswordRevealGate::HOLD_FALLBACK,
        ),
    };
    PasswordRevealGate {
        show_eye: trailing == PasswordTrailing::Eye && !disabled && !has_custom_suffix,
        can_reveal: !value.is_empty() && !disabled,
        toggle,
        visible,
        label_key,
        label_fallback,
    }
}

impl PasswordRevealGate {
    const SHOW_FALLBACK: &str = "Show password";
    const HIDE_FALLBACK: &str = "Hide password";
    const HOLD_FALLBACK: &str = "Hold to show password";
}

/// The value the eye publishes on a press: `None` when the gate refuses (the
/// press changes nothing), otherwise `toggle` flips and `hold` always shows.
pub fn password_reveal_intent(gate: &PasswordRevealGate) -> Option<bool> {
    if !gate.can_reveal {
        return None;
    }
    Some(if gate.toggle { !gate.visible } else { true })
}

/// The value the eye publishes on a release: `hold` hides a live reveal,
/// `toggle` keeps it (Vue's `endReveal` is wired to `pointerup` only in hold
/// mode, and a toggle press has no release handler at all).
pub fn password_reveal_release(gate: &PasswordRevealGate) -> Option<bool> {
    if !gate.visible || gate.toggle {
        None
    } else {
        Some(false)
    }
}

// ── the overlay lanes + placeholders ─────────────────────────────────────

/// Which overlay lane the box paints (Vue's three ternaries, resolved once).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct PasswordLanes {
    /// Lane 1: the breathing placeholder.
    pub placeholder: bool,
    /// Lane 2: the "entered" blur hint.
    pub blur_hint: bool,
    /// Lane 3: the all-selected hint.
    pub select_hint: bool,
}

/// Vue's three lane gates, verbatim — including the detail that the
/// all-selected hint is NOT gated on `revealing` (it keeps showing over a live
/// reveal; do not "fix" it, the Vue form does the same).
pub fn password_lanes(has_value: bool, feedback: PasswordFeedback, visible: bool) -> PasswordLanes {
    PasswordLanes {
        placeholder: (!has_value || (feedback.pending_clear && feedback.focused)) && !visible,
        blur_hint: has_value && !feedback.focused && !visible && !feedback.pending_clear,
        select_hint: feedback.focused && feedback.all_selected,
    }
}

/// Vue's `idlePlaceholder`: the caller's `placeholder` or the catalog default.
pub fn password_idle_placeholder(placeholder: &str) -> String {
    if placeholder.is_empty() {
        t(
            "components.hk.passwordInput.placeholderPassword",
            "Enter your password",
        )
    } else {
        placeholder.to_string()
    }
}

/// Vue's `resolvedPlaceholder`: the pending-clear text when an entered
/// password awaits the first keystroke, else the focused text, else the idle
/// placeholder.
pub fn password_resolved_placeholder(
    placeholder: &str,
    has_value: bool,
    feedback: PasswordFeedback,
) -> String {
    if feedback.pending_clear && has_value {
        t(
            "components.hk.passwordInput.focusedHasValuePlaceholder",
            "Focused, typing will clear the current password",
        )
    } else if feedback.focused {
        t(
            "components.hk.passwordInput.focusedPlaceholder",
            "Focused, enter your password",
        )
    } else {
        password_idle_placeholder(placeholder)
    }
}

// ── input sanitation (pending-clear + the full-width filter) ─────────────

/// What the surface publishes for one `input` event.
#[derive(Clone, PartialEq, Debug)]
pub struct PasswordValueChange {
    /// The value the host should store (`update:modelValue`).
    pub value: String,
    /// Vue sets `fullWidthPaused` on this branch (the `data-fw` marker and
    /// the hint line); the host folds it into `feedback.full_width`.
    pub dropped_full_width: bool,
}

/// Vue's `FW_RE` (`/[\uFF01-\uFF5E\u3000]/`): full-width ASCII forms plus the
/// ideographic space.
pub fn password_has_full_width(value: &str) -> bool {
    value
        .chars()
        .any(|ch| matches!(ch, '\u{3000}' | '\u{FF01}'..='\u{FF5E}'))
}

/// Vue's `v.replace(FW_RE, "")` — a NON-GLOBAL regex, so exactly ONE
/// full-width character is removed (the first). Kept verbatim: the two forms
/// must behave identically, quirk included.
pub fn password_strip_first_full_width(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut dropped = false;
    for ch in value.chars() {
        if !dropped && matches!(ch, '\u{3000}' | '\u{FF01}'..='\u{FF5E}') {
            dropped = true;
            continue;
        }
        out.push(ch);
    }
    out
}

/// Vue's pending-clear rule: while `pendingClear` is set the old password is
/// only a placeholder, so a typed run that EXTENDS it keeps just the new tail
/// and anything else starts over from empty.
pub fn password_pending_clear_next(previous: &str, offered: &str) -> String {
    if !previous.is_empty() && offered.starts_with(previous) && offered.len() > previous.len() {
        offered[previous.len()..].to_string()
    } else {
        String::new()
    }
}

/// The whole `input`-event transform: Vue's pending-clear branch, then the
/// full-width filter (which wins and reports `dropped_full_width`).
pub fn password_apply_input(
    previous: &str,
    offered: &str,
    pending_clear: bool,
) -> PasswordValueChange {
    let base = if pending_clear {
        password_pending_clear_next(previous, offered)
    } else {
        offered.to_string()
    };
    if password_has_full_width(&base) {
        PasswordValueChange {
            value: password_strip_first_full_width(&base),
            dropped_full_width: true,
        }
    } else {
        PasswordValueChange {
            value: base,
            dropped_full_width: false,
        }
    }
}

// ── the controlled feedback transitions ──────────────────────────────────

/// Vue's `onFocus` flags: focused, plus the pending-clear marker when an
/// entered password may be overwritten (never on a readonly or disabled
/// field). Every other flag is preserved.
pub fn password_focus_feedback(
    feedback: PasswordFeedback,
    has_value: bool,
    readonly: bool,
    disabled: bool,
) -> PasswordFeedback {
    PasswordFeedback {
        focused: true,
        pending_clear: has_value && !readonly && !disabled,
        ..feedback
    }
}

/// Vue's `onInput` flags: the pending-clear marker drops, the full-width pause
/// follows the sanitized value.
pub fn password_input_feedback(
    feedback: PasswordFeedback,
    dropped_full_width: bool,
) -> PasswordFeedback {
    PasswordFeedback {
        pending_clear: false,
        full_width: dropped_full_width,
        ..feedback
    }
}

// ── the submit gate ──────────────────────────────────────────────────────

/// Vue's Enter interception: a modifier-free Enter on an enabled, editable
/// field, and never while an IME composition is in flight. `composing` has no
/// `KeyboardEvent` field in tairitsu 0.5.22, so it comes from the composition
/// flag this module maintains (see [`password_is_composing`]).
///
/// Eight narrow parameters on purpose: the gate must stay a pure predicate so
/// it is testable without an event, and each one is a distinct Vue clause.
#[allow(clippy::too_many_arguments)]
pub fn password_enter_submits(
    key: &str,
    ctrl: bool,
    meta: bool,
    alt: bool,
    shift: bool,
    disabled: bool,
    readonly: bool,
    composing: bool,
) -> bool {
    key == "Enter" && !composing && !ctrl && !meta && !alt && !shift && !disabled && !readonly
}

thread_local! {
    /// Whether an IME composition is in flight on the field. tairitsu's
    /// `KeyboardEvent` has no `is_composing`, so the flag is maintained from
    /// the composition events (the same singleton call as `basic/otp_input.rs`;
    /// it never drives rendering).
    static PASSWORD_COMPOSING: Cell<bool> = const { Cell::new(false) };
}

/// Whether an IME composition is currently in flight.
pub fn password_is_composing() -> bool {
    PASSWORD_COMPOSING.with(|flag| flag.get())
}

fn set_password_composing(composing: bool) {
    PASSWORD_COMPOSING.with(|flag| flag.set(composing));
}

// ── the dot matrix ([D1]: static SVG instead of the canvas) ──────────────

/// Rows of the dot matrix (Vue: `ROWS = 3`).
pub const PASSWORD_DOT_ROWS: usize = 3;
/// Columns of the dot matrix. Vue starts at 11 and re-derives the count from
/// the measured box width on every resize; with no measurement API the mirror
/// pins Vue's initial 11 ([D1]).
pub const PASSWORD_DOT_COLS: usize = 11;

const PASSWORD_DOT_GAP: f64 = 8.0;
const PASSWORD_DOT_RADIUS: f64 = 2.2;
const PASSWORD_DOT_SIGMA: f64 = 2.8;
const PASSWORD_DOT_PAD: f64 = 3.2;
const PASSWORD_DOT_EMPTY_RESTING: f64 = 0.08;
const PASSWORD_DOT_EMPTY_FOCUSED: f64 = 0.18;
const PASSWORD_DOT_FILLED_RESTING: f64 = 0.35;
const PASSWORD_DOT_FILLED_FOCUSED: f64 = 0.55;

/// One painted dot: its position in the SVG's logical grid and its opacity.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct PasswordDot {
    pub x: f64,
    pub y: f64,
    pub opacity: f64,
}

/// Vue's dot-matrix pass, without the ripple animation and without the
/// measured geometry: the row-major grid with the gaussian falloff from the
/// grid centre (`exp(-d² / 2σ²)` times the resting/focused amplitude, or one
/// flat amplitude for an empty field).
pub fn password_dots(filled: bool, focused: bool) -> Vec<PasswordDot> {
    let center_col = (PASSWORD_DOT_COLS as f64 - 1.0) / 2.0;
    let center_row = (PASSWORD_DOT_ROWS as f64 - 1.0) / 2.0;
    let filled_amplitude = if focused {
        PASSWORD_DOT_FILLED_FOCUSED
    } else {
        PASSWORD_DOT_FILLED_RESTING
    };
    let empty_amplitude = if focused {
        PASSWORD_DOT_EMPTY_FOCUSED
    } else {
        PASSWORD_DOT_EMPTY_RESTING
    };
    let mut dots = Vec::with_capacity(PASSWORD_DOT_ROWS * PASSWORD_DOT_COLS);
    for row in 0..PASSWORD_DOT_ROWS {
        for col in 0..PASSWORD_DOT_COLS {
            let dx = col as f64 - center_col;
            let dy = row as f64 - center_row;
            let distance = (dx * dx + dy * dy).sqrt();
            let opacity = if filled {
                let radial = (-(distance * distance)
                    / (2.0 * PASSWORD_DOT_SIGMA * PASSWORD_DOT_SIGMA))
                    .exp();
                radial * filled_amplitude
            } else {
                empty_amplitude
            };
            dots.push(PasswordDot {
                x: PASSWORD_DOT_PAD + col as f64 * PASSWORD_DOT_GAP,
                y: PASSWORD_DOT_PAD + row as f64 * PASSWORD_DOT_GAP,
                opacity,
            });
        }
    }
    dots
}

/// The dot-matrix SVG string Vue's canvas paints, as markup for the
/// `display:contents` host ([D1]). It fills its box, keeps the grid's aspect
/// ratio (`xMidYMid meet`) and paints in `currentColor` (the box ink) — no
/// consumer string enters it, so there is nothing to escape.
pub fn password_dots_svg(filled: bool, focused: bool) -> String {
    let width = PASSWORD_DOT_PAD * 2.0 + (PASSWORD_DOT_COLS as f64 - 1.0) * PASSWORD_DOT_GAP;
    let height = PASSWORD_DOT_PAD * 2.0 + (PASSWORD_DOT_ROWS as f64 - 1.0) * PASSWORD_DOT_GAP;
    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" class="hk-pwd-dot-matrix" aria-hidden="true">"#
    );
    for dot in password_dots(filled, focused) {
        svg.push_str(&format!(
            r#"<circle cx="{:.1}" cy="{:.1}" r="{PASSWORD_DOT_RADIUS}" fill="currentColor" fill-opacity="{:.3}"></circle>"#,
            dot.x, dot.y, dot.opacity
        ));
    }
    svg.push_str("</svg>");
    svg
}

// ── classes / data flags ─────────────────────────────────────────────────

/// Push a class onto a space-separated class list.
fn push_class(classes: &mut String, class: &str) {
    if class.is_empty() {
        return;
    }
    if !classes.is_empty() {
        classes.push(' ');
    }
    classes.push_str(class);
}

/// The box's class list: `hk-pwd-box`, the size step, then the host class.
pub fn password_box_classes(size: PasswordSize, extra: &str) -> String {
    let mut classes = String::from("hk-pwd-box");
    push_class(&mut classes, size.class_name());
    push_class(&mut classes, extra);
    classes
}

/// The lock's class list: the base, the filled/empty ink, and the
/// interactive-plane marker a caller prefix lifts the box to.
pub fn password_lock_classes(has_value: bool, custom: bool) -> String {
    let mut classes = String::from("hk-pwd-lock");
    push_class(
        &mut classes,
        if has_value {
            "hk-pwd-lock-filled"
        } else {
            "hk-pwd-lock-empty"
        },
    );
    if custom {
        push_class(&mut classes, "hk-pwd-lock-custom");
    }
    classes
}

/// The four `data-*` markers on `.hk-pwd-box`. Vue writes
/// `data-x={flag || undefined}`, so a set flag is the ATTRIBUTE'S presence:
/// `Some("true")` emits `data-x="true"`, `None` omits it entirely. (Vue's own
/// empty-string spelling and this one are interchangeable for the sheet's
/// `[data-x]` presence selectors; `"true"` is the mirror wave's marker
/// convention, `overlay/popup_select.rs`'s `marker_attr`.)
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct PasswordBoxFlags {
    pub focused: Option<&'static str>,
    pub error: Option<&'static str>,
    pub disabled: Option<&'static str>,
    pub full_width: Option<&'static str>,
}

fn password_flag(set: bool) -> Option<&'static str> {
    if set { Some("true") } else { None }
}

/// The box's `data-*` markers: focused, error, disabled, full-width.
pub fn password_box_flags(
    feedback: PasswordFeedback,
    error: bool,
    disabled: bool,
) -> PasswordBoxFlags {
    PasswordBoxFlags {
        focused: password_flag(feedback.focused),
        error: password_flag(error),
        disabled: password_flag(disabled),
        full_width: password_flag(feedback.full_width),
    }
}

// ── glyphs (trusted static markup, [D1] / L49) ───────────────────────────

/// Vue's built-in lock glyph, byte-identical to `HkPasswordSurface.tsx`'s
/// inline svg (lucide `lock`, 16px, no class of its own).
const PASSWORD_LOCK_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>"#;

/// `<Eye size={15} />` (lucide 1.0.0, ISC) in the crate's inlined-lucide
/// spelling.
const PASSWORD_EYE_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle></svg>"#;

/// `<EyeOff size={15} />` (lucide 1.0.0, ISC) in the same spelling.
const PASSWORD_EYE_OFF_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off-icon lucide-eye-off" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"></path><path d="m2 2 20 20"></path></svg>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// True when a slot carries nothing to render (Vue treats a comment-only or
/// absent slot as "no caller content").
fn slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

/// Vue's slot presence test for an optional slot.
fn slot_provided(node: &Option<Element>) -> bool {
    match node {
        Some(node) => !slot_is_empty(node),
        None => false,
    }
}

// ── the publish bundle ───────────────────────────────────────────────────

/// Everything the surface's handlers need, cloned once per handler so the
/// render tree never reaches back for the props (`Callback` is cloneable).
#[derive(Clone)]
struct PasswordPublish {
    on_value_change: Option<EventHandler<String>>,
    on_feedback_change: Option<EventHandler<PasswordFeedback>>,
    on_visibility_change: Option<EventHandler<bool>>,
    on_clear: Option<EventHandler<()>>,
    on_focus_request: Option<EventHandler<()>>,
    submit_on_enter: Option<EventHandler<()>>,
    on_keydown: Option<EventHandler<KeyboardEvent>>,
    on_focus: Option<EventHandler<FocusEvent>>,
    on_blur: Option<EventHandler<FocusEvent>>,
    previous: String,
    feedback: PasswordFeedback,
    disabled: bool,
    readonly: bool,
    gate: PasswordRevealGate,
}

impl PasswordPublish {
    fn publish_feedback(&self, next: PasswordFeedback) {
        if let Some(handler) = self.on_feedback_change.as_ref() {
            handler.call(next);
        }
    }

    fn publish_visibility(&self, next: bool) {
        if let Some(handler) = self.on_visibility_change.as_ref() {
            handler.call(next);
        }
    }

    /// Vue's `onInput`: the pending-clear transform, the full-width filter,
    /// then `update:modelValue` + the flag update.
    fn input(&self, event: InputEvent) {
        let change = password_apply_input(&self.previous, &event.data, self.feedback.pending_clear);
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(change.value.clone());
        }
        self.publish_feedback(password_input_feedback(
            self.feedback,
            change.dropped_full_width,
        ));
    }

    /// Vue's `onFocus`: the focused flag plus the pending-clear marker, then
    /// the `focus` emit.
    fn focus(&self, event: FocusEvent) {
        self.publish_feedback(password_focus_feedback(
            self.feedback,
            !self.previous.is_empty(),
            self.readonly,
            self.disabled,
        ));
        if let Some(handler) = self.on_focus.as_ref() {
            handler.call(event);
        }
    }

    /// Vue's `onBlur`: every transient flag drops (its refocus / autofill
    /// polling has no analogue, see [D8]), then the `blur` emit.
    fn blur(&self, event: FocusEvent) {
        self.publish_feedback(PasswordFeedback::blurred());
        if let Some(handler) = self.on_blur.as_ref() {
            handler.call(event);
        }
    }

    /// Vue's Enter interception, then the `keydown` emit.
    fn key(&self, event: KeyboardEvent) {
        if password_enter_submits(
            &event.key,
            event.ctrl_key,
            event.meta_key,
            event.alt_key,
            event.shift_key,
            self.disabled,
            self.readonly,
            password_is_composing(),
        ) {
            event.prevent_default();
            if let Some(handler) = self.submit_on_enter.as_ref() {
                handler.call(());
            }
        }
        if let Some(handler) = self.on_keydown.as_ref() {
            handler.call(event);
        }
    }

    /// A press on the eye (pointer or keyboard): Vue's `startReveal` /
    /// `toggleReveal` branch.
    fn reveal_press(&self) {
        if let Some(next) = password_reveal_intent(&self.gate) {
            self.publish_visibility(next);
        }
    }

    /// A release on the eye: `hold` hides, `toggle` keeps (see [D2]).
    fn reveal_release(&self) {
        if let Some(next) = password_reveal_release(&self.gate) {
            self.publish_visibility(next);
        }
    }

    /// Vue's `onPointerdown` on the eye: no focus steal.
    fn eye_pointer(&self, event: PointerEvent) {
        event.prevent_default();
        self.reveal_press();
    }

    /// Vue's eye `onKeydown`: Space / Enter only, and held-key auto-repeat is
    /// dropped (it would flap a toggle).
    fn eye_key(&self, event: KeyboardEvent) {
        if !matches!(event.key.as_str(), " " | "Enter") || event.repeat {
            return;
        }
        event.prevent_default();
        self.reveal_press();
    }

    /// Vue's eye `onKeyup`: only a hold-mode reveal ends.
    fn eye_key_release(&self, event: KeyboardEvent) {
        if !matches!(event.key.as_str(), " " | "Enter") {
            return;
        }
        event.prevent_default();
        self.reveal_release();
    }

    /// Vue's blur-hint tap (`clearAndFocus`): clear the value AND refocus.
    fn clear_request(&self) {
        if let Some(handler) = self.on_clear.as_ref() {
            handler.call(());
        }
    }

    /// Vue's placeholder tap: refocus the invisible input.
    fn focus_request(&self) {
        if let Some(handler) = self.on_focus_request.as_ref() {
            handler.call(());
        }
    }
}

// ── props ────────────────────────────────────────────────────────────────

#[define_props]
pub struct PasswordSurfaceProps {
    /// The controlled value (Vue: `modelValue`).
    #[default]
    pub value: String,

    /// The controlled reveal state (Vue: the internal `revealing` ref). The
    /// surface never flips it itself — it publishes the intent through
    /// `on_visibility_change` ([D4] keeps the input `type="password"`).
    #[default]
    pub visible: bool,

    /// The controlled transient flag bundle (focus, caps-lock, full-width,
    /// all-selected, pending-clear).
    #[default]
    pub feedback: PasswordFeedback,

    /// Idle placeholder text (Vue: `placeholder`). Empty falls back to the
    /// catalog's "Enter your password".
    pub placeholder: Option<String>,

    #[default]
    pub disabled: bool,

    #[default]
    pub readonly: bool,

    #[default]
    pub required: bool,

    /// Error ink on the box (Vue: `error`; the message itself is HkInput's).
    #[default]
    pub error: bool,

    /// Native `name` attribute.
    pub name: Option<String>,

    /// Native `autocomplete`; `None` renders Vue's browser default `"off"`
    /// (see [D6] — the runtime credential policy is the host's call).
    pub autocomplete: Option<String>,

    /// The id the invisible input owns (Vue: `id`; no id is generated).
    pub id: Option<String>,

    #[default]
    pub size: PasswordSize,

    #[default]
    pub trailing: PasswordTrailing,

    /// Reveal interaction mode (hold / toggle).
    #[default]
    pub reveal_trigger: PasswordRevealTrigger,

    /// The host classifier's verdict (Vue: the `strengthEvaluator` prop, [D5]);
    /// `None` uses [`password_level`].
    pub host_strength: Option<PasswordLevel>,

    /// Submit intent on a modifier-free Enter (Vue: `submitOnEnter`).
    pub submit_on_enter: Option<EventHandler<()>>,

    /// Prefix slot (Vue: `#prefix`); wins over `prefix_icon` and replaces the
    /// built-in lock.
    pub prefix: Option<Element>,

    /// Prefix icon slot (Vue: `#prefixIcon`).
    pub prefix_icon: Option<Element>,

    /// Suffix slot (Vue: `#suffix`); wins over `suffix_icon` and stands the
    /// built-in eye / strength dot down.
    pub suffix: Option<Element>,

    /// Suffix icon slot (Vue: `#suffixIcon`).
    pub suffix_icon: Option<Element>,

    /// The revealed glyphs, rendered while `visible` (the canvas replacement,
    /// [D1]). No wrapper element is added: the host's node owns its own
    /// positioning (the sheet's overlay lanes are `position: absolute`).
    pub reveal_content: Option<Element>,

    /// Host class, appended to `.hk-pwd-box`.
    #[default]
    pub class: String,

    /// Host style attribute on `.hk-pwd-box` (Vue: the fallthrough `style`).
    #[default]
    pub style: String,

    /// Vue: `update:modelValue`, emitted with the sanitized value.
    pub on_value_change: Option<EventHandler<String>>,

    /// The flag transitions the surface can derive itself (input / focus /
    /// blur): store the bundle and pass it back in.
    pub on_feedback_change: Option<EventHandler<PasswordFeedback>>,

    /// The reveal intent (`true` = show, `false` = hide).
    pub on_visibility_change: Option<EventHandler<bool>>,

    /// The blur-hint click: clear the value and focus the field.
    pub on_clear: Option<EventHandler<()>>,

    /// A placeholder tap: focus the field (Vue calls `input.focus()`).
    pub on_focus_request: Option<EventHandler<()>>,

    /// Vue: the `focus` emit.
    pub on_focus: Option<EventHandler<FocusEvent>>,

    /// Vue: the `blur` emit.
    pub on_blur: Option<EventHandler<FocusEvent>>,

    /// Vue: the `keydown` emit, forwarded after the Enter interception.
    pub on_keydown: Option<EventHandler<KeyboardEvent>>,
}

// ── the component ────────────────────────────────────────────────────────

#[component]
pub fn PasswordSurface(props: PasswordSurfaceProps) -> Element {
    let value = props.value.clone();
    let has_value = !value.is_empty();
    let feedback = props.feedback;

    let prefix_provided = slot_provided(&props.prefix);
    let prefix_icon_provided = slot_provided(&props.prefix_icon);
    let suffix_provided = slot_provided(&props.suffix);
    let suffix_icon_provided = slot_provided(&props.suffix_icon);
    let has_custom_prefix = prefix_provided || prefix_icon_provided;
    let has_custom_suffix = suffix_provided || suffix_icon_provided;

    let gate = password_reveal_gate(
        props.trailing,
        props.reveal_trigger,
        &value,
        props.disabled,
        props.visible,
        has_custom_suffix,
    );
    let lanes = password_lanes(has_value, feedback, props.visible);
    let placeholder_text = password_resolved_placeholder(
        props.placeholder.as_deref().unwrap_or(""),
        has_value,
        feedback,
    );
    let strength = password_strength_level(props.trailing, &value, props.host_strength);
    let show_strength = password_show_strength(props.trailing, strength, has_custom_suffix);
    let box_flags = password_box_flags(feedback, props.error, props.disabled);
    let box_classes = password_box_classes(props.size, &props.class);
    let lock_classes = password_lock_classes(has_value, has_custom_prefix);
    let dots_svg = password_dots_svg(has_value, feedback.focused);

    let caps_text = t("components.hk.passwordInput.capsLock", "Caps Lock is on");
    let full_width_text = t(
        "components.hk.passwordInput.fullWidth",
        "Full-width characters not allowed",
    );
    let entered_text = t(
        "components.hk.passwordInput.passwordEntered",
        "Entered, click to focus and clear the existing password",
    );
    let selected_text = t("components.hk.passwordInput.allSelected", "All selected");
    let eye_label = t(gate.label_key, gate.label_fallback);
    let strength_tooltip = password_strength_tooltip(strength);

    // Slot resolution, in Vue's precedence order.
    let lock_content = if prefix_provided {
        props.prefix.clone().unwrap_or_else(empty_vnode)
    } else if prefix_icon_provided {
        props.prefix_icon.clone().unwrap_or_else(empty_vnode)
    } else {
        glyph_host(PASSWORD_LOCK_SVG)
    };
    let suffix_content = if has_custom_suffix {
        Some(if suffix_provided {
            props.suffix.clone().unwrap_or_else(empty_vnode)
        } else {
            props.suffix_icon.clone().unwrap_or_else(empty_vnode)
        })
    } else {
        None
    };
    // [D1]: the reveal is host content, and only while revealed.
    let reveal_content = if props.visible {
        props.reveal_content.clone()
    } else {
        None
    };
    let strength_content = if show_strength {
        strength.map(|level| {
            rsx! {
                Tooltip {
                    text: strength_tooltip.clone(),
                    placement: TooltipPlacement::Top,
                    delay: 150,
                    children: rsx! {
                        span {
                            class: "hk-pwd-strength",
                            "data-level": level.token(),
                            "role": "img",
                            "aria-label": strength_tooltip.clone(),
                        }
                    },
                }
            }
        })
    } else {
        None
    };
    let eye_glyph = if props.visible {
        PASSWORD_EYE_OFF_SVG
    } else {
        PASSWORD_EYE_SVG
    };

    let publish = PasswordPublish {
        on_value_change: props.on_value_change.clone(),
        on_feedback_change: props.on_feedback_change.clone(),
        on_visibility_change: props.on_visibility_change.clone(),
        on_clear: props.on_clear.clone(),
        on_focus_request: props.on_focus_request.clone(),
        submit_on_enter: props.submit_on_enter.clone(),
        on_keydown: props.on_keydown.clone(),
        on_focus: props.on_focus.clone(),
        on_blur: props.on_blur.clone(),
        previous: value.clone(),
        feedback,
        disabled: props.disabled,
        readonly: props.readonly,
        gate,
    };

    let oninput_events = publish.clone();
    let oninput = move |event: InputEvent| oninput_events.input(event);
    let onfocus_events = publish.clone();
    let onfocus = move |event: FocusEvent| onfocus_events.focus(event);
    let onblur_events = publish.clone();
    let onblur = move |event: FocusEvent| onblur_events.blur(event);
    let onkeydown_events = publish.clone();
    let onkeydown = move |event: KeyboardEvent| onkeydown_events.key(event);
    let composition_start = move |_event: Box<dyn EventData>| set_password_composing(true);
    let composition_end = move |_event: Box<dyn EventData>| set_password_composing(false);

    let eye_press_events = publish.clone();
    let eye_press = move |event: PointerEvent| eye_press_events.eye_pointer(event);
    let eye_release_events = publish.clone();
    let eye_release = move |_event: PointerEvent| eye_release_events.reveal_release();
    let eye_key_events = publish.clone();
    let eye_key = move |event: KeyboardEvent| eye_key_events.eye_key(event);
    let eye_key_release_events = publish.clone();
    let eye_key_release = move |event: KeyboardEvent| eye_key_release_events.eye_key_release(event);

    let placeholder_press_events = publish.clone();
    let placeholder_press = move |event: PointerEvent| {
        event.prevent_default();
        placeholder_press_events.focus_request();
    };
    let blur_hint_press_events = publish.clone();
    let blur_hint_press = move |event: PointerEvent| {
        event.prevent_default();
        blur_hint_press_events.clear_request();
    };

    let show_eye = gate.show_eye;
    let revealing_flag = if props.visible { Some("true") } else { None };
    let autocomplete = props
        .autocomplete
        .clone()
        .unwrap_or_else(|| "off".to_string());
    let style_attr = if props.style.is_empty() {
        None
    } else {
        Some(props.style.clone())
    };
    let disabled = props.disabled;
    let readonly = props.readonly;
    let required = props.required;

    rsx! {
        div {
            class: box_classes,
            style: style_attr,
            "data-focused": box_flags.focused,
            "data-error": box_flags.error,
            "data-disabled": box_flags.disabled,
            "data-fw": box_flags.full_width,
            div { class: lock_classes,
                {lock_content}
            }
            div {
                class: "hk-pwd-dots",
                // [D1]: the static dot matrix replaces the canvas; the markup
                // travels through the crate-wide display:contents host (L49).
                span { style: "display:contents", dangerous_inner_html: dots_svg }
            }
            if lanes.placeholder {
                span {
                    class: "hk-pwd-placeholder",
                    onpointerdown: placeholder_press,
                    span { class: "hk-pwd-placeholder-text",
                        "{placeholder_text}"
                    }
                }
            }
            if lanes.blur_hint {
                span {
                    class: "hk-pwd-blur-hint",
                    onpointerdown: blur_hint_press,
                    "{entered_text}"
                }
            }
            if lanes.select_hint {
                span { class: "hk-pwd-select-hint",
                    "{selected_text}"
                }
            }
            // [D1]: the revealed glyphs are host content, painted where Vue's
            // canvas reveal pass would be — after the text lanes, before the
            // invisible input.
            if let Some(node) = reveal_content {
                {node}
            }
            input {
                class: "hk-pwd-input",
                "type": "password",
                "value": value.clone(),
                "name": props.name.clone(),
                "id": props.id.clone(),
                "autocomplete": autocomplete,
                "data-1p-ignore": Some(""),
                "data-lpignore": Some("true"),
                disabled: disabled,
                readonly: readonly,
                required: required,
                oninput: oninput,
                onfocus: onfocus,
                onblur: onblur,
                onkeydown: onkeydown,
                oncompositionstart: composition_start,
                oncompositionend: composition_end,
            }
            if let Some(node) = strength_content {
                {node}
            }
            if show_eye {
                button {
                    class: "hk-pwd-eye",
                    "type": "button",
                    "data-revealing": revealing_flag,
                    "aria-label": eye_label,
                    onpointerdown: eye_press,
                    onpointerup: eye_release,
                    onkeydown: eye_key,
                    onkeyup: eye_key_release,
                    {glyph_host(eye_glyph)}
                }
            }
            if let Some(node) = suffix_content {
                span { class: "hk-pwd-suffix",
                    {node}
                }
            }
        }
        div {
            class: "hk-pwd-hints",
            div {
                if feedback.caps_lock {
                    span {
                        class: "hk-pwd-hint",
                        "data-variant": "caps",
                        "{caps_text}"
                    }
                }
            }
            div {
                if feedback.full_width {
                    span {
                        class: "hk-pwd-hint",
                        "data-variant": "fw",
                        "{full_width_text}"
                    }
                }
            }
        }
    }
}

impl StyledComponent for PasswordSurfaceComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-pwd*` names literal so this CSS matches the Vue build). The
        // sheet `@use`s HkPlaceholderMarquee + HkIconButtonVars-style shared
        // layers, so the closure table carries those rows too.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPasswordSurface.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "password-surface"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── the pure layer ───────────────────────────────────────────────────

    #[test]
    fn password_level_matches_the_vue_classifier() {
        assert_eq!(password_level(""), None);
        assert_eq!(password_level("hunter2"), Some(PasswordLevel::Weak));
        assert_eq!(password_level("Password1"), Some(PasswordLevel::Fair));
        assert_eq!(
            password_level("Str0ng!Passw0rd"),
            Some(PasswordLevel::Strong)
        );
        // Exactly 8 letters + digits is the fair floor.
        assert_eq!(password_level("abcdefg1"), Some(PasswordLevel::Fair));
        assert_eq!(password_level("abcdef1"), Some(PasswordLevel::Weak));
        // Strong needs the special character too.
        assert_eq!(password_level("Password12"), Some(PasswordLevel::Fair));
    }

    #[test]
    fn password_strength_level_honours_the_affordance_and_the_host_override() {
        // Vue: no indicator unless the affordance is the strength dot.
        assert_eq!(
            password_strength_level(PasswordTrailing::Eye, "Password1", None),
            None
        );
        // …and none for an empty value.
        assert_eq!(
            password_strength_level(PasswordTrailing::Strength, "", None),
            None
        );
        assert_eq!(
            password_strength_level(PasswordTrailing::Strength, "Password1", None),
            Some(PasswordLevel::Fair)
        );
        // The host classifier wins (Vue: `strengthEvaluator ?? passwordLevel`).
        assert_eq!(
            password_strength_level(
                PasswordTrailing::Strength,
                "Password1",
                Some(PasswordLevel::Strong)
            ),
            Some(PasswordLevel::Strong)
        );
    }

    #[test]
    fn password_strength_tooltip_reads_the_localized_label() {
        assert_eq!(
            password_strength_tooltip(Some(PasswordLevel::Weak)),
            "Password strength: Weak"
        );
        assert_eq!(
            password_strength_tooltip(Some(PasswordLevel::Strong)),
            "Password strength: Strong"
        );
        assert_eq!(password_strength_tooltip(None), "");
        assert_eq!(PasswordLevel::Fair.token(), "fair");
        assert_eq!(PasswordLevel::Strong.label_fallback(), "Strong");
    }

    #[test]
    fn password_rule_table_reports_the_three_vue_rules() {
        let policy = PasswordPolicy::default();
        let table = password_rule_table("Password1", "Password1", &policy);
        assert_eq!(table.len(), 3);
        assert!(table.iter().all(|state| state.passed));
        assert_eq!(table[0].rule, PasswordRule::Match);
        assert_eq!(table[1].rule, PasswordRule::MinLength);
        assert_eq!(table[2].rule, PasswordRule::Variety);

        // Each rule can fail on its own.
        let mismatch = password_rule_table("Password1", "Password2", &policy);
        assert!(!mismatch[0].passed && mismatch[1].passed && mismatch[2].passed);
        let short = password_rule_table("Pass01", "Pass01", &policy);
        assert!(short[0].passed && !short[1].passed && short[2].passed);
        let letters_only = password_rule_table("Password", "Password", &policy);
        assert!(letters_only[0].passed && letters_only[1].passed && !letters_only[2].passed);
    }

    #[test]
    fn password_validation_returns_vues_first_failure() {
        let policy = PasswordPolicy::default();
        assert_eq!(password_validation("Password1", "Password1", &policy), None);
        assert_eq!(
            password_validation("Password1", "Password2", &policy),
            Some(PasswordRule::Match)
        );
        assert_eq!(
            password_validation("Pass1", "Pass1", &policy),
            Some(PasswordRule::MinLength)
        );
        assert_eq!(
            password_validation("Password", "Password", &policy),
            Some(PasswordRule::Variety)
        );
        // Vue's errorKey leaves, under the caller's prefix.
        assert_eq!(
            password_error_key(PasswordRule::Match, "common.validation"),
            "common.validation.passwordMismatch"
        );
        assert_eq!(
            password_error_key(PasswordRule::MinLength, "forms"),
            "forms.minLength"
        );
        assert_eq!(
            password_error_key(PasswordRule::Variety, "forms"),
            "forms.passwordNeedsVariety"
        );
        assert_eq!(PasswordRule::Match.token(), "mismatch");
    }

    #[test]
    fn password_candidates_are_deterministic_and_pass_the_policy() {
        let policy = PasswordPolicy::default();
        let first = password_candidates(&policy, 7, 4);
        let again = password_candidates(&policy, 7, 4);
        let other = password_candidates(&policy, 8, 4);
        assert_eq!(first.len(), 4);
        assert_eq!(first, again, "the same seed must reproduce the list");
        assert_ne!(first, other, "a different seed must move the list");
        for candidate in &first {
            assert!(
                policy.accepts(candidate),
                "candidate {candidate:?} must satisfy the default policy"
            );
            assert_eq!(
                password_level(candidate),
                Some(PasswordLevel::Strong),
                "candidate {candidate:?} must read as strong"
            );
            // Length floor: the generator never goes below its own minimum.
            assert!(candidate.chars().count() >= PASSWORD_CANDIDATE_LENGTH);
        }
        // Empty request: no candidates, no panic.
        assert!(password_candidates(&policy, 1, 0).is_empty());
        // A tighter length policy raises the generated length.
        let strict = PasswordPolicy {
            min_length: 20,
            ..PasswordPolicy::default()
        };
        for candidate in password_candidates(&strict, 3, 2) {
            assert!(candidate.chars().count() >= 20);
            assert!(strict.accepts(&candidate));
        }
    }

    #[test]
    fn password_reveal_gate_mirrors_the_vue_guards() {
        let gate = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Hold,
            "secret",
            false,
            false,
            false,
        );
        assert!(gate.show_eye && gate.can_reveal && !gate.toggle);
        assert_eq!(gate.label_fallback, "Hold to show password");
        // No reveal without a value, and none on a disabled field.
        assert!(
            !password_reveal_gate(
                PasswordTrailing::Eye,
                PasswordRevealTrigger::Hold,
                "",
                false,
                false,
                false
            )
            .can_reveal
        );
        assert!(
            !password_reveal_gate(
                PasswordTrailing::Eye,
                PasswordRevealTrigger::Hold,
                "secret",
                true,
                false,
                false
            )
            .can_reveal
        );
        // A caller suffix stands the eye down; disabled hides it outright.
        assert!(
            !password_reveal_gate(
                PasswordTrailing::Eye,
                PasswordRevealTrigger::Hold,
                "secret",
                false,
                false,
                true
            )
            .show_eye
        );
        assert!(
            !password_reveal_gate(
                PasswordTrailing::Eye,
                PasswordRevealTrigger::Hold,
                "secret",
                true,
                false,
                false
            )
            .show_eye
        );
        // `strength` never renders the eye; `readonly` keeps the reveal.
        assert!(
            !password_reveal_gate(
                PasswordTrailing::Strength,
                PasswordRevealTrigger::Hold,
                "secret",
                false,
                false,
                false
            )
            .show_eye
        );
    }

    #[test]
    fn password_reveal_gate_toggles_and_labels_like_vue() {
        // Vue's toggle labels follow the live state; hold has ONE label.
        let toggle = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Toggle,
            "secret",
            false,
            false,
            false,
        );
        assert!(toggle.toggle);
        assert_eq!(toggle.label_key, "components.hk.input.showPassword");
        assert_eq!(toggle.label_fallback, "Show password");
        // A visible toggle speaks "Hide password" and flips off.
        let visible_toggle = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Toggle,
            "secret",
            false,
            true,
            false,
        );
        assert_eq!(visible_toggle.label_key, "components.hk.input.hidePassword");
        assert_eq!(visible_toggle.label_fallback, "Hide password");
        assert_eq!(password_reveal_intent(&toggle), Some(true));
        assert_eq!(password_reveal_intent(&visible_toggle), Some(false));

        // A hold gate keeps its single label in BOTH states.
        let hold = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Hold,
            "secret",
            false,
            false,
            false,
        );
        let hold_visible = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Hold,
            "secret",
            false,
            true,
            false,
        );
        assert_eq!(hold.label_key, hold_visible.label_key);
        assert_eq!(hold.label_fallback, "Hold to show password");
        // A hold press always shows; a release hides a live reveal.
        assert_eq!(password_reveal_intent(&hold_visible), Some(true));
        assert_eq!(password_reveal_release(&hold_visible), Some(false));
        assert_eq!(password_reveal_release(&hold), None);
        // A toggle release publishes nothing (Vue wires no release handler).
        assert_eq!(password_reveal_release(&visible_toggle), None);

        // A refused gate publishes nothing at all.
        let refused = password_reveal_gate(
            PasswordTrailing::Eye,
            PasswordRevealTrigger::Toggle,
            "",
            false,
            false,
            false,
        );
        assert_eq!(password_reveal_intent(&refused), None);
        assert_eq!(password_reveal_release(&refused), None);
    }

    #[test]
    fn password_lanes_follow_the_vue_ternaries() {
        // Empty, idle: the placeholder breathes.
        let idle = password_lanes(false, PasswordFeedback::default(), false);
        assert!(idle.placeholder && !idle.blur_hint && !idle.select_hint);
        // Focused with a value and no pending clear: the entered hint shows.
        let entered = password_lanes(
            true,
            PasswordFeedback {
                focused: true,
                ..PasswordFeedback::default()
            },
            false,
        );
        assert!(!entered.placeholder && !entered.blur_hint);
        let waiting = password_lanes(true, PasswordFeedback::default(), false);
        assert!(waiting.blur_hint && !waiting.placeholder);
        // A live reveal stands both text lanes down…
        let revealed = password_lanes(true, PasswordFeedback::default(), true);
        assert!(!revealed.placeholder && !revealed.blur_hint);
        // …but the all-selected hint keeps showing (Vue has no reveal gate).
        let selected = password_lanes(
            true,
            PasswordFeedback {
                focused: true,
                all_selected: true,
                ..PasswordFeedback::default()
            },
            true,
        );
        assert!(selected.select_hint);
        // Pending clear keeps the placeholder up even while focused.
        let pending = password_lanes(
            true,
            PasswordFeedback {
                focused: true,
                pending_clear: true,
                ..PasswordFeedback::default()
            },
            false,
        );
        assert!(pending.placeholder && !pending.blur_hint);
    }

    #[test]
    fn password_placeholders_resolve_like_vue() {
        // Idle: the caller's text, or the catalog default.
        assert_eq!(password_idle_placeholder("PIN"), "PIN");
        assert_eq!(password_idle_placeholder(""), "Enter your password");
        // Focused: the waiting-for-input text.
        assert_eq!(
            password_resolved_placeholder(
                "PIN",
                false,
                PasswordFeedback {
                    focused: true,
                    ..PasswordFeedback::default()
                }
            ),
            "Focused, enter your password"
        );
        // Pending clear with a value: the "typing clears it" text.
        assert_eq!(
            password_resolved_placeholder(
                "PIN",
                true,
                PasswordFeedback {
                    focused: true,
                    pending_clear: true,
                    ..PasswordFeedback::default()
                }
            ),
            "Focused, typing will clear the current password"
        );
        // Pending clear without a value cannot happen; the focused text wins.
        assert_eq!(
            password_resolved_placeholder(
                "PIN",
                false,
                PasswordFeedback {
                    focused: true,
                    pending_clear: true,
                    ..PasswordFeedback::default()
                }
            ),
            "Focused, enter your password"
        );
    }

    #[test]
    fn password_input_applies_pending_clear_then_the_full_width_filter() {
        // Typing past the stored password keeps only the new tail.
        assert_eq!(password_pending_clear_next("secret", "secret2"), "2");
        // Anything else starts over.
        assert_eq!(password_pending_clear_next("secret", "x"), "");
        assert_eq!(password_pending_clear_next("", "x"), "");

        let append = password_apply_input("secret", "secret!", true);
        assert_eq!(append.value, "!");
        assert!(!append.dropped_full_width);
        let restart = password_apply_input("secret", "n", true);
        assert_eq!(restart.value, "");
        // Not pending: the offered text is the value.
        let plain = password_apply_input("secret", "other", false);
        assert_eq!(plain.value, "other");

        // The full-width branch wins over the offered text and reports it.
        assert!(password_has_full_width("Ａ"));
        assert!(password_has_full_width("\u{3000}"));
        assert!(!password_has_full_width("A"));
        let filtered = password_apply_input("", "ＡＢc", false);
        // Vue's `replace` is non-global: exactly one character is dropped.
        assert_eq!(filtered.value, "Ｂc");
        assert!(filtered.dropped_full_width);
    }

    #[test]
    fn password_feedback_transitions_match_the_vue_handlers() {
        // Focus on a filled, editable field arms the pending clear.
        let focused = password_focus_feedback(PasswordFeedback::default(), true, false, false);
        assert!(focused.focused && focused.pending_clear);
        // Readonly / disabled never arm it (Vue keeps the value intact).
        assert!(
            !password_focus_feedback(PasswordFeedback::default(), true, true, false).pending_clear
        );
        assert!(
            !password_focus_feedback(PasswordFeedback::default(), true, false, true).pending_clear
        );
        // An empty field has nothing to clear.
        assert!(
            !password_focus_feedback(PasswordFeedback::default(), false, false, false)
                .pending_clear
        );

        // Input drops the pending-clear marker and takes the full-width flag.
        let typed = password_input_feedback(focused, false);
        assert!(!typed.pending_clear && !typed.full_width && typed.focused);
        let paused = PasswordFeedback {
            full_width: true,
            ..PasswordFeedback::default()
        };
        let blocked = password_input_feedback(paused, false);
        assert!(
            !blocked.full_width,
            "the flag clears with the next clean input"
        );
        let dropped = password_input_feedback(PasswordFeedback::default(), true);
        assert!(dropped.full_width);

        // Blur clears every transient flag (Vue's onBlur reset).
        let blurred = PasswordFeedback::blurred();
        assert_eq!(blurred, PasswordFeedback::default());
    }

    #[test]
    fn password_enter_gate_mirrors_the_vue_modifier_set() {
        let open = |key: &str| {
            password_enter_submits(key, false, false, false, false, false, false, false)
        };
        assert!(open("Enter"));
        // Every modifier blocks it, and so does an IME composition.
        assert!(!password_enter_submits(
            "Enter", false, false, false, true, false, false, false
        ));
        assert!(!password_enter_submits(
            "Enter", true, false, false, false, false, false, false
        ));
        assert!(!password_enter_submits(
            "Enter", false, true, false, false, false, false, false
        ));
        assert!(!password_enter_submits(
            "Enter", false, false, true, false, false, false, false
        ));
        assert!(!password_enter_submits(
            "Enter", false, false, false, false, true, false, false
        ));
        assert!(!password_enter_submits(
            "Enter", false, false, false, false, false, true, false
        ));
        assert!(!password_enter_submits(
            "Enter", false, false, false, false, false, false, true
        ));
        // Any other key is not a submit.
        assert!(!open("a"));
        assert!(!open("NumpadEnter"));
        // The composition flag round-trips through the thread-local cell.
        assert!(!password_is_composing());
        set_password_composing(true);
        assert!(password_is_composing());
        // The gate takes the flag explicitly (the helper is pure); the
        // thread-local only feeds it at the call site.
        assert!(!password_enter_submits(
            "Enter", false, false, false, false, false, false, true
        ));
        set_password_composing(false);
        assert!(!password_is_composing());
    }

    #[test]
    fn password_dots_build_the_static_matrix() {
        let empty = password_dots(false, false);
        assert_eq!(empty.len(), PASSWORD_DOT_ROWS * PASSWORD_DOT_COLS);
        // An empty idle field paints one flat dim amplitude.
        assert!(empty.iter().all(|dot| (dot.opacity - 0.08).abs() < 1e-9));
        // Focus brightens it.
        let focused_empty = password_dots(false, true);
        assert!(
            focused_empty
                .iter()
                .all(|dot| (dot.opacity - 0.18).abs() < 1e-9)
        );

        let filled = password_dots(true, false);
        let centre = filled[PASSWORD_DOT_ROWS / 2 * PASSWORD_DOT_COLS + PASSWORD_DOT_COLS / 2];
        let corner = filled[0];
        assert!(
            centre.opacity > corner.opacity,
            "the gaussian falloff peaks mid-grid"
        );
        assert!(corner.opacity > 0.0);
        assert!(centre.opacity <= 0.35 + 1e-9);

        // The markup is self-contained, escaped-by-construction (numbers only)
        // and carries one circle per dot.
        let svg = password_dots_svg(true, true);
        assert!(svg.starts_with("<svg"));
        assert!(svg.ends_with("</svg>"));
        assert!(svg.contains(r#"class="hk-pwd-dot-matrix""#));
        assert!(svg.contains(r#"preserveAspectRatio="xMidYMid meet""#));
        assert!(svg.contains("fill-opacity=\"0.550\""));
        assert_eq!(
            svg.matches("<circle").count(),
            PASSWORD_DOT_ROWS * PASSWORD_DOT_COLS
        );
    }

    #[test]
    fn password_classes_and_flags_match_the_vue_markup() {
        assert_eq!(
            password_box_classes(PasswordSize::Sm, ""),
            "hk-pwd-box hk-pwd-box-sm"
        );
        assert_eq!(
            password_box_classes(PasswordSize::Lg, "host"),
            "hk-pwd-box hk-pwd-box-lg host"
        );
        assert_eq!(
            password_box_classes(PasswordSize::Md, ""),
            "hk-pwd-box hk-pwd-box-md"
        );
        assert_eq!(
            password_lock_classes(false, false),
            "hk-pwd-lock hk-pwd-lock-empty"
        );
        assert_eq!(
            password_lock_classes(true, true),
            "hk-pwd-lock hk-pwd-lock-filled hk-pwd-lock-custom"
        );

        let flags = password_box_flags(PasswordFeedback::default(), false, false);
        assert_eq!(flags, PasswordBoxFlags::default());
        let all = password_box_flags(
            PasswordFeedback {
                focused: true,
                full_width: true,
                ..PasswordFeedback::default()
            },
            true,
            true,
        );
        assert_eq!(all.focused, Some("true"));
        assert_eq!(all.error, Some("true"));
        assert_eq!(all.disabled, Some("true"));
        assert_eq!(all.full_width, Some("true"));
    }

    #[test]
    fn password_slot_presence_matches_the_vue_slot_test() {
        assert!(!slot_provided(&None));
        assert!(!slot_provided(&Some(empty_vnode())));
        assert!(!slot_provided(&Some(VNode::Fragment(Vec::new()))));
        assert!(slot_provided(&Some(rsx! {
            span { class: "glyph" }
        })));
        assert!(slot_is_empty(&empty_vnode()));
        assert!(!slot_is_empty(&VNode::Text(VText::new("x"))));
    }

    #[test]
    fn password_glyphs_keep_the_vue_markup() {
        // The lock is Vue's inline svg: no class of its own.
        assert!(PASSWORD_LOCK_SVG.starts_with("<svg"));
        assert!(!PASSWORD_LOCK_SVG.contains("class="));
        assert!(PASSWORD_LOCK_SVG.contains(r#"width="16""#));
        assert!(PASSWORD_LOCK_SVG.contains(r#"<rect x="3" y="11""#));
        // Eye / EyeOff are lucide 1.0.0 at Vue's 15px.
        assert!(PASSWORD_EYE_SVG.contains("lucide-eye-icon"));
        assert!(PASSWORD_EYE_SVG.contains(r#"width="15""#));
        assert!(PASSWORD_EYE_SVG.contains(r#"aria-hidden="true""#));
        assert!(PASSWORD_EYE_OFF_SVG.contains("lucide-eye-off-icon"));
    }

    // ── the DOM contract ─────────────────────────────────────────────────

    #[test]
    fn password_props_default_matches_the_vue_props() {
        let props = PasswordSurfaceProps::default();
        assert_eq!(props.value, "");
        assert!(!props.visible);
        assert_eq!(props.feedback, PasswordFeedback::default());
        assert_eq!(props.placeholder, None);
        assert!(!props.disabled);
        assert!(!props.readonly);
        assert!(!props.required);
        assert!(!props.error);
        assert_eq!(props.name, None);
        assert_eq!(props.autocomplete, None);
        assert_eq!(props.id, None);
        // Vue: size "md", passwordTrailing "eye", revealTrigger "hold".
        assert_eq!(props.size, PasswordSize::Md);
        assert_eq!(props.trailing, PasswordTrailing::Eye);
        assert_eq!(props.reveal_trigger, PasswordRevealTrigger::Hold);
        assert_eq!(props.host_strength, None);
        assert_eq!(props.class, "");
        assert_eq!(props.style, "");
        assert!(props.prefix.is_none());
        assert!(props.prefix_icon.is_none());
        assert!(props.suffix.is_none());
        assert!(props.suffix_icon.is_none());
        assert!(props.reveal_content.is_none());
        assert!(props.submit_on_enter.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_feedback_change.is_none());
        assert!(props.on_visibility_change.is_none());
        assert!(props.on_clear.is_none());
        assert!(props.on_focus_request.is_none());
        assert!(props.on_focus.is_none());
        assert!(props.on_blur.is_none());
        assert!(props.on_keydown.is_none());
    }

    #[test]
    fn password_renders_the_vue_box_contract() {
        let html = PasswordSurface(PasswordSurfaceProps {
            value: "hunter2".to_string(),
            placeholder: Some("PIN".to_string()),
            name: Some("password".to_string()),
            id: Some("pwd".to_string()),
            required: true,
            class: "host".to_string(),
            style: "max-width:20rem".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-pwd-box hk-pwd-box-md host""#,
            // Vue: a filled field plus the "entered" hint (focused=false).
            r#"class="hk-pwd-lock hk-pwd-lock-filled""#,
            r#"class="hk-pwd-dots""#,
            r#"style="display:contents""#,
            "hk-pwd-dot-matrix",
            r#"class="hk-pwd-blur-hint""#,
            r#"class="hk-pwd-input""#,
            r#"type="password""#,
            r#"value="hunter2""#,
            r#"name="password""#,
            r#"id="pwd""#,
            r#"autocomplete="off""#,
            r#"data-lpignore="true""#,
            "required=\"required\"",
            r#"class="hk-pwd-eye""#,
            r#"aria-label="Hold to show password""#,
            "lucide-eye-icon",
            "max-width:20rem",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // An unfocused filled field shows the entered hint, never the
        // placeholder.
        assert!(!html.contains("hk-pwd-placeholder"), "{html}");
        assert!(!html.contains("hk-pwd-select-hint"), "{html}");
        // No error marker, no disabled marker, no reveal marker.
        assert!(!html.contains("data-error"), "{html}");
        assert!(!html.contains("data-disabled"), "{html}");
        assert!(!html.contains("data-revealing"), "{html}");
        // The dot matrix is filled (a value is present).
        // Filled cells carry the generator's peak opacity (0.350 at rest); an
        // empty field would stop at the 0.067 floor.
        assert!(html.contains("fill-opacity=\"0.350\""), "{html}");
    }

    #[test]
    fn password_renders_the_error_and_visible_arms() {
        // Error + focused + full-width: all three markers, the focused
        // placeholder, the caps/fw hint pair.
        let html = PasswordSurface(PasswordSurfaceProps {
            error: true,
            feedback: PasswordFeedback {
                focused: true,
                caps_lock: true,
                full_width: true,
                ..PasswordFeedback::default()
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "data-focused",
            "data-error",
            "data-fw",
            r#"class="hk-pwd-lock hk-pwd-lock-empty""#,
            r#"class="hk-pwd-placeholder""#,
            r#"class="hk-pwd-placeholder-text""#,
            "Focused, enter your password",
            r#"class="hk-pwd-hints""#,
            r#"data-variant="caps""#,
            "Caps Lock is on",
            r#"data-variant="fw""#,
            "Full-width characters not allowed",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-pwd-blur-hint"), "{html}");

        // Visible (revealed) with a host reveal node: the text lanes stand
        // down, the eye flips to EyeOff and carries data-revealing, and the
        // input stays type="password" ([D4]).
        let revealed = PasswordSurface(PasswordSurfaceProps {
            value: "hunter2".to_string(),
            visible: true,
            reveal_content: Some(rsx! {
                span { class: "host-reveal", "hunter2" }
            }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-pwd-eye""#,
            "data-revealing",
            "lucide-eye-off-icon",
            r#"class="host-reveal""#,
            r#"type="password""#,
        ] {
            assert!(revealed.contains(needle), "missing {needle}: {revealed}");
        }
        assert!(!revealed.contains("hk-pwd-placeholder"), "{revealed}");
        assert!(!revealed.contains("hk-pwd-blur-hint"), "{revealed}");
        assert!(!revealed.contains(r#"type="text""#), "{revealed}");
    }

    #[test]
    fn password_renders_the_caller_slots_and_the_strength_dot() {
        // Caller suffix stands the built-in eye down (Vue's precedence).
        let html = PasswordSurface(PasswordSurfaceProps {
            value: "hunter2".to_string(),
            suffix: Some(rsx! {
                span { class: "host-suffix" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-pwd-suffix""#), "{html}");
        assert!(!html.contains("hk-pwd-eye"), "{html}");

        // Caller prefix replaces the lock and lifts the berth.
        let prefixed = PasswordSurface(PasswordSurfaceProps {
            prefix: Some(rsx! {
                button { class: "host-prefix" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(prefixed.contains("hk-pwd-lock-custom"), "{prefixed}");
        assert!(prefixed.contains("host-prefix"), "{prefixed}");
        assert!(!prefixed.contains("<rect x=\"3\""), "{prefixed}");

        // The strength dot rides a tooltip wrapper at the end edge.
        let strength = PasswordSurface(PasswordSurfaceProps {
            value: "Password1".to_string(),
            trailing: PasswordTrailing::Strength,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-tooltip-wrapper",
            r#"class="hk-pwd-strength""#,
            r#"data-level="fair""#,
            r#"role="img""#,
            r#"aria-label="Password strength: Fair""#,
        ] {
            assert!(strength.contains(needle), "missing {needle}: {strength}");
        }
        // …and only while there is a value to classify.
        let empty = PasswordSurface(PasswordSurfaceProps {
            trailing: PasswordTrailing::Strength,
            ..Default::default()
        })
        .render_to_html();
        assert!(!empty.contains("hk-pwd-strength"), "{empty}");
        // `trailing: none` renders neither affordance.
        let bare = PasswordSurface(PasswordSurfaceProps {
            value: "hunter2".to_string(),
            trailing: PasswordTrailing::None,
            ..Default::default()
        })
        .render_to_html();
        assert!(!bare.contains("hk-pwd-eye"), "{bare}");
        assert!(!bare.contains("hk-pwd-strength"), "{bare}");
    }

    #[test]
    fn password_styles_come_from_the_canonical_vue_sheet() {
        let css = PasswordSurfaceComponent::styles();
        for needle in [
            ".hk-pwd-box",
            ".hk-pwd-box-sm",
            ".hk-pwd-box-lg",
            ".hk-pwd-lock",
            ".hk-pwd-lock-custom",
            ".hk-pwd-dots",
            ".hk-pwd-placeholder",
            ".hk-pwd-blur-hint",
            ".hk-pwd-select-hint",
            ".hk-pwd-input",
            ".hk-pwd-strength",
            ".hk-pwd-eye",
            ".hk-pwd-suffix",
            ".hk-pwd-hint",
            ".hk-tooltip-wrapper",
            "data-revealing",
            "[data-level=strong]",
        ] {
            assert!(
                css.contains(needle),
                "password css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored password sheet"
        );
    }
}
