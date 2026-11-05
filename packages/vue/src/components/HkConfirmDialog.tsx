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
            </div>
          ),
          /* The confirm pair lives in the modal's standard footer band —
           * it used to render inline under the message while HkMessageBox
           * (the sibling MODAL confirmation surface) already hosted the
           * same pair in this exact slot. HkBlockingToast keeps its own
           * inline pair by design — it is a toast card, not a modal — so
           * the family now has exactly two placements: this footer band
           * for every modal-hosted confirm, and the toast card's inline
           * row. Primary action first, dismiss second — the message-box
           * order; it mirrors under `dir="rtl"` because the row only
           * reverses visually. */
          footer: () => (
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
          ),
        }}
      </HModal>
    );
  },
});
