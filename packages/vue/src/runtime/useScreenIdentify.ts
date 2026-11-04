import { computed, readonly, ref, type ComputedRef, type Ref } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

/**
 * The screen-identify context — "which screen am I?" as a first-class
 * hikari surface.
 *
 * One window (or one physical screen) flashes a large numbered card in a
 * corner for a few seconds when the user asks the app to identify the
 * display it belongs to. The CARD (`HkScreenIdentifyCard`) and its HUD
 * host (`HkScreenIdentifyHost`) are the visual half; this module is the
 * state half — the shared context any part of the app (a tray, a screen
 * board, a keyboard shortcut) can drive without prop-drilling, and the
 * one place the flash's lifetime and countdown are defined.
 *
 * ## Why a module-singleton "context" (toast/blocking-toast shape)
 *
 * The identify flash is genuinely global: a peer window's "identify"
 * message, a board node's flash button and the board's toolbar all mean
 * the same thing for THIS window, and none of them owns the overlay. The
 * app-facing API therefore mirrors `useToast()`: call
 * `showScreenIdentify(...)` from anywhere, mount `HkScreenIdentifyHost`
 * once. It registers with the runtime registry (`readHkRuntime(
 * "screenIdentify")`) like every other hikari context, so a debugging
 * host can answer "is a flash up, for which number, how long left?"
 * without importing this module.
 *
 * ## What the caller owns vs what hikari owns
 *
 * Hikari owns the DWELL (auto-dismiss + ticked countdown) and the LAYER
 * (`HkScreenIdentifyHost` rides `HkAmbientLayer` → `#hk-hud-root`, above
 * every popup, modal backdrop included). The app owns DISCOVERY — how
 * screens find each other, how numbers are assigned, how one screen asks
 * another to flash. That transport is app-specific (BroadcastChannel,
 * Tauri windows, WebSocket) and deliberately not in this module; the app
 * calls `showScreenIdentify()` when its own protocol says "flash".
 */

/** Default dwell — long enough to walk along a wall of screens, short
 *  enough that a stray click does not leave a number hanging. */
export const SCREEN_IDENTIFY_DEFAULT_MS = 3_000;

/** Countdown tick. The visible card prints whole seconds; 100ms keeps
 *  the remaining-time ref honest without waking the renderer per frame. */
export const SCREEN_IDENTIFY_TICK_MS = 100;

/** One identify request. `number` is the fleet-wide screen number the
 *  app assigned (1-based by convention); `name` is any stable label the
 *  card may print under the number. */
export interface ScreenIdentifyRequest {
  number: number | string;
  /** Stable screen name (Tauri window label, short id, user title). */
  name?: string;
  /** Dwell in ms. Defaults to {@link SCREEN_IDENTIFY_DEFAULT_MS}; `0`
   *  (or negative) keeps the card up until `dismissScreenIdentify()`.
   *  The card prints WHOLE SECONDS through hikari's single-digit
   *  countdown surface, so dwells above 9 s render a clipped tens digit —
   *  identify is a glance, keep it in single digits. */
  durationMs?: number;
}

/** Read side handed to components and app code. */
export interface ScreenIdentifyContext {
  /** Whether a card is up in THIS window. */
  active: Readonly<Ref<boolean>>;
  /** The number the card prints. */
  number: Readonly<Ref<number | string>>;
  /** Optional name line. */
  name: Readonly<Ref<string | undefined>>;
  /** Milliseconds left on the dwell (0 when idle or held open). */
  remainingMs: Readonly<Ref<number>>;
  /** Whole seconds left, clamped to ≥1 while active (the card's rolling
   *  digit); 0 when idle, so the countdown unmounts with the badge. */
  secondsLeft: ComputedRef<number>;
  /** Start (or restart) the flash. */
  show: typeof showScreenIdentify;
  /** Hide immediately. */
  dismiss: typeof dismissScreenIdentify;
}

