import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

export interface CronHandle {
  disconnect(): void;
}

// Runtime-registry reporting (the "context of contexts"). Lazy: the bus
// reports itself on first schedule and pulses on every schedule/
// disconnect. Bare-timer cron has no inspectable state beyond its
// liveness, which is exactly what the registry is for.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("cronBus", {
    kind: "bus",
    description: "The bare timer bus (setInterval/setTimeout passthrough) used by cron-grade callers like toast auto-dismiss.",
  }));
}

export function scheduleCron(cb: () => void, intervalMs: number): CronHandle {
  const id = setInterval(cb, intervalMs);
  ensureRuntimeReport().pulse();
  return {
    disconnect() {
      clearInterval(id);
      runtimeReport?.pulse();
    },
  };
}

export function scheduleCronAfter(cb: () => void, delayMs: number): CronHandle {
  let fired = false;
  const id = setTimeout(() => {
    fired = true;
    cb();
  }, delayMs);
  ensureRuntimeReport().pulse();
  return {
    disconnect() {
      if (!fired) clearTimeout(id);
      runtimeReport?.pulse();
    },
  };
}
