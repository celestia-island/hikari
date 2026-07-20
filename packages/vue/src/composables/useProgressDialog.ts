import { reactive } from "vue";

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

export function showProgressDialog(opts: { title: string }): ProgressDialogHandle {
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
    },
  };
}

export function useProgressDialog(): ProgressDialogState {
  return state;
}
