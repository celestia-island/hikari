import { defineComponent, nextTick, ref, watch } from "vue";

import { useProgressDialog } from "../composables/useProgressDialog";
import HModal from "./HkModal";
import HProgressBar from "./HkProgressBar";
import HSpinner from "./HkSpinner";
import "./HkProgressDialog.scss";

export default defineComponent({
  name: "HkProgressDialog",
  setup() {
    const state = useProgressDialog();
    const logRef = ref<HTMLElement>();
    // ONE SCROLLBAR PER WINDOW (2026-09-08 audit): the log pane no longer
    // scrolls itself — its old 10rem cap + overlay rail was a second
    // scrollbar nested inside the modal window (the HkModal body
    // scroller). Tailing now scrolls THAT window to the bottom.
    function scrollWindowToBottom() {
      const win = logRef.value?.closest<HTMLElement>(".hk-modal-body-scroll");
      if (win) win.scrollTop = win.scrollHeight;
    }

    watch(
      () => state.logs.length,
      () => {
        void nextTick(scrollWindowToBottom);
      },
    );

    return () => (
      <HModal
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
            <HProgressBar value={state.value} max={state.max} showLabel size="sm" />
          ) : (
            <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
              <HSpinner />
            </div>
          )}
          {state.logs.length > 0 ? (
            <div ref={logRef} class="s-progress-dialog-log">
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {state.logs.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </HModal>
    );
  },
});
