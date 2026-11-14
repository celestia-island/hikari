import { reactive } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

/**
 * Notification-center journal — the storage half of the toast family.
 *
 * Every dismissing surface (HkToast slots, HkBlockingToast gates, the
 * emergency band, host persistent chips) records what it showed here,
 * so "hide for now" / auto-dismiss / settle never means "gone": a bell
 * (HkNotificationBell) re-summons the list anywhere the host mounts it.
 * This module owns ONLY the ledger — placement, rendering and what the
 * host considers worth recording are downstream decisions (the same
 * split as HkAdminHeader owning the cluster grammar while the page owns
 * its actions).
 *
 * Sources write through `recordNotification` (create-or-update by id)
 * and `setNotificationState` (lifecycle transition). The built-in hooks:
 *   - useToast: error/warning slots journal by default, other tones by
 *     explicit `journal: true`; slot removal / cap eviction flips the
 *     entries to "dismissed".
 *   - useBlockingToast: settle (confirm/cancel/timeout) journals the
 *     gate as "dismissed".
 *   - useEmergencyAlert: raise/snooze/unsnooze/clear mirror the episode
 *     into one entry per alert id ("active"/"snoozed"/"cleared").
 * Persistent chips are host-recorded (`recordNotification` with
 * kind "persistent"), because dismissal semantics are host-owned there.
 *
 * Retention (user ruling 2026-11-15): sessionStorage-scoped — survives
 * reloads and route changes, dies with the browser session — plus a
 * 100-entry ring buffer so a noisy caller cannot bury the list. Reads
 * and writes are guarded like the emergency snooze record: SSR,
 * privacy modes and quota errors must never break a push.
 *
 * Replay semantics (user ruling 2026-11-15): a journal entry is a
 * RECORD of what was shown, not a live re-raise — toast actions are
 * caller closures and are never replayed. The one reversible case is a
 * snoozed emergency alert, whose entry carries `onResummon` (wired by
 * useEmergencyAlert to `unsnoozeEmergencyAlert`; in-memory only, so a
 * reloaded entry renders without the button until the alert re-raises).
 *
 * Unread: an entry is born unread; nothing but the bell panel clears
 * the flag (open = all read), so the dot answers "did I miss anything",
 * not "is something on screen right now".
 */

export type HkNotificationKind =
  | "toast"
  | "blocking"
  | "emergency"
  | "persistent"
  | "custom";

export type HkNotificationTone =
  | "error"
  | "success"
  | "warning"
  | "info"
  | "loading";

/** Entry lifecycle. `active` = on screen (or registered for the
 *  emergency band); the other three are historical states kept so the
 *  list can show what happened, not just what is showing. */
export type HkNotificationState =
  | "active"
  | "snoozed"
  | "dismissed"
  | "cleared";

export interface HkNotificationEntry {
  /** Source-qualified identity (e.g. `toast:3:12`, `emergency:<alert id>`).
   *  Re-recording the same id updates in place — pollers may repeat. */
  id: string;
  kind: HkNotificationKind;
  tone: HkNotificationTone;
  /** Primary line (pre-translated by the source, same contract as the
   *  toast/emergency surfaces themselves). */
  title: string;
  /** Secondary line (emergency description, blocking heading context). */
  detail?: string;
  /** Mono chip text (e.g. `QUOTA_EXHAUSTED`). */
  code?: string;
  /** First time this id was recorded (epoch ms). */
  raisedAt: number;
  /** Last mutation (epoch ms) — the list sorts by this, newest first. */
  updatedAt: number;
  state: HkNotificationState;
  read: boolean;
  /** Present ONLY while a live resummon path exists (snoozed emergency
   *  alerts; never persisted — callbacks cannot survive a reload). */
  onResummon?: () => void;
}

/** Create-or-update input; every field except `id`/`kind`/`tone`/`title`
 *  has the journal's default. */
export interface HkNotificationRecordInput {
  id: string;
  kind: HkNotificationKind;
  tone: HkNotificationTone;
  title: string;
  detail?: string;
  code?: string;
  state?: HkNotificationState;
  /** Resummon callback (in-memory only — see module doc). */
  onResummon?: () => void;
}

/** Hard cap on the journal (user ruling 2026-11-15: ~100, session-
 *  scoped). Beyond it the OLDEST entries (by updatedAt) are dropped. */
export const MAX_NOTIFICATION_ENTRIES = 100;

const state = reactive<{ entries: HkNotificationEntry[] }>({ entries: [] });

// Runtime-registry reporting (the "context of contexts" contract shared
// with useToast/useBlockingToast/useEmergencyAlert): lazy registration
// on first use, pulse on every mutation, so the ledger is answerable
// from readHkRuntime("notificationCenter") without importing this
// module.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("notificationCenter", {
    kind: "context",
    description:
      "The notification-center journal: what every dismissing surface showed, re-summonable from the bell.",
    read: () => ({
      entries: state.entries.length,
      unread: state.entries.filter((e) => !e.read).length,
      byKind: state.entries.reduce<Record<string, number>>((acc, e) => {
        acc[e.kind] = (acc[e.kind] ?? 0) + 1;
        return acc;
      }, {}),
    }),
  }));
}

// ── sessionStorage persistence (guarded like hk-emergency-snooze) ────

const JOURNAL_KEY = "hk-notification-journal";

interface PersistedEntry {
  id: string;
  kind: HkNotificationKind;
  tone: HkNotificationTone;
  title: string;
  detail?: string;
  code?: string;
  raisedAt: number;
  updatedAt: number;
  state: HkNotificationState;
  read: boolean;
}

