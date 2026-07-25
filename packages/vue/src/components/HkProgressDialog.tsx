import { defineComponent, nextTick, ref, watch } from "vue";

import { useProgressDialog } from "../composables/useProgressDialog";
import Modal from "./HkModal";
import ProgressBar from "./HkProgressBar";
import Spinner from "./HkSpinner";

export default defineComponent({
  name: "HkProgressDialog",
  setup() {
    const state = useProgressDialog();
    const logRef = ref<HTMLElement>();

    watch(
      () => state.logs.length,
      () => {
        nextTick(() => {
          const el = logRef.value;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },
    );

    return () => (
      <Modal
        modelValue={state.open}
        onUpdate:modelValue={() => {
          /* non-closable */
        }}
        closable={false}
        title={state.title}
        width="30rem"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.25rem 0" }}>
          {state.value !== null ? (
            <ProgressBar value={state.value} max={state.max} showLabel size="sm" />
          ) : (
            <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
              <Spinner />
            </div>
          )}
          {state.logs.length > 0 ? (
            <div
              ref={logRef}
              style={{
                maxHeight: "10rem",
                overflow: "hidden auto",
                borderRadius: "0.375rem",
                background: "rgba(0, 0, 0, 0.06)",
                padding: "0.5rem",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                lineHeight: "1.5",
              }}
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {state.logs.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  },
});
