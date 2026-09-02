import { createApp, defineComponent, h, ref, type PropType } from "vue";

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-vue-next";

import { useI18n } from "../i18n/context";

import HkButton from "./HkButton";
import HkInput from "./HkInput";
import HkModal from "./HkModal";
import "./HkMessageBox.scss";

/**
 * HkMessageBox — the shared transient message box (a Windows-style
 * MessageBox / InputBox): a small modal that asks for a confirmation,
 * shows a notice, or collects ONE value.
 *
 *   - `HkMessageBox.confirm(opts)` → Promise<boolean>
 *   - `HkMessageBox.alert(opts)`  → Promise<void>
 *   - `HkMessageBox.prompt(opts)` → Promise<string | null>
 *
 * The prompt's single field is customizable: input variant (`type`,
 * e.g. a password box), label, placeholder, initial value, maxlength,
 * a confirm-time `validate` hook, and prefix/suffix affixes supplied
 * as render functions (e.g. a dial-code chip or a unit suffix).
 *
 * ┌─ SCOPE — read before reaching for this component ─────────────────┐
 * │ The message box is deliberately minimal: at most ONE input, no   │
 * │ layout control beyond the affixes, no slots for arbitrary        │
 * │ content. If you need more than one field, checkboxes, lists or   │
 * │ any complex form, do NOT use the message box — build a real      │
 * │ HModal with a form inside.                                       │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Each call mounts its own transient host and resolves the promise on
 * the user's decision (Esc / backdrop click count as cancel; for
 * `alert` any dismiss resolves). Calls are fire-and-forget by design —
 * await the returned promise at the call site. Avoid firing many boxes
 * in a loop; sequential awaits keep the UX readable.
 */

/** The single editable field a prompt box may host. */
export interface HkMessageBoxPrompt {
  /** Initial value. */
  value?: string;
  label?: string;
  placeholder?: string;
  /** Field variant — plain text, masked password, or number. */
  type?: "text" | "password" | "number";
  /** Render function for the input's PREFIX affix (chip, glyph…). */
  prefix?: () => unknown;
  /** Render function for the input's SUFFIX affix. */
  suffix?: () => unknown;
  /** Confirm-time validation: return an error string to block the
   *  confirmation (shown under the field), or undefined to accept. */
  validate?: (value: string) => string | undefined | null;
}

export interface HkMessageBoxOptions {
  title?: string;
  /** Body text. Kept as plain text — no arbitrary content by design. */
  message: string;
  /** Visual urgency: icon tone and confirm button variant. */
  tone?: "info" | "success" | "warning" | "danger";
  confirmText?: string;
  cancelText?: string;
  /** Hide the cancel button (pure notice). Default false. */
  hideCancel?: boolean;
  /** When present the box hosts exactly one customizable field and
   *  resolves with its value instead of a boolean. */
  prompt?: HkMessageBoxPrompt;
}

type Resolve = (value: unknown) => void;

