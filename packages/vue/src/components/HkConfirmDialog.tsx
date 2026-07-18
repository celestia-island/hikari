import { computed, defineComponent, type PropType } from "vue";
import HkModal from "./HkModal";
import "../../../components/src/styles/components/button.scss";
import "../../../components/src/styles/components/button-vars.scss";

export default defineComponent({
  name: "HkConfirmDialog",
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: "Confirm" },
    message: { type: String },
    confirmText: { type: String, default: "Confirm" },
    cancelText: { type: String, default: "Cancel" },
  },
  emits: {
    confirm: () => true,
    cancel: () => true,
  },
  setup(props, { emit }) {
    return () => (
      <HkModal open={props.open} title={props.title} onClose={() => emit("cancel")}>
        <p style={{ margin: "0 0 1.5rem", color: "var(--hi-color-text-primary, #333)" }}>{props.message}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            class="hikari-btn hikari-btn--secondary hikari-btn--md"
            onClick={() => emit("cancel")}
          >
            {props.cancelText}
          </button>
          <button
            class="hikari-btn hikari-btn--primary hikari-btn--md"
            onClick={() => emit("confirm")}
          >
            {props.confirmText}
          </button>
        </div>
      </HkModal>
    );
  },
});
