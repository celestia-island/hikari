// CSS animation registrar (动画注册商).
//
// Every keyframes animation shipped by hikari is registered here so a
// single global switch can suspend them all — e.g. when the animation
// context detects performance problems — without each component
// re-implementing reduced-motion handling. The runtime frame scheduler
// (`runtime/animationBus.ts`) covers JS-driven animation; this registry
// complements it for pure-CSS animations.
//
// The switch works by flipping `html[data-css-animations]` between "0"
// and "1"; the pause rules live in `theme/theme.scss`.

export interface CssAnimationOptions {
  /** True for looping animations (`animation-iteration-count: infinite`). */
  infinite?: boolean;
}

export interface RegisteredCssAnimation {
  name: string;
  infinite: boolean;
}

const registry = new Map<string, RegisteredCssAnimation>();

/**
 * Register a CSS keyframes animation. Idempotent: re-registering the
 * same name overwrites the previous entry.
 */
export function registerCssAnimation(name: string, opts?: CssAnimationOptions): RegisteredCssAnimation {
  const entry: RegisteredCssAnimation = { name, infinite: opts?.infinite ?? false };
  registry.set(name, entry);
  return entry;
}

/** All registered CSS animations, sorted by name for stable output. */
export function listCssAnimations(): RegisteredCssAnimation[] {
  return Array.from(registry.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Flip the global CSS animation switch. `false` sets
 * `html[data-css-animations="0"]`, which pauses every registered (and
 * any unregistered) keyframes animation via `animation-play-state` and
 * downgrades smooth scrolling — see `theme/theme.scss`.
 *
 * No-op on the server (no `document`).
 */
export function setCssAnimationsEnabled(enabled: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.cssAnimations = enabled ? "1" : "0";
}

/** Current switch state; `true` when animations are enabled (or unknown). */
export function isCssAnimationsEnabled(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.cssAnimations !== "0";
}

// ── Centralized registrations ────────────────────────────────────────
// One line per keyframes animation declared under packages/vue/src, with
// the owning component noted. Keep this list in sync with the SCSS
// sources — `registerAnimations.test.ts` enforces the parity by parsing
// every `@keyframes` declaration from the source tree.

// styles/admin-tokens.scss — nav badge pulse (loops forever).
registerCssAnimation("s-nav-item-badge-pulse", { infinite: true });
// styles/admin-tokens.scss — auth card entrance (plays once).
registerCssAnimation("s-auth-card-in");
// components/HkStatusPill.scss — live-dot pulse (loops forever).
registerCssAnimation("hk-status-pill-pulse", { infinite: true });
// components/HkRollingNumber.scss — digit roll-up (plays once, forwards).
registerCssAnimation("hk-rolling-number-up");
// components/HkSpinner.scss — spinner rotation (loops forever).
registerCssAnimation("hk-spinner-rotate", { infinite: true });
// components/HkModalBreadcrumb.scss — breadcrumb entrance (plays once).
registerCssAnimation("hk-modal-breadcrumb-in");
// components/HkToast.scss — toast spinner rotation (loops forever).
registerCssAnimation("hk-toast-spin", { infinite: true });
// components/HkSkeleton.scss — skeleton shimmer (loops forever).
registerCssAnimation("hk-skeleton-shimmer", { infinite: true });
// components/HkProgressBar.scss — indeterminate bar sweep (loops forever).
registerCssAnimation("hk-progress-indeterminate", { infinite: true });
// components/HkPasswordInput.scss — caps-lock warning flash (plays once).
registerCssAnimation("hk-pwd-flash");
// components/HkPasswordInput.scss — breathing hint glow (loops forever).
registerCssAnimation("hk-pwd-breathe", { infinite: true });
// components/HkPickerPane.scss — date/time picker view drill forward
// (plays once, shared by HkDatePicker and HkDateTimePicker).
registerCssAnimation("hk-picker-pane-fwd-in");
registerCssAnimation("hk-picker-pane-fwd-out");
// components/HkPickerPane.scss — date/time picker view drill back.
registerCssAnimation("hk-picker-pane-back-in");
registerCssAnimation("hk-picker-pane-back-out");
// components/HkCountdownDigit.tsx — countdown digit flip swap (plays
// once; keyframes ride the component's inline <style>).
registerCssAnimation("hk-flip-out");
registerCssAnimation("hk-flip-in");
// components/HkVoiceInputPopup.scss — voice waveform bounce (loops
// forever while listening; upstreamed from chest's plana-legacy).
registerCssAnimation("s-voice-wave-bounce", { infinite: true });