const state = {
  active: ref(false),
  number: ref<number | string>(0),
  name: ref<string | undefined>(undefined),
  remainingMs: ref(0),
};

/** Dwell deadline (epoch ms); 0 when the card is held open by the
 *  caller (`durationMs <= 0`) or idle. */
let endsAt = 0;
let identifyTimer: ReturnType<typeof setTimeout> | null = null;
let identifyTick: ReturnType<typeof setInterval> | null = null;

function clearTimers(): void {
  if (identifyTimer) clearTimeout(identifyTimer);
  identifyTimer = null;
  if (identifyTick) clearInterval(identifyTick);
  identifyTick = null;
}

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// identify context reports itself on first useScreenIdentify() call and
// pulses on every show/dismiss, so the live flash is answerable from
// readHkRuntime("screenIdentify") without importing this module.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("screenIdentify", {
    kind: "context",
    description:
      "The screen-identify context: the per-window numbered card's payload, dwell and countdown.",
    read: () => ({
      active: state.active.value,
      number: state.number.value,
      name: state.name.value,
      remainingMs: state.remainingMs.value,
    }),
  }));
}

/**
 * Flash this window's screen number. Restarts an in-flight flash (a
 * second identify must not stack cards or inherit the old deadline).
 */
export function showScreenIdentify(request: ScreenIdentifyRequest): void {
  ensureRuntimeReport();
  clearTimers();

  const duration = request.durationMs ?? SCREEN_IDENTIFY_DEFAULT_MS;
  state.number.value = request.number;
  state.name.value = request.name;
  state.active.value = true;

  if (!Number.isFinite(duration) || duration <= 0) {
    // Held open by the caller: no dwell, no countdown.
    endsAt = 0;
    state.remainingMs.value = 0;
    runtimeReport?.pulse();
    return;
  }

  endsAt = Date.now() + duration;
  state.remainingMs.value = duration;
  // Ticked, not one-shot: the card shows the seconds remaining, so the
  // remaining time has to be readable while the flash is up.
  identifyTick = setInterval(() => {
    // The tick only REPORTS the remainder. It must not clear the dwell
    // timeout: at t=duration both fire in schedule order and an interval
    // that cancelled its own timer left the flash active forever
    // (caught by the auto-hide test). It also never WRITES a 0 remainder:
    // the timeout is what ends the flash, and a 0 tick one task earlier
    // would paint a countdown-less card for one frame (R2 S3).
    const left = endsAt - Date.now();
    if (left > 0) state.remainingMs.value = left;
  }, SCREEN_IDENTIFY_TICK_MS);
  identifyTimer = setTimeout(() => {
    identifyTimer = null;
    if (identifyTick) clearInterval(identifyTick);
    identifyTick = null;
    state.remainingMs.value = 0;
    state.active.value = false;
    runtimeReport?.pulse();
  }, duration);
  runtimeReport?.pulse();
}

/** Hide the flash immediately (idempotent). */
export function dismissScreenIdentify(): void {
  clearTimers();
  endsAt = 0;
  state.active.value = false;
  state.remainingMs.value = 0;
  state.name.value = undefined;
  runtimeReport?.pulse();
}

/**
 * The identify context accessor. Safe outside a component scope (module
 * singleton); every returned ref is read-only to the caller — mutations
 * go through `show` / `dismiss` so the timers can never drift from the
 * visible state.
 */
export function useScreenIdentify(): ScreenIdentifyContext {
  ensureRuntimeReport();
  return {
    active: readonly(state.active),
    number: readonly(state.number),
    name: readonly(state.name),
    remainingMs: readonly(state.remainingMs),
    secondsLeft: computed(() =>
      state.active.value && state.remainingMs.value > 0
        ? Math.max(1, Math.ceil(state.remainingMs.value / 1000))
        : 0,
    ),
    show: showScreenIdentify,
    dismiss: dismissScreenIdentify,
  };
}
