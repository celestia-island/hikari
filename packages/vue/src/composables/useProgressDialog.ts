import { reactive } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "../runtime/registry";

export interface ProgressDialogState {
  open: boolean;
  title: string;
  logs: string[];
  value: number | null;
  max: number;
}

export interface ProgressDialogHandle {
  log(line: string): void;
  setProgress(done: number, total?: number): void;
  close(): void;
}

const MAX_LOG_LINES = 200;

const state = reactive<ProgressDialogState>({
  open: false,
  title: "",
  logs: [],
  value: null,
  max: 100,
});

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// progress-dialog context reports itself on first use and pulses on
// open/close, so the live dialog tree is answerable from
// readHkRuntime("progressDialog") without importing this module.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("progressDialog", {
    kind: "context",
    description: "The progress dialog context: the single global task-progress surface (title, log tail, value/max).",
    read: () => ({
      open: state.open,
      title: state.title,
      logLines: state.logs.length,
      value: state.value,
      max: state.max,
    }),
  }));
}

export function showProgressDialog(opts: { title: string }): ProgressDialogHandle {
  ensureRuntimeReport().pulse({ open: true, title: opts.title });
  state.title = opts.title;
  state.logs = [];
  state.value = null;
  state.max = 100;
  state.open = true;
  return {
    log(line: string) {
      state.logs.push(line);
      if (state.logs.length > MAX_LOG_LINES) {
        state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
      }
    },
    setProgress(done: number, total?: number) {
      if (typeof total === "number") state.max = total;
      state.value = done;
    },
    close() {
      state.open = false;
      runtimeReport?.pulse({ open: false });
    },
  };
}

export function useProgressDialog(): ProgressDialogState {
  ensureRuntimeReport();
  return state;
}
