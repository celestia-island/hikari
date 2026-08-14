import { defineComponent, ref, watch } from "vue";
import { TriangleAlert as AlertTriangle, Check, Copy } from "lucide-vue-next";
import { HModal, useClipboard, useI18n } from "@celestia-island/hikari";

import "./HkSecretRevealModal.scss";


/**
 * HkSecretRevealModal — show-once secret / API-key reveal panel.
 *
 * Displays a one-time secret (API key, token, password) with a "shown
 * only once" notice and a copy button. `copied` fires on successful copy.
 * The value is a prop: the caller decides how to obtain/discard it (e.g.
 * clear it once the modal closes).
 */
export const HkSecretRevealModal = defineComponent({
  name: "HkSecretRevealModal",
  props: {
    modelValue: { type: Boolean, default: false },
    /** Secret label (e.g. "API Key"). */
    label: { type: String, required: true },
    /** The secret value to reveal. */
    value: { type: String, required: true },
    /** Copy button label override. */
    copyLabel: { type: String, default: undefined },
    /** "Shown once" notice override. */
    notice: { type: String, default: undefined },
    title: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
    copied: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const clipboard = useClipboard();
    const copied = ref(false);

    watch(
      () => props.modelValue,
      (open) => {
        if (open) copied.value = false;
      },
    );

    async function handleCopy() {
      if (!props.value) return;
      const ok = await clipboard.copy(props.value);
      if (ok) {
        copied.value = true;
        emit("copied");
      }
    }

    return () => (
      <HModal
        modelValue={props.modelValue}
        onUpdate:modelValue={(v: boolean) => emit("update:modelValue", v)}
        title={props.title ?? `${props.label} — ${t("hikari::secret.title")}`}
        width="34rem"
        footerActions={[
          {
            label: t("hikari::secret.close"),
            variant: "secondary",
            onClick: () => emit("update:modelValue", false),
          },
        ]}
      >
        <div class="s-secret-modal">
          <div class="s-secret-modal-notice">
            <AlertTriangle size={14} />
            <span>{props.notice ?? t("hikari::secret.notice")}</span>
          </div>
          <code class="s-secret-modal-value">{props.value}</code>
          <div class="s-secret-modal-actions">
            <button
              type="button"
              class="s-secret-modal-copy"
              data-copied={copied.value || undefined}
              onClick={() => void handleCopy()}
              disabled={!props.value}
            >
              {copied.value ? <Check size={14} /> : <Copy size={14} />}
              {copied.value ? t("hikari::secret.copied") : props.copyLabel ?? t("hikari::secret.copy")}
            </button>
          </div>
        </div>
      </HModal>
    );
  },
});