function toPersisted(entry: HkNotificationEntry): PersistedEntry {
  // onResummon is deliberately dropped: callbacks cannot cross a reload.
  const { onResummon: _onResummon, ...rest } = entry;
  return rest;
}

function writeStorage(): void {
  try {
    globalThis.sessionStorage?.setItem(
      JOURNAL_KEY,
      JSON.stringify(state.entries.map(toPersisted)),
    );
  } catch {
    /* persisting is best-effort; the ledger still works in memory */
  }
}

let loaded = false;
function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = globalThis.sessionStorage?.getItem(JOURNAL_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      const e = item as Partial<PersistedEntry>;
      if (
        typeof e?.id === "string" &&
        typeof e?.kind === "string" &&
        typeof e?.tone === "string" &&
        typeof e?.title === "string" &&
        typeof e?.raisedAt === "number" &&
        typeof e?.updatedAt === "number" &&
        typeof e?.state === "string" &&
        typeof e?.read === "boolean"
      ) {
        state.entries.push({
          id: e.id,
          kind: e.kind as HkNotificationKind,
          tone: e.tone as HkNotificationTone,
          title: e.title,
          detail: typeof e.detail === "string" ? e.detail : undefined,
          code: typeof e.code === "string" ? e.code : undefined,
          raisedAt: e.raisedAt,
          updatedAt: e.updatedAt,
          state: e.state as HkNotificationState,
          read: e.read,
        });
      }
    }
    enforceCap();
  } catch {
    /* a corrupt record must not take the journal down */
  }
}

function enforceCap(): void {
  while (state.entries.length > MAX_NOTIFICATION_ENTRIES) {
    // Drop the oldest by updatedAt (newest-first list is a view concern;
    // the ledger itself is append-ordered, so scan for the minimum).
    let oldestIdx = 0;
    for (let i = 1; i < state.entries.length; i++) {
      if (state.entries[i].updatedAt < state.entries[oldestIdx].updatedAt) {
        oldestIdx = i;
      }
    }
    state.entries.splice(oldestIdx, 1);
  }
}

// ── public mutation surface ──────────────────────────────────────────

/** Create-or-update one entry. Re-recording a known id updates the
 *  content fields in place (raisedAt and read are preserved — a poller
 *  re-recording the same condition must not unread the list), and an
 *  explicitly passed state overrides the stored one. New ids are born
 *  unread. */
export function recordNotification(input: HkNotificationRecordInput): void {
  ensureLoaded();
  ensureRuntimeReport();
  const now = Date.now();
  const existing = state.entries.find((e) => e.id === input.id);
  if (existing) {
    existing.kind = input.kind;
    existing.tone = input.tone;
    existing.title = input.title;
    existing.detail = input.detail;
    existing.code = input.code;
    if (input.state !== undefined) existing.state = input.state;
    if (input.onResummon !== undefined) existing.onResummon = input.onResummon;
    existing.updatedAt = now;
  } else {
    state.entries.push({
      id: input.id,
      kind: input.kind,
      tone: input.tone,
      title: input.title,
      detail: input.detail,
      code: input.code,
      raisedAt: now,
      updatedAt: now,
      state: input.state ?? "active",
      read: false,
      ...(input.onResummon !== undefined ? { onResummon: input.onResummon } : {}),
    });
    enforceCap();
  }
  writeStorage();
  runtimeReport?.pulse();
}

/** Lifecycle transition for a known id. Unknown ids are a no-op (a late
 *  dismissal racing journal eviction / a cleared session). */
export function setNotificationState(
  id: string,
  nextState: HkNotificationState,
): void {
  ensureLoaded();
  const entry = state.entries.find((e) => e.id === id);
  if (!entry || entry.state === nextState) return;
  entry.state = nextState;
  entry.updatedAt = Date.now();
  // A cleared/snoozed episode has no live resummon path anymore.
  if (nextState === "cleared") entry.onResummon = undefined;
  writeStorage();
  runtimeReport?.pulse();
}

/** Drop one entry entirely (rare — mostly a host "clear this item" affordance). */
export function forgetNotification(id: string): void {
  ensureLoaded();
  const idx = state.entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  state.entries.splice(idx, 1);
  writeStorage();
  runtimeReport?.pulse();
}

/** Open-the-panel semantics (user ruling 2026-11-15): showing the list
 *  IS the read receipt. */
export function markAllNotificationsRead(): void {
  ensureLoaded();
  let changed = false;
  for (const e of state.entries) {
    if (!e.read) {
      e.read = true;
      changed = true;
    }
  }
  if (changed) {
    writeStorage();
    runtimeReport?.pulse();
  }
}

/** Wipe the ledger and its storage record (host "clear all" affordance
 *  and the test teardown twin). */
export function resetNotifications(): void {
  state.entries.splice(0, state.entries.length);
  try {
    globalThis.sessionStorage?.removeItem(JOURNAL_KEY);
  } catch {
    /* best-effort */
  }
  runtimeReport?.pulse();
}

export function useNotificationCenter() {
  ensureLoaded();
  ensureRuntimeReport();
  return {
    /** The journal, newest-last in storage order (the panel sorts for
     *  display; hosts reasoning about recency use updatedAt). */
    entries: state.entries,
    record: recordNotification,
    setState: setNotificationState,
    forget: forgetNotification,
    markAllRead: markAllNotificationsRead,
    reset: resetNotifications,
  };
}
