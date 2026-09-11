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

    /**
     * Window chrome (✕, overlay click, Escape) is a DISMISS, never a no-op.
     *
     * `open` is caller-owned, so relaying the modal's close request as
     * `update:open` alone left the dialog on screen and the caller's promise
     * unsettled: the operator closed the window, nothing happened, and an
     * awaiting `useConfirm()` caller stayed pending until unmount (user
     * report, 2026-09-11). Routing the close through the cancel path settles
     * the caller and lets it take the window down.
     */
    function onModalUpdate(next: boolean) {
      if (next) {
        emit("update:open", true);
        return;
      }
      onCancel();
    }

    return () => (
      <HModal
        modelValue={props.open}
        title={props.title}
        closable={!props.loading}
        width="24rem"
        onUpdate:modelValue={onModalUpdate}
      >
        {{
          default: () => (
            <div class="hk-confirm-dialog">
              <p class="hk-confirm-dialog-message">{props.message}</p>
              {/* Primary action first, dismiss second — the message-box order
               *  the confirmation surfaces share (HkMessageBox,
               *  HkBlockingToast); form-dialog footers keep the primary
               *  rightmost. It mirrors under `dir="rtl"` because the row only
               *  reverses visually. */}
              <div class="hk-confirm-dialog-actions">
                <HButton
                  class="hk-confirm-dialog-btn"
                  variant={props.confirmVariant}
                  size="md"
                  loading={props.loading}
                  onClick={onConfirm}
                >
                  {props.confirmLabel || t("hikari::confirmDialog.confirm", "Confirm")}
                </HButton>
                <HButton
                  class="hk-confirm-dialog-btn"
                  variant="secondary"
                  size="md"
                  disabled={props.loading}
                  onClick={onCancel}
                >
                  {props.cancelLabel || t("hikari::confirmDialog.cancel", "Cancel")}
                </HButton>
              </div>
            </div>
          ),
        }}
      </HModal>
    );
  },
});
