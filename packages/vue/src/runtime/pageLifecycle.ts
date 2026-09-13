/**
 * Page lifecycle context — one shared subscription source for
 * `visibilitychange` / `online` / `offline`.
 *
 * Every web UI in the platform needs the same three answers ("am I
 * visible", "am I online", "did either just change") but each app used to
 * hand-roll its own listeners — or, more often, had none at all. This
 * module installs ONE listener set lazily and fans the state out to any
 * number of consumers (Vue reactive refs via {@link usePageLifecycle},
 * plain callbacks via {@link onPageLifecycle}).
 *
 * Module-level singletons (no Vue app scoping needed — the page itself is
 * the scope). SSR-safe: reads defaults when `document` is absent.
 */
import { readonly, ref, type Ref } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

interface PageLifecycleState {
  visible: boolean;
  online: boolean;
}

const visible = ref(true);
const online = ref(true);
let installed = false;

type LifecycleListener = (state: PageLifecycleState) => void;
const listeners = new Set<LifecycleListener>();

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// lifecycle context reports itself on first subscribe/probe and pulses
// on every visibility/online transition it fans out.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("pageLifecycle", {
    kind: "context",
    description: "The page lifecycle context: visibility + online/offline state fanned out to framework-free listeners.",
    read: () => ({ ...currentState(), listeners: listeners.size }),
  }));
}

function currentState(): PageLifecycleState {
  return { visible: visible.value, online: online.value };
}

function notify(): void {
  runtimeReport?.pulse({ ...currentState() });
  const snapshot = currentState();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // A broken consumer must never take down the shared bus.
    }
  }
}

function install(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  visible.value = !document.hidden;
  online.value = typeof navigator === "undefined" ? true : navigator.onLine !== false;
  document.addEventListener("visibilitychange", () => {
    visible.value = !document.hidden;
    notify();
  });
  window.addEventListener("online", () => {
    online.value = true;
    notify();
  });
  window.addEventListener("offline", () => {
    online.value = false;
    notify();
  });
}

/** Reactive page lifecycle context (shared singleton). */
export function usePageLifecycle(): {
  visible: Readonly<Ref<boolean>>;
  online: Readonly<Ref<boolean>>;
} {
  install();
  ensureRuntimeReport();
  return { visible: readonly(visible), online: readonly(online) };
}

/**
 * Subscribe a plain callback to lifecycle transitions. Returns an
 * unsubscribe function. Framework-free so the interval bus (below) and
 * transports can use the same source.
 */
export function onPageLifecycle(listener: LifecycleListener): () => void {
  install();
  ensureRuntimeReport();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Imperative probe — no subscription. Reports to the runtime registry
 * too, so an install-through-probe (no subscriber ever) is still
 * observable. */
export function pageLifecycleState(): PageLifecycleState {
  install();
  ensureRuntimeReport();
  return currentState();
}

export type { PageLifecycleState, LifecycleListener as PageLifecycleListener };
