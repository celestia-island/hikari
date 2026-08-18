import { defineComponent, ref } from "vue";
import { useI18n } from "../i18n/context";

import { HkAuthCard } from "./HkAuthCard";
import HkInput from "./HkInput";
import HkPasswordInput from "./HkPasswordInput";
import HkAuthSubmitButton from "./HkAuthSubmitButton";

/**
 * HkSignInCard — the shared credential form for every Celestia front end.
 *
 * One controlled composition of the auth kit: `HkAuthCard` shell + `HkInput`
 * (username, prefix-icon slot) + `HkPasswordInput` (centered placeholder
 * layer, caps-lock / full-width / all-selected hints — all from hikari's own
 * i18n, no per-consumer prop plumbing) + `HkAuthSubmitButton` (block submit
 * with external loading).
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
 * - `footer` slot — content below the submit button (remember-me,
 *   protocol links, …).
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
    /** autocomplete hints, override only when the flow demands it. */
    usernameAutocomplete: { type: String, default: "username" },
    passwordAutocomplete: { type: String, default: "current-password" },
    /** Submit label; defaults to the hikari::signIn.submit locale. */
    submitLabel: { type: String, default: undefined },
    /** Username-field type; switch to "email" for identifier logins. */
    usernameType: { type: String, default: "text" },
    /** Username placeholder; defaults to the hikari::signIn locale. */
    usernamePlaceholder: { type: String, default: undefined },
  },
  emits: {
    /** Fired on explicit click or Enter; never with empty fields or while busy. */
    submit: (_username: string, _password: string) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const username = ref("");
    const password = ref("");

    function attemptSubmit() {
      if (props.loading || props.disabled) return;
      const u = username.value.trim();
      if (!u || !password.value) return;
      emit("submit", u, password.value);
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
                  autocomplete={props.usernameAutocomplete}
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
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="w-4 h-4"
                        aria-hidden="true"
                      >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    ),
                }}
              </HkInput>
              <HkPasswordInput
                modelValue={password.value}
                onUpdate:modelValue={(v: string) => (password.value = v)}
                name="signin-password"
                autocomplete={props.passwordAutocomplete}
                placeholder={t("hikari::signIn.passwordPlaceholder", "Password")}
                disabled={props.loading || props.disabled}
                submitOnEnter={attemptSubmit}
              />
              <HkAuthSubmitButton
                label={props.submitLabel ?? t("hikari::signIn.submit", "Sign in")}
                block
                loading={props.loading}
                disabled={props.disabled || !username.value.trim() || !password.value}
                doSubmit={() => Promise.resolve(attemptSubmit())}
              />
              </form>
            </>
          ),
          footer: () => slots.footer?.(),
        }}
      </HkAuthCard>
    );
  },
});
