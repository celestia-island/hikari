import { reactive } from "vue";

import { scheduleCronAfter, type CronHandle } from "./cronBus";

export type BlockingToastVariant = "info" | "warning" | "danger";

export interface BlockingToastOptions {
  /** Bold lead-in line (e.g. "Join group?"). */
  title?: string;
  /** Confirm button label; defaults to the i18n "Confirm" string. */
  confirmLabel?: string;
  /** Cancel button label; defaults to the i18n "Cancel" string. */
  cancelLabel?: string;
  /** Visual tone of the card. */
  variant?: BlockingToastVariant;
  /** Milliseconds before the gate auto-resolves `false`. Default: no
   *  timeout — the prompt blocks until explicitly answered. */
  timeoutMs?: number;
}

export interface BlockingToastItem {
  id: number;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant: BlockingToastVariant;
  timeoutMs?: number;
}

/**
 * Blocking-toast gate — toast-shaped, flow-blocking confirmation prompts.
 *
 * Primary use case: consent gates such as "joining this group lets its
 * admins view your personal workspace usage — confirm?" — less chrome
 * than HkConfirmDialog (no centered modal, no scroll lock), but unlike a
 * normal toast the prompt never auto-dismisses: the returned promise
 * settles only on an explicit confirm/cancel (or an optional timeout).
 *
 * Rendering lives in `components/HkBlockingToast.tsx` — mount
 * `<HBlockingToast />` once (next to `<HToast />`) at the shell level;
 * calls made while no host is mounted queue up and resolve once the
 * host appears (same contract as useToast/HkToast).
 *
 * Queue model: pending prompts are STACKED, not serialized — every
 * `showBlockingToast` call renders its own card simultaneously and
 * resolves independently (matching how normal toasts stack). A prompt
 * does not wait for earlier ones to be answered.
 */
const state = reactive<{ queue: BlockingToastItem[] }>({ queue: [] });

const resolvers = new Map<number, (value: boolean) => void>();
const timers = new Map<number, CronHandle>();
let nextId = 0;

function settle(id: number, value: boolean) {
  const resolve = resolvers.get(id);
  if (!resolve) return;
  resolvers.delete(id);
  const timer = timers.get(id);
  if (timer !== undefined) {
    timer.disconnect();
    timers.delete(id);
  }
  const idx = state.queue.findIndex((item) => item.id === id);
  if (idx !== -1) state.queue.splice(idx, 1);
  resolve(value);
}

/** Show a blocking confirmation toast. Resolves `true` on confirm,
 *  `false` on cancel (or timeout expiry). */
export function showBlockingToast(
  message: string,
  opts: BlockingToastOptions = {},
): Promise<boolean> {
  const id = ++nextId;
  const item: BlockingToastItem = {
    id,
    message,
    title: opts.title,
    confirmLabel: opts.confirmLabel,
    cancelLabel: opts.cancelLabel,
    variant: opts.variant ?? "info",
    timeoutMs: opts.timeoutMs,
  };
  return new Promise<boolean>((resolve) => {
    state.queue.push(item);
    resolvers.set(id, resolve);
    const timeout = opts.timeoutMs ?? 0;
    if (timeout > 0) {
      timers.set(id, scheduleCronAfter(() => settle(id, false), timeout));
    }
  });
}

/** Resolve one prompt programmatically (value: confirm=true). */
export function resolveBlockingToast(id: number, value: boolean): void {
  settle(id, value);
}

/** Resolve every pending prompt as `false` (test/teardown helper). */
export function clearBlockingToasts(): void {
  for (const item of [...state.queue]) settle(item.id, false);
}

export function useBlockingToast() {
  return {
    /** Reactive stack of pending prompts rendered by HkBlockingToast. */
    queue: state.queue,
    show: showBlockingToast,
  };
}
