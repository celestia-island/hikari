import { computed, defineComponent, Teleport, type PropType } from "vue";
import "../../../components/src/styles/components/modal.scss";
import "../../../components/src/styles/components/modal-vars.scss";

export default defineComponent({
  name: "HkModal",
  props: {
    open: { type: Boolean, default: false },
    title: { type: String },
    width: { type: String, default: "520px" },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <Teleport to="body">
        {props.open && (
          <div class="hikari-modal-overlay" onClick={() => emit("close")}>
            <div class="hikari-modal" style={{ width: props.width }}>
              {props.title && (
                <div class="hikari-modal__header">
                  <h3>{props.title}</h3>
                  <button class="hikari-modal__close" onClick={() => emit("close")}>&times;</button>
                </div>
              )}
              <div class="hikari-modal__body">
                {slots.default?.()}
              </div>
            </div>
          </div>
        )}
      </Teleport>
    );
  },
});
