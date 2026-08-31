import { defineComponent, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { useProgressDialog } from "../composables/useProgressDialog";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import HModal from "./HkModal";
import HProgressBar from "./HkProgressBar";
import HSpinner from "./HkSpinner";
import "./HkProgressDialog.scss";

export default defineComponent({
  name: "HkProgressDialog",
  setup() {
    const state = useProgressDialog();
    const logRef = ref<HTMLElement>();
    // Positioned wrapper around the conditional log pane — the rail host
    // (the modal body also holds the spinner/progress bands).
    const logWrapRef = ref<HTMLElement>();
    // Overlay scrollbar (shared chrome) on the conditional log pane —
    // attached when it mounts, detached when it unmounts.
    let logScrollbar: OverlayScrollbarHandle | null = null;

    function syncLogScrollbar() {
      void nextTick(() => {
        if (logRef.value) {
          logScrollbar ??= attachOverlayScrollbars(logRef.value, {
            axis: "vertical",
            host: logWrapRef.value,
          });
        } else {
          logScrollbar?.detach();
          logScrollbar = null;
        }
      });
    }

    watch(
      () => state.logs.length,
      () => {
        syncLogScrollbar();
        nextTick(() => {
          const el = logRef.value;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },
    );

    onBeforeUnmount(() => {
      logScrollbar?.detach();
      logScrollbar = null;
    });

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
            <div ref={logWrapRef} class="s-progress-dialog-log-wrap">
              <div ref={logRef} class="s-progress-dialog-log">
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {state.logs.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </HModal>
    );
  },
});
