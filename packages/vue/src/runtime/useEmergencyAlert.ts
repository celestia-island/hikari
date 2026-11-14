import { reactive } from "vue";

import {
  recordNotification,
  setNotificationState,
} from "./notificationCenter";
import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

/**
 * Emergency-alert context — the fourth member of the toast family.
 *
 * Where HkToast is the transient corner stack, HkBlockingToast a
 * flow-blocking gate and HkPersistentToast a chrome-bar status chip,
 * the emergency alert is the FULL-SCREEN takeover: an independent
 * dimming layer plus one full-width signal-striped band, reserved for
 * conditions that invalidate normal work until resolved (quota
 * exhausted, every platform link down). It is raised by ID and stays
 * on screen until the CONDITION clears (`clearEmergencyAlert`) or the
 * user snoozes it — there is no auto-dismiss timer.
 *
 * Episode semantics (user direction 2026-11-13): re-raising an id
 * that is already active UPDATES it in place (a poller may re-raise
 * every cycle) and never resets a snooze; only `clearEmergencyAlert`
 * ends the episode, wiping the snooze record so the NEXT occurrence
 * of the same condition alerts again. Snooze state survives reloads
 * via sessionStorage.
 *
 * Rendering lives in `components/HkEmergencyAlert.tsx` — mount
 * `<HEmergencyAlert />` once at the shell level. When several alerts
 * are active only the most severe (danger > warning, then raise
 * order) takes the band; the rest are counted in a "+N more" line.
 */

export type EmergencySeverity = "danger" | "warning";

/** Severity rank for the single-band policy: danger outranks warning. */
export function emergencySeverityRank(severity: EmergencySeverity): number {
  return severity === "danger" ? 2 : 1;
}

/** One action button on the band. The label arrives pre-translated
 *  (same contract as HkErrorLanding); `kind` picks the weight. */
export interface EmergencyAction {
  /** Pre-translated button label (the caller i18n's it). */
  label: string;
  /** `primary` renders the emphasized button (danger/primary variant
   *  by severity); `ghost` the quiet one. The first action defaults
   *  to `primary`, later ones to `ghost`. */
  kind?: "primary" | "ghost";
  onClick?: () => void;
}

export interface EmergencyAlertOptions {
  /** Stable caller-chosen identity (namespaced strings recommended).
   *  Re-raise with the same id updates in place without reviving a
   *  snooze; the id also keys the sessionStorage snooze record. */
  id: string;
  severity: EmergencySeverity;
  /** Pre-translated headline, e.g. "警告：所有平台连接已断开". */
  title: string;
  /** Pre-translated secondary line; newlines render as line breaks. */
  description?: string;
  /** Wire code chip (mono HkBadge), e.g. `ALL_PLATFORMS_DOWN`. */
  code?: string;
  /** FUI micro-label above the title (mono, wide tracking). Falls
   *  back to the per-severity i18n word. */
  kicker?: string;
  /** Host actions, first = primary. The built-in snooze button is
   *  appended when `dismissible` is true. */
  actions?: EmergencyAction[];
  /** Whether the built-in "hide for now" (snooze) button is offered.
   *  Default true; hosts reserve it for conditions a user may safely
   *  work through (a red all-platforms-down alert typically sets
   *  false — user direction 2026-11-13). */
  dismissible?: boolean;
  /** Runs when the user snoozes the alert (the snooze itself is the
   *  context's job; this is a host-side hook, e.g. analytics). */
  onSnooze?: () => void;
}

export interface EmergencyAlertItem {
  id: string;
  severity: EmergencySeverity;
  title: string;
  description: string;
  code: string;
  kicker: string;
  actions: EmergencyAction[];
  dismissible: boolean;
  onSnooze?: () => void;
  /** Raise order for same-severity tie-breaks. */
  seq: number;
  /** Hidden by the user; stays hidden until the episode clears. */
  snoozed: boolean;
}

const state = reactive<{ alerts: EmergencyAlertItem[] }>({ alerts: [] });

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// emergency context reports itself on first raise and pulses on every
// raise/snooze/clear, so the live alert set is answerable from
// readHkRuntime("emergencyAlert") without importing this module.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("emergencyAlert", {
    kind: "context",
    description:
      "The emergency-alert context: full-screen takeover bands for conditions that invalidate normal work until resolved.",
    read: () => ({
      active: state.alerts.map((a) => ({ id: a.id, severity: a.severity })),
      snoozed: state.alerts.filter((a) => a.snoozed).length,
    }),
  }));
}

let nextSeq = 0;

/** sessionStorage-backed snooze record. An id in the set stays hidden
 *  across reloads until its episode is cleared. All access is guarded:
 *  SSR, privacy modes and quota errors must never break raising. */
const SNOOZE_KEY = "hk-emergency-snooze";

