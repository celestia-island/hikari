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

interface PageLifecycleState {
  visible: boolean;
  online: boolean;
}

const visible = ref(true);
const online = ref(true);
let installed = false;

type LifecycleListener = (state: PageLifecycleState) => void;
const listeners = new Set<LifecycleListener>();

function currentState(): PageLifecycleState {
  return { visible: visible.value, online: online.value };
}

function notify(): void {
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
  return { visible: readonly(visible), online: readonly(online) };
}

/**
 * Subscribe a plain callback to lifecycle transitions. Returns an
 * unsubscribe function. Framework-free so the interval bus (below) and
 * transports can use the same source.
 */
export function onPageLifecycle(listener: LifecycleListener): () => void {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Imperative probe — no subscription. */
export function pageLifecycleState(): PageLifecycleState {
  install();
  return currentState();
}

export type { PageLifecycleState, LifecycleListener as PageLifecycleListener };
