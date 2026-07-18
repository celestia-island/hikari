import { reactive } from "vue";

import { scheduleCronAfter, type CronHandle } from "./cronBus";

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

const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] });

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
  if (idx !== -1) state.toasts.splice(idx, 1);
  clearTimer(slotId);
}

function scheduleAutoDismiss(slot: ToastItem) {
  const duration = slot.duration ?? 0;
  if (duration <= 0) return;
  if (!isTransient(slot.type) && slot.type !== "loading") return;
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
  const msgId = ++nextMsgId;
  slot.messages.push({ id: msgId, text });
  scheduleAutoDismiss(slot);
  return msgId;
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
