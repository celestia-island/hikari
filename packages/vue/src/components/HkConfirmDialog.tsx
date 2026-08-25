import { defineComponent } from "vue";

import "./HkConfirmDialog.scss";
import HButton from "./HkButton";
import HModal from "./HkModal";
import { useI18n } from "../i18n/context";

export default defineComponent({
  name: "HkConfirmDialog",
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    confirmLabel: { type: String, default: "" },
    confirmVariant: {
      type: String as () => "primary" | "danger",
      default: "danger",
    },
    cancelLabel: { type: String, default: "" },
    loading: { type: Boolean, default: false },
  },
  emits: {
    confirm: () => true,
    cancel: () => true,
    "update:open": (_value: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    function onConfirm() {
      emit("confirm");
      emit("update:open", false);
    }

    function onCancel() {
      emit("cancel");
      emit("update:open", false);
    }

    return () => (
      <HModal
        modelValue={props.open}
        title={props.title}
        closable={!props.loading}
        width="24rem"
        onUpdate:modelValue={(v: boolean) => emit("update:open", v)}
      >
        {{
          default: () => (
            <div class="hk-confirm-dialog">
              <p class="hk-confirm-dialog-message">{props.message}</p>
              <div class="hk-confirm-dialog-actions">
                <HButton
                  class="hk-confirm-dialog-btn"
                  variant="secondary"
                  size="md"
                  disabled={props.loading}
                  onClick={onCancel}
                >
                  {props.cancelLabel || t("hikari::confirmDialog.cancel", "Cancel")}
                </HButton>
                <HButton
                  class="hk-confirm-dialog-btn"
                  variant={props.confirmVariant}
                  size="md"
                  loading={props.loading}
                  onClick={onConfirm}
                >
                  {props.confirmLabel || t("hikari::confirmDialog.confirm", "Confirm")}
                </HButton>
              </div>
            </div>
          ),
        }}
      </HModal>
    );
  },
});