function readSnoozeSet(): Set<string> {
  try {
    const raw = globalThis.sessionStorage?.getItem(SNOOZE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeSnoozeSet(set: Set<string>): void {
  try {
    globalThis.sessionStorage?.setItem(SNOOZE_KEY, JSON.stringify([...set]));
  } catch {
    /* recording the snooze is best-effort; hiding now still works */
  }
}

/** Mirror one alert into the notification-center journal: the episode's
 *  journal entry (id `emergency:<alert id>`) tracks the band through
 *  active → snoozed → (unsnooze) → cleared. `onResummon` wires the
 *  panel's "show again" button to the real unsnooze path — the one
 *  reversible record in the journal (toast records are replay-free).
 *  The callback arms ONLY for a snoozed item (R2 finding, PR #1322):
 *  an on-screen band has nothing to restore, and a dead button would
 *  just be a promise unsnooze keeps refusing. */
function journalEpisode(id: string, item: EmergencyAlertItem): void {
  recordNotification({
    id: `emergency:${id}`,
    kind: "emergency",
    tone: item.severity === "danger" ? "error" : "warning",
    title: item.title,
    detail: item.description !== "" ? item.description : undefined,
    code: item.code !== "" ? item.code : undefined,
    state: item.snoozed ? "snoozed" : "active",
    ...(item.snoozed ? { onResummon: () => unsnoozeEmergencyAlert(id) } : {}),
  });
}

/** Raise (or update) an emergency alert. Re-raising an active id
 *  updates its content in place and NEVER resets the snooze state —
 *  pollers may call this every cycle. */
export function raiseEmergencyAlert(opts: EmergencyAlertOptions): void {
  const existing = state.alerts.find((a) => a.id === opts.id);
  if (existing) {
    existing.severity = opts.severity;
    existing.title = opts.title;
    existing.description = opts.description ?? "";
    existing.code = opts.code ?? "";
    existing.kicker = opts.kicker ?? "";
    existing.actions = opts.actions ?? [];
    existing.dismissible = opts.dismissible ?? true;
    existing.onSnooze = opts.onSnooze;
    journalEpisode(opts.id, existing);
    runtimeReport?.pulse();
    return;
  }
  const item: EmergencyAlertItem = {
    id: opts.id,
    severity: opts.severity,
    title: opts.title,
    description: opts.description ?? "",
    code: opts.code ?? "",
    kicker: opts.kicker ?? "",
    actions: opts.actions ?? [],
    dismissible: opts.dismissible ?? true,
    onSnooze: opts.onSnooze,
    seq: ++nextSeq,
    snoozed: readSnoozeSet().has(opts.id),
  };
  state.alerts.push(item);
  journalEpisode(opts.id, item);
  // Lazy first-use registration (same contract as useToast/useBlockingToast):
  // the context reports itself on the first raise so the live alert set is
  // answerable from readHkRuntime("emergencyAlert").
  ensureRuntimeReport().pulse();
}

/** End the episode for an id: remove the alert AND wipe its snooze
 *  record, so the condition's next occurrence alerts again. Clearing
 *  an unknown id is a no-op (a late poll racing a user snooze). */
export function clearEmergencyAlert(id: string): void {
  const idx = state.alerts.findIndex((a) => a.id === id);
  if (idx !== -1) state.alerts.splice(idx, 1);
  const snooze = readSnoozeSet();
  if (snooze.delete(id)) writeSnoozeSet(snooze);
  // The episode is over; the journal KEEPS the entry as "cleared"
  // (user ruling 2026-11-15: resolved episodes stay reviewable).
  setNotificationState(`emergency:${id}`, "cleared");
  runtimeReport?.pulse();
}

/** User-facing "hide for now": the alert stays registered (snoozed)
 *  so re-raises never revive it; only `clearEmergencyAlert` ends the
 *  episode. Snoozing an unknown or already-hidden id is a no-op. */
export function snoozeEmergencyAlert(id: string): void {
  const item = state.alerts.find((a) => a.id === id);
  if (!item || item.snoozed) return;
  item.snoozed = true;
  const snooze = readSnoozeSet();
  snooze.add(id);
  writeSnoozeSet(snooze);
  // Re-record (not bare setNotificationState): a snoozed episode's
  // journal entry must now ARM the resummon callback — the restore
  // button's whole job (R2 finding, PR #1322).
  journalEpisode(id, item);
  item.onSnooze?.();
  runtimeReport?.pulse();
}

/** Undo a snooze: the alert becomes visible again (the band returns)
 *  and the storage record is wiped, so the episode is live once more.
 *  Unknown or already-visible ids are no-ops. This is the user-facing
 *  "restore from the persistent chip" path — clearing the CONDITION is
 *  still `clearEmergencyAlert`'s job. */
export function unsnoozeEmergencyAlert(id: string): void {
  const item = state.alerts.find((a) => a.id === id);
  if (!item || !item.snoozed) return;
  item.snoozed = false;
  const snooze = readSnoozeSet();
  if (snooze.delete(id)) writeSnoozeSet(snooze);
  // The band returns — journal entry follows (and the notification
  // center's restore button lands here via the entry's onResummon).
  setNotificationState(`emergency:${id}`, "active");
  runtimeReport?.pulse();
}

/** Drop every alert and the whole snooze record. Test/teardown helper
 *  (the emergency twin of `clearBlockingToasts`). */
export function resetEmergencyAlerts(): void {
  state.alerts.splice(0, state.alerts.length);
  try {
    globalThis.sessionStorage?.removeItem(SNOOZE_KEY);
  } catch {
    /* best-effort */
  }
  runtimeReport?.pulse();
}

export function useEmergencyAlert() {
  return {
    /** Reactive alert set rendered by HkEmergencyAlert. */
    alerts: state.alerts,
    raise: raiseEmergencyAlert,
    clear: clearEmergencyAlert,
    snooze: snoozeEmergencyAlert,
  };
}