const HkMessageBoxHost = defineComponent({
  name: "HkMessageBoxHost",
  props: {
    title: { type: String, default: undefined },
    message: { type: String, required: true },
    tone: { type: String as PropType<NonNullable<HkMessageBoxOptions["tone"]>>, default: "info" },
    confirmText: { type: String, default: undefined },
    cancelText: { type: String, default: undefined },
    hideCancel: { type: Boolean, default: false },
    prompt: { type: Object as PropType<HkMessageBoxPrompt>, default: undefined },
    resolve: { type: Function as PropType<Resolve>, required: true },
    /** alert resolves on confirm; confirm/prompt resolve booleans/values */
    kind: { type: String as PropType<"alert" | "confirm" | "prompt">, required: true },
    onSettled: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const { t } = useI18n();
    const open = ref(true);
    const value = ref(props.prompt?.value ?? "");
    const error = ref<string | undefined>(undefined);

    const toneIcon = () => {
      switch (props.tone) {
        case "success":
          return <CheckCircle2 size={18} aria-hidden="true" />;
        case "warning":
          return <AlertTriangle size={18} aria-hidden="true" />;
        case "danger":
          return <ShieldAlert size={18} aria-hidden="true" />;
        default:
          return <Info size={18} aria-hidden="true" />;
      }
    };

    function settle(payload: unknown) {
      props.resolve(payload);
      open.value = false;
    }

    function cancel() {
      settle(props.kind === "alert" ? undefined : props.kind === "prompt" ? null : false);
    }

    async function confirm() {
      if (props.prompt) {
        // Run the validator first; a returned error string blocks the
        // confirmation and is shown under the field.
        const message = props.prompt.validate?.(value.value);
        if (message) {
          error.value = message;
          return;
        }
        error.value = undefined;
        settle(value.value);
        return;
      }
      settle(props.kind === "confirm" ? true : undefined);
    }

    return () => {
      const confirmLabel =
        props.confirmText ?? t("hikari::messageBox.confirm", "Confirm");
      const cancelLabel = props.cancelText ?? t("hikari::messageBox.cancel", "Cancel");
      const confirmVariant =
        props.tone === "danger" ? "danger" : "primary";
      const fallbackTitle =
        props.kind === "alert"
          ? t("hikari::messageBox.alertTitle", "Notice")
          : props.kind === "prompt"
            ? t("hikari::messageBox.promptTitle", "Input")
            : t("hikari::messageBox.confirmTitle", "Please confirm");
      return (
        <HkModal
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => {
            // Backdrop / Esc / title-bar close all count as a cancel —
            // the message box never stays half-open after a dismissal.
            if (!v && open.value) cancel();
          }}
          onAfterLeave={() => props.onSettled()}
          title={props.title ?? fallbackTitle}
          width="26rem"
        >
          {{
            default: () => (
              <div class="hk-message-box" data-tone={props.tone}>
                <div class="hk-message-box-icon" aria-hidden="true">
                  {toneIcon()}
                </div>
                <p class="hk-message-box-text" role={props.tone === "danger" ? "alert" : undefined}>
                  {props.message}
                </p>
                {props.prompt && (
                  <div class="hk-message-box-prompt">
                    <HkInput
                      modelValue={value.value}
                      onUpdate:modelValue={(v: string) => {
                        value.value = v;
                        // A fresh keystroke clears a failed validation.
                        if (error.value) error.value = undefined;
                      }}
                      type={props.prompt.type ?? "text"}
                      label={props.prompt.label}
                      placeholder={props.prompt.placeholder}
                      error={error.value}
                      autocomplete="off"
                      onKeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter" && !e.isComposing) {
                          e.preventDefault();
                          void confirm();
                        }
                      }}
                    >
                      {{
                        prefix: props.prompt.prefix,
                        suffix: props.prompt.suffix,
                      }}
                    </HkInput>
                  </div>
                )}
              </div>
            ),
            footer: () => (
              <div class="hk-message-box-actions">
                {/* Alerts have no cancel by definition; confirm/prompt
                    hide it only when the host asks. */}
                {props.kind !== "alert" && !props.hideCancel && (
                  <HkButton variant="secondary" onClick={cancel}>
                    {cancelLabel}
                  </HkButton>
                )}
                <HkButton
                  variant={confirmVariant}
                  class="hk-message-box-confirm"
                  onClick={() => void confirm()}
                >
                  {confirmLabel}
                </HkButton>
              </div>
            ),
          }}
        </HkModal>
      );
    };
  },
});

function show(kind: "alert" | "confirm" | "prompt", options: HkMessageBoxOptions): Promise<unknown> {
  return new Promise((resolve) => {
    let settled = false;
    let cleaned = false;
    let app: ReturnType<typeof createApp> | null = null;
    let container: HTMLElement | null = null;
    const cleanup = () => {
      if (cleaned || !app || !container) return;
      cleaned = true;
      if (container.isConnected) {
        app.unmount();
        container.remove();
      }
    };
    const settle = (value: unknown) => {
      if (settled) return;
      settled = true;
      resolve(value);
      // The leave transition is playing; reclaim the host when it ends
      // (onSettled) or after the transition duration at the latest — a
      // lost afterLeave event (host DOM wiped by a route change, a test
      // clearing the body) must never leak the app.
      setTimeout(cleanup, 360);
    };
    // Mount on a MACROTASK, never synchronously inside the caller's
    // click dispatch: a box mounted mid-dispatch would see the very
    // same click event reach its (freshly registered) document-level
    // listeners and instantly dismiss itself.
    setTimeout(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      app = createApp({
        render: () =>
          h(HkMessageBoxHost, {
            ...options,
            kind,
            resolve: settle,
            onSettled: () => cleanup(),
          }),
      });
      app.mount(container);
      // Safety net for boxes that never resolve at all.
      setTimeout(cleanup, 5 * 60 * 1000);
    }, 0);
  });
}

/** The imperative message box service — see HkMessageBox docs. */
export const HkMessageBox = {
  /** Notice with a single OK button. Resolves when dismissed. */
  alert: (options: HkMessageBoxOptions): Promise<void> =>
    show("alert", options).then(() => undefined),
  /** Confirmation. Resolves true on confirm, false on cancel/Esc. */
  confirm: (options: HkMessageBoxOptions): Promise<boolean> =>
    show("confirm", options).then((v) => v === true),
  /** Single-field prompt. Resolves the value on confirm, null on
   *  cancel/Esc. The field is customizable via `options.prompt`. */
  prompt: (options: HkMessageBoxOptions & { prompt: HkMessageBoxPrompt }): Promise<string | null> =>
    show("prompt", options).then((v) => (typeof v === "string" ? v : null)),
};

export default HkMessageBox;
