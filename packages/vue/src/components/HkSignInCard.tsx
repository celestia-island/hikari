import { credentialAutocomplete } from "../runtime/credentialAutofill";
import { defineComponent, ref } from "vue";
import { useI18n } from "../i18n/context";

import { HkAuthCard } from "./HkAuthCard";
import HkInput from "./HkInput";
import HkAuthSubmitButton from "./HkAuthSubmitButton";

/**
 * HkSignInCard — the shared credential form for every Celestia front end.
 *
 * One controlled composition of the auth kit: `HkAuthCard` shell + `HkInput`
 * (username, prefix-icon slot) + `HkInput variant="password"` (dot-matrix
 * surface, centered placeholder layer, caps-lock / full-width hints and a
 * hold-to-reveal eye — all from hikari's own i18n, no per-consumer prop
 * plumbing) + `HkAuthSubmitButton` (block submit with external loading).
 *
 * Control contract: the fields live INSIDE the card; the consumer injects
 * `onSubmit(username, password)` and feeds the in-flight state back through
 * `loading`. The card never talks to a backend itself, so each app binds its
 * own login API (erp `meLogin`, chest's auth, …) while the visual language
 * stays identical everywhere.
 *
 * Extension points for flows that outgrow plain username+password:
 * - `top` slot — content between the card header and the credential form
 *   (channel tabs, SSO buttons, …). Rendered outside the `<form>` so tab
 *   clicks never trigger a submit.
 * - `usernamePlaceholder` / `usernameType` — override the username field
 *   (e.g. email-identifier logins); the placeholder falls back to the
 *   `hikari::signIn.usernamePlaceholder` locale when unset.
 * - `passwordField: false` — account-first sign-in: the card collects ONLY
 *   the account name and `submit` fires with an empty password. The
 *   password itself is proven in the consumer's NEXT step (chest's
 *   verify-account panel), where it reappears as one factor among several.
 *   Pair with `initialUsername` so the typed name survives the step-flow
 *   round-trip (the card remounts when the user navigates back).
 * - `footer` slot — content below the submit button (remember-me,
 *   protocol links, …).
 * - `methods` slot — forwarded to HkAuthCard's full-width methods block
 *   between the form and the footer (typically `HkAuthMethodList`), so
 *   alternative sign-in buttons line up with the inputs while the footer
 *   rows keep their centered-group layout.
 *
 * ```tsx
 * <HSignInCard
 *   title="Sign in"
 *   subtitle="Continue to your account"
 *   :logo-src="logo"
 *   :loading="pending"
 *   @submit="(u, p) => signIn(u, p)"
 * />
 * ```
 */
export const HkSignInCard = defineComponent({
  name: "HkSignInCard",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    /** Optional logo image URL for the card header. */
    logoSrc: { type: String, default: undefined },
    /** External in-flight state; disables fields + submit while true. */
    loading: { type: Boolean, default: false },
    /** Extra guard on top of the built-in empty-field check. */
    disabled: { type: Boolean, default: false },
    /** Autocomplete hints. Undefined (the default) resolves through
     * the runtime credential policy: browser = standard tokens, Tauri
     * webview = suppression (no native credential chrome). */
    usernameAutocomplete: { type: String, default: undefined },
    passwordAutocomplete: { type: String, default: undefined },
    /** Submit label; defaults to the hikari::signIn.submit locale. */
    submitLabel: { type: String, default: undefined },
    /** Username-field type; switch to "email" for identifier logins. */
    usernameType: { type: String, default: "text" },
    /** Username placeholder; defaults to the hikari::signIn locale. */
    usernamePlaceholder: { type: String, default: undefined },
    /** Account-first flows: hide the password field entirely — the card
     *  collects only the account name and `submit` fires with an empty
     *  password (the consumer's next step owns the actual proof). Default
     *  keeps the classic two-field card. */
    passwordField: { type: Boolean, default: true },
    /** Seed for the username field. Step flows remount this card when the
     *  user navigates back from a later step, so the typed account name
     *  must travel through a prop rather than module state. */
    initialUsername: { type: String, default: "" },
  },
  emits: {
    /** Fired on explicit click or Enter; never with an empty username (or
     *  an empty password while `passwordField` is on) or while busy. */
    submit: (_username: string, _password: string) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const username = ref(props.initialUsername);
    const password = ref("");

    function attemptSubmit() {
      if (props.loading || props.disabled) return;
      const u = username.value.trim();
      if (!u || (props.passwordField && !password.value)) return;
      emit("submit", u, props.passwordField ? password.value : "");
    }

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
              <form onSubmit={(e: Event) => { e.preventDefault(); attemptSubmit(); }}>
                <HkInput
                  modelValue={username.value}
                  onUpdate:modelValue={(v: string) => (username.value = v)}
                  type={props.usernameType}
                  name="signin-username"
                  autocomplete={props.usernameAutocomplete ?? credentialAutocomplete("username", "username")}
                  placeholder={
                    props.usernamePlaceholder ??
                    t("hikari::signIn.usernamePlaceholder", "Username")
                  }
                  disabled={props.loading || props.disabled}
                  submitOnEnter={attemptSubmit}
                >
                {{
                  prefixIcon: () =>
                    slots.usernameIcon ? (
                      slots.usernameIcon()
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="s-auth-card-field-icon"
                        aria-hidden="true"
                      >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    ),
                }}
              </HkInput>
              {/* Account-first mode omits the field entirely — not hides
                  it with CSS: a hidden password input would still plant a
                  credential-manager save prompt and an autocomplete target
                  on a form that never carries a password. */}
              {props.passwordField && (
                <HkInput
                  variant="password"
                  modelValue={password.value}
                  onUpdate:modelValue={(v: string) => (password.value = v)}
                  name="signin-password"
                  autocomplete={props.passwordAutocomplete ?? credentialAutocomplete("password", "current-password")}
                  placeholder={t("hikari::signIn.passwordPlaceholder", "Password")}
                  disabled={props.loading || props.disabled}
                  submitOnEnter={attemptSubmit}
                />
              )}
              <HkAuthSubmitButton
                label={props.submitLabel ?? t("hikari::signIn.submit", "Sign in")}
                block
                loading={props.loading}
                disabled={props.disabled || !username.value.trim() || (props.passwordField && !password.value)}
                doSubmit={() => Promise.resolve(attemptSubmit())}
              />
              </form>
            </>
          ),
          footer: () => slots.footer?.(),
          /* Forward the methods slot ONLY when the consumer passed one: an
             unconditional lambda would make HkAuthCard see a slot that
             always exists and render its (padded, top-margined)
             `.s-auth-methods` wrapper as empty dead space under the form
             on every methods-less sign-in card. */
          ...(slots.methods ? { methods: () => slots.methods?.() } : {}),
        }}
      </HkAuthCard>
    );
  },
});
