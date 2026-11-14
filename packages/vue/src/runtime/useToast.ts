import { reactive } from "vue";

import { scheduleCronAfter, type CronHandle } from "./cronBus";
import { recordNotification, setNotificationState } from "./notificationCenter";
import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

export type ToastType = "error" | "success" | "warning" | "info" | "loading";

export const TOAST_DURATION: Record<ToastType, number> = {
  error: 30_000,
  warning: 30_000,
  success: 3_000,
  info: 3_000,
  loading: 0,
};

export function isTransient(type: ToastType): boolean {
  return type === "success" || type === "info";
}

export function defaultCopyable(type: ToastType): boolean {
  return type === "error" || type === "warning";
}

export interface ToastMessage {
  id: number;
  text: string;
}

/** One inline action button on a toast (e.g. "Undo" after a delete).
 *  The action belongs to the CURRENT slot state: every push sets or
 *  clears it, so the latest message decides what the button offers. */
export interface ToastAction {
  /** Button label (the caller i18n's it). */
  label: string;
  /** Runs when the button is clicked. The toast dismisses FIRST, then
   *  this handler runs — a throwing handler can never keep the toast
   *  alive. The button itself is single-shot: a second click during the
   *  leave transition is ignored. */
  onClick?: () => void;
}

export interface ToastItem {
  id: number;
  type: ToastType;
  messages: ToastMessage[];
  duration?: number;
  copyable?: boolean;
  /** Inline action button — see ToastAction. */
  action?: ToastAction;
  /**
   * Stable slot identity. Unkeyed pushes (the default) share ONE slot per
   * {@link ToastType} — the dedupe/stack lane every transient call site
   * uses. A keyed push addresses its own (key, type) slot instead, so a
   * long-lived surface (a sticky "machine incomplete" status, an
   * in-progress task) can sit in the same corner stack for hours WITHOUT
   * merging with — or inheriting the lifetime, the action, or the ✕ of —
   * same-type transient messages. The key is caller-chosen (namespaced
   * strings recommended); the item renders with its {@link ToastType}
   * icon/tone, which stays fixed for the slot's lifetime.
   */
  key?: string;
  /**
   * Whether the slot feeds the notification-center journal (user ruling
   * 2026-11-15: the tones worth a second look — error/warning — journal
   * by DEFAULT; success/info/loading only by explicit opt-in, because
   * journaling every 3s "Saved." buries the list in noise). Opt-in is
   * monotonic per slot like `copyable`: one `journal: true` push turns
   * the whole slot in. Journaling is a RECORD, not a replay — the
   * notification center shows what was said; a toast action button
   * (a caller closure) is never re-fired from there.
   */
  journal?: boolean;
}

/** Hard cap on stacked messages per toast slot. Beyond it the oldest
 *  messages are dropped so a noisy caller cannot bury the surface in
 *  unbounded history. */
export const MAX_TOASTS_PER_SLOT = 5;

const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] });

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// toast context reports itself on first useToast() call and pulses on
// every actual push/remove, so the live toast tree is answerable from
// readHkRuntime("toast") without importing this module. The
// registration API itself is unchanged.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("toast", {
    kind: "context",
    description: "The toast context: the stacked global toast slots (error/success/warning/info/loading).",
    read: () => ({
      slots: state.toasts.length,
      messages: state.toasts.reduce((n, t) => n + t.messages.length, 0),
      types: state.toasts.map((t) => t.type),
    }),
  }));
}

let nextSlotId = 0;
let nextMsgId = 0;

const timers = new Map<number, CronHandle>();

function clearTimer(slotId: number) {
  const t = timers.get(slotId);
  if (t !== undefined) {
    t.disconnect();
    timers.delete(slotId);
  }
}

function removeSlot(slotId: number) {
  const idx = state.toasts.findIndex((t) => t.id === slotId);
  if (idx !== -1) {
    const slot = state.toasts[idx];
    state.toasts.splice(idx, 1);
    // Journal bookkeeping: everything that just left the screen becomes
    // a "dismissed" record. Unknown-id no-ops cover messages pushed
    // before a later `journal: true` opt-in upgraded the slot.
    for (const m of slot.messages) {
      setNotificationState(`toast:${slot.id}:${m.id}`, "dismissed");
    }
    clearTimer(slotId);
    runtimeReport?.pulse();
  } else {
    clearTimer(slotId); // unknown-id no-ops stay pulse-silent
  }
}

