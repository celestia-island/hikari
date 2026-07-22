import { defineComponent } from "vue";

import "./HkConfirmDialog.scss";
import HkButton from "./HkButton";
import HkModal from "./HkModal";
import { useHikariI18n } from "../i18n/context";

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
    const { t } = useHikariI18n();

    function onConfirm() {
      emit("confirm");
      emit("update:open", false);
    }

    function onCancel() {
      emit("cancel");
      emit("update:open", false);
    }

    return () => (
      <HkModal
        modelValue={props.open}
        title={props.title}
        closable={!props.loading}
        onUpdate:modelValue={(v: boolean) => emit("update:open", v)}
      >
        {{
          default: () => (
            <div class="hk-confirm-dialog">
              <p class="hk-confirm-dialog-message">{props.message}</p>
              <div class="hk-confirm-dialog-actions">
                <HkButton
                  variant="secondary"
                  size="sm"
                  disabled={props.loading}
                  onClick={onCancel}
                >
                  {props.cancelLabel || t("hk.confirmDialog.cancel", "Cancel")}
                </HkButton>
                <HkButton
                  variant={props.confirmVariant}
                  size="sm"
                  loading={props.loading}
                  onClick={onConfirm}
                >
                  {props.confirmLabel || t("hk.confirmDialog.confirm", "Confirm")}
                </HkButton>
              </div>
            </div>
          ),
        }}
      </HkModal>
    );
  },
});
