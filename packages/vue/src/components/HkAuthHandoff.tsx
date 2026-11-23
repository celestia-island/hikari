// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.4),
// directed and reviewed by the lead agent — SySL-1.0 §2.3 disclosure.

import {
  defineComponent,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import HkBadge from "./HkBadge";
import HkButton from "./HkButton";
import { HkAuthScreen } from "./HkAuthScreen";
import HkSpinner from "./HkSpinner";
import "./HkAuthHandoff.scss";

/** The five states a hand-off screen can be in:
 *  `redirecting` (about to leave for the sign-in entry), `completing`
 *  (the callback is being exchanged), `success`, `failed` and `expired`. */
export type HkAuthHandoffStatus = "redirecting" | "completing" | "success" | "failed" | "expired";

/** The built-in actions: `retry` restarts the hand-off, `back` returns to
 *  the sign-in page. */
export type HkAuthHandoffAction = "retry" | "back";

const COPY_KEY: Record<HkAuthHandoffStatus, string> = {
  redirecting: "hikari::authHandoff.redirecting",
  completing: "hikari::authHandoff.completing",
  success: "hikari::authHandoff.success",
  failed: "hikari::authHandoff.failed",
  expired: "hikari::authHandoff.expired",
};

const COPY_FALLBACK: Record<HkAuthHandoffStatus, string> = {
  redirecting: "Redirecting to sign-in…",
  completing: "Completing sign-in…",
  success: "Signed in",
  failed: "Sign-in could not be completed",
  expired: "Your session expired. Sign in to continue.",
};

/** States that are in progress: a spinner, a polite live region. */
const TRANSIENT = new Set<HkAuthHandoffStatus>(["redirecting", "completing"]);

/**
 * HkAuthHandoff — the sign-in screens that are NOT a form: the relay-mode
 * splash before the browser leaves for the central login, the "completing"
 * state while a callback is exchanged, and the terminal success / failed /
 * expired states.
 *
 * Built on `HkAuthScreen` (header strip, centred stage, footer) with the
 * auth card's grammar (logo, title, description). A CONTROLLED component:
 * it builds no URLs and reads no token — the host passes `href` (or
 * navigates itself on `redirect`) and decides what `retry` / `back` mean.
 *
 * ```tsx
 * <HkAuthHandoff
 *   status="redirecting"
 *   href={hkRelayEntryHref(policy, route.query.return) ?? undefined}
 *   delayMs={800}
 *   onBack={() => router.push("/login")}
 * />
 * ```
 */
export const HkAuthHandoff = defineComponent({
  name: "HkAuthHandoff",
  props: {
    status: { type: String as PropType<HkAuthHandoffStatus>, required: true },
    /** Overrides the status title. Default undefined — the title is the
     *  status copy from `hikari::authHandoff.*`. */
    title: { type: String, default: undefined },
    /** A line under the title. Default undefined — no description is
     *  rendered (the status copy alone is the title). */
    description: { type: String, default: undefined },
    /** Logo above the title. Default undefined — no logo. */
    logoSrc: { type: String, default: undefined },
    /** `redirecting` only: the navigation target. When undefined the
     *  component navigates nothing and the host handles `redirect`. */
    href: { type: String, default: undefined },
    /** `redirecting` only: how long the splash shows before navigating.
     *  Default 0 — navigate as soon as the screen mounts. */
    delayMs: { type: Number, default: 0 },
    /** Built-in buttons in render order. Default undefined — `["back"]` for
     *  `failed` / `expired`, none for the other states. */
    actions: {
      type: Array as PropType<readonly HkAuthHandoffAction[]>,
      default: undefined,
    },
  },
  emits: {
    /** The redirect fired: `href` is the target (an empty string when the
     *  `href` prop was not given). Return `false` from the handler to
     *  cancel the navigation (the handler is invoked directly so its
     *  return value can be read). */
    redirect: (_href: string) => true,
    /** The `retry` action was activated. */
    retry: () => true,
    /** The `back` action was activated. */
    back: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const instance = getCurrentInstance();
    type RedirectHandler = (href: string) => boolean | void | undefined;

    let timer: ReturnType<typeof setTimeout> | null = null;
    function clearTimer(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function go(): void {
      const href = props.href ?? "";
      // `emit()` cannot hand back a handler's return value, so the raw
      // listener(s) are read off the component's current vnode and invoked
      // directly; `false` from any of them is a veto. Read per call, on
      // purpose: the handler consulted must be the one the host passes NOW,
      // not one captured when this component was set up.
      const raw = instance?.vnode.props?.onRedirect as RedirectHandler | RedirectHandler[] | undefined;
      const handlers = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const vetoed = handlers.some((handler) => handler(href) === false);
      if (vetoed) return;
      if (props.href) window.location.assign(props.href);
    }

    function schedule(): void {
      clearTimer();
      if (props.status !== "redirecting") return;
      timer = setTimeout(go, Math.max(0, props.delayMs));
    }

    // The timer follows the state: mounting, or a status / href / delay
    // change, re-arms (or cancels) it; unmounting cancels it for good.
    onMounted(schedule);
    watch(() => [props.status, props.href, props.delayMs], schedule);
    onUnmounted(clearTimer);

    return () => {
      const transient = TRANSIENT.has(props.status);
      const failed = props.status === "failed" || props.status === "expired";
      const title = props.title ?? t(COPY_KEY[props.status], COPY_FALLBACK[props.status]);
      const description = props.description;
      const actions = props.actions ?? (failed ? ["back"] : []);

      function run(action: HkAuthHandoffAction): void {
        if (action === "retry") emit("retry");
        else emit("back");
      }

      const buttonLabel: Record<HkAuthHandoffAction, string> = {
        retry: t("hikari::authHandoff.retry", "Try again"),
        back: t("hikari::authHandoff.back", "Back to sign in"),
      };

      return (
        <HkAuthScreen>
          {{
            header: slots.header,
            footer: slots.footer,
            default: () => (
              <div
                class={[
                  "hk-auth-handoff",
                  `hk-auth-handoff--${props.status}`,
                  transient && "is-transient",
                ]}
                role={failed ? "alert" : "status"}
                aria-live={transient ? "polite" : undefined}
              >
                <div class="s-auth-card hk-auth-handoff-card">
                  <div class="s-auth-header hk-auth-handoff-header">
                    {props.logoSrc ? (
                      <img class="hk-auth-handoff-logo" src={props.logoSrc} alt="" aria-hidden="true" />
                    ) : null}
                    <h1 class="s-auth-title hk-auth-handoff-title">{title}</h1>
                    {description ? (
                      <p class="s-auth-subtitle hk-auth-handoff-description">{description}</p>
                    ) : null}
                  </div>
                  <div class="hk-auth-handoff-body">
                    {transient ? <HkSpinner center /> : null}
                    // With the default title the heading already names the
                    // state; the badge repeats it only under a host title.
                    {props.status === "success" && props.title ? (
                      <div class="hk-auth-handoff-state">
                        <HkBadge variant="success" size="md">
                          {t(COPY_KEY[props.status], COPY_FALLBACK[props.status])}
                        </HkBadge>
                      </div>
                    ) : null}
                    {slots.actions ? (
                      <div class="hk-auth-handoff-actions">{slots.actions()}</div>
                    ) : actions.length > 0 ? (
                      <div class="hk-auth-handoff-actions">
                        {actions.map((action, index) => (
                          <HkButton
                            key={action}
                            variant={index === 0 && action === "back" && failed ? "primary" : "secondary"}
                            onClick={() => run(action)}
                          >
                            {buttonLabel[action]}
                          </HkButton>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ),
          }}
        </HkAuthScreen>
      );
    };
  },
});

export default HkAuthHandoff;