function scheduleAutoDismiss(slot: ToastItem) {
  const duration = slot.duration ?? 0;
  if (duration <= 0) return;
  clearTimer(slot.id);
  timers.set(
    slot.id,
    scheduleCronAfter(() => removeSlot(slot.id), duration),
  );
}

function findSlot(type: ToastType, key?: string): ToastItem | undefined {
  if (key !== undefined) {
    // Keyed pushes address their own (key, type) slot only — never a
    // same-key slot of another tone, and never a transient (unkeyed)
    // slot; the unkeyed branch below is likewise blind to keyed slots.
    return state.toasts.find((t) => t.key === key && t.type === type);
  }
  return state.toasts.find((t) => t.type === type && t.key === undefined);
}

/** Journal one toast message as the slot sees it (no-op unless the slot
 *  journals). The entry mirrors the slot tone; dismissal is recorded by
 *  removeSlot / cap eviction, never here. */
function journalMessage(slot: ToastItem, msgId: number, text: string): void {
  if (!slot.journal) return;
  recordNotification({
    id: `toast:${slot.id}:${msgId}`,
    kind: "toast",
    tone: slot.type,
    title: text,
    state: "active",
  });
}

function push(
  type: ToastType,
  text: string,
  options: {
    key?: string;
    duration?: number;
    copyable?: boolean;
    action?: ToastAction;
    journal?: boolean;
  } = {},
): number {
  let slot = findSlot(type, options.key);
  if (!slot) {
    slot = {
      id: ++nextSlotId,
      type,
      messages: [],
      duration: options.duration ?? TOAST_DURATION[type],
      copyable: options.copyable ?? defaultCopyable(type),
      action: options.action,
      journal: options.journal ?? (type === "error" || type === "warning"),
      ...(options.key !== undefined ? { key: options.key } : {}),
    };
    state.toasts.push(slot);
  } else {
    if (options.copyable === true && !slot.copyable) {
      slot.copyable = true;
    }
    // Journal opt-in is monotonic (same shape as the copyable upgrade).
    if (options.journal === true && !slot.journal) {
      slot.journal = true;
    }
    // Latest push owns the action: re-passing it keeps the button, a
    // plain message (no action) clears it off the shared slot.
    slot.action = options.action;
  }
  let msgId: number;
  const last = slot.messages[slot.messages.length - 1];
  if (last && last.text === text) {
    // Dedupe: an identical consecutive message (same slot + same text in
    // the current stack) replaces the previous entry instead of appending —
    // the surface keeps a single entry and the auto-dismiss clock restarts.
    msgId = last.id;
  } else {
    msgId = ++nextMsgId;
    slot.messages.push({ id: msgId, text });
  }
  // Cap: drop the oldest messages beyond the per-slot cap. Evicted
  // messages left the screen without user action — record them
  // "dismissed" so the journal keeps what the stack had to forget.
  while (slot.messages.length > MAX_TOASTS_PER_SLOT) {
    const evicted = slot.messages.shift();
    if (evicted) {
      setNotificationState(`toast:${slot.id}:${evicted.id}`, "dismissed");
    }
  }
  journalMessage(slot, msgId, text);
  scheduleAutoDismiss(slot);
  runtimeReport?.pulse();
  return msgId;
}

export function useToast() {
  ensureRuntimeReport();
  function show(
    message: string,
    options: Partial<Omit<ToastItem, "id" | "messages">> = {},
  ) {
    const type = options.type || "info";
    return push(type, message, {
      key: options.key,
      duration: options.duration,
      copyable: options.copyable,
      action: options.action,
      journal: options.journal,
    });
  }

  function error(message: string, copyable = true) {
    return push("error", message, { copyable });
  }
  function success(message: string) {
    return push("success", message);
  }
  function warning(message: string) {
    return push("warning", message);
  }
  function info(message: string) {
    return push("info", message);
  }
  function loading(message: string, maxDuration = 0) {
    const opts: { duration?: number } = {};
    if (maxDuration > 0) opts.duration = maxDuration;
    return push("loading", message, opts);
  }

  function remove(id: number) {
    const slotById = state.toasts.find((t) => t.id === id);
    if (slotById) {
      removeSlot(slotById.id);
      return;
    }
    for (const slot of state.toasts) {
      if (slot.messages.some((m) => m.id === id)) {
        removeSlot(slot.id);
        return;
      }
    }
  }

  return { toasts: state.toasts, show, error, success, warning, info, loading, remove };
}
