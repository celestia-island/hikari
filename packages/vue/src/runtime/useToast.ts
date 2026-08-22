import { reactive } from "vue";

import { scheduleCronAfter, type CronHandle } from "./cronBus";
import { mirrorToBrowserIfHidden } from "../composables/messaging/browserTransport";

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

export interface ToastItem {
  id: number;
  type: ToastType;
  messages: ToastMessage[];
  duration?: number;
  copyable?: boolean;
}

/** Hard cap on stacked messages per toast slot. Beyond it the oldest
 *  messages are dropped so a noisy caller cannot bury the surface in
 *  unbounded history. */
export const MAX_TOASTS_PER_SLOT = 5;

const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] });

let nextSlotId = 0;
let nextMsgId = 0;

/** Re-entrancy guard: the messaging router already covers the browser
 *  surface for payloads it routed, so its toast-transport calls must not
 *  mirror again (double notification). */
let suppressMirror = false;

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
  if (idx !== -1) state.toasts.splice(idx, 1);
  clearTimer(slotId);
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

function findSlot(type: ToastType): ToastItem | undefined {
  return state.toasts.find((t) => t.type === type);
}

function push(
  type: ToastType,
  text: string,
  options: { duration?: number; copyable?: boolean } = {},
): number {
  const mirror = !suppressMirror;
  let slot = findSlot(type);
  if (!slot) {
    slot = {
      id: ++nextSlotId,
      type,
      messages: [],
      duration: options.duration ?? TOAST_DURATION[type],
      copyable: options.copyable ?? defaultCopyable(type),
    };
    state.toasts.push(slot);
  } else if (options.copyable === true && !slot.copyable) {
    slot.copyable = true;
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
  // Cap: drop the oldest messages beyond the per-slot cap.
  while (slot.messages.length > MAX_TOASTS_PER_SLOT) {
    slot.messages.shift();
  }
  scheduleAutoDismiss(slot);
  // Unified visibility behavior (P59-W5): every actionable toast — not just
  // the ones that went through useMessaging — also lands as an OS
  // notification while the page is hidden, so direct useToast callers
  // (error handlers, RPC layers) are no longer silently dropped when the
  // user is in another tab. No-op without granted permission.
  if (mirror) {
    mirrorToBrowserIfHidden(type, text, slot.duration, slot.copyable);
  }
  return msgId;
}

/** Internal: wrap a push in the mirror-suppression guard (used by the
 *  messaging toast transport so router-routed payloads don't double-fire). */
export function pushViaTransport(
  type: ToastType,
  text: string,
  options: { duration?: number; copyable?: boolean } = {},
): number {
  suppressMirror = true;
  try {
    return push(type, text, options);
  } finally {
    suppressMirror = false;
  }
}

export function useToast() {
  function show(
    message: string,
    options: Partial<Omit<ToastItem, "id" | "messages">> = {},
  ) {
    const type = options.type || "info";
    return push(type, message, {
      duration: options.duration,
      copyable: options.copyable,
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
