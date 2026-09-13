// The hikari runtime registry — the context OF contexts.
//
// Hikari ships many module-level singletons: contexts (i18n, popup
// manager, overlay, toast), installable document hooks (image fallback,
// tooltip bridge, history/navigation safety nets), frame/interval buses
// and app plugins (error reporting). Each one manages its own state with
// its own registration API — and until now nothing knew they all existed.
// Debugging "is the image hook actually installed?", "did the i18n
// context switch locales?", "is the animation bus alive?" meant knowing
// each module's internals.
//
// This module is the upstream registry every one of those subsystems
// reports itself to. The rules (user direction 2026-09-14):
//
//   1. Registration APIs DO NOT change. Subsystems keep their exact
//      existing signatures; reporting is an internal side effect of
//      install/first-use, so consumers notice nothing.
//   2. Every subsystem reports "I registered successfully" — with a
//      stable id, a kind, and live metadata — and pulses on activity,
//      so liveness ("各自存活状态") is answerable from one place.
//   3. Global state becomes reachable "out of thin air": each entry may
//      expose a `read()` facet (live state snapshot) and a `write()`
//      facet (plugin-style ops), so one context — or a host plugin —
//      can read and steer another through the registry instead of
//      importing it.
//
// The registry is deliberately dependency-free (only `vue` reactivity):
// every subsystem imports THIS module, never the reverse, so there are
// no import cycles and tree-shaking keeps the core at a few hundred
// bytes for hosts that use no hikari runtime at all.
import { computed, reactive, readonly, ref } from "vue";

/** What a registered subsystem IS. */
export type HkRuntimeKind =
  /** A stateful module context (i18n, popup manager, overlay, toast). */
  | "context"
  /** An installable document/app hook (image fallback, tooltip bridge). */
  | "hook"
  /** A scheduler/bus other systems ride on (animation, interval, cron). */
  | "bus"
  /** A host-installed plugin (error reporting). */
  | "plugin";

export type HkRuntimeStatus = "active" | "disposed";

/** Small, JSON-safe debug facts. Values must be serializable. */
export type HkRuntimeMeta = Record<string, unknown>;

/** A plugin-style write operation routed through a registry entry. */
export interface HkRuntimeWriteOp {
  type: string;
  [field: string]: unknown;
}

/** The observable state of one registry entry (live, reactive). */
export interface HkRuntimeEntryState {
  readonly id: string;
  kind: HkRuntimeKind;
  description: string;
  status: HkRuntimeStatus;
  /** Epoch ms when the CURRENT registration succeeded. */
  registeredAt: number;
  /** Epoch ms of the last activity pulse. */
  lastActiveAt: number;
  /** How many activity pulses this entry has received. */
  pulses: number;
  meta: HkRuntimeMeta;
}

/** What a subsystem declares when it reports itself. */
export interface HkRuntimeReport {
  kind: HkRuntimeKind;
  description?: string;
  /** Initial meta (install options, initial counts, …). */
  meta?: HkRuntimeMeta;
  /**
   * Cross-context READ facet: a fresh, live, JSON-safe snapshot of the
   * subsystem's global state ("凭空获取"). Called on demand by
   * `readHkRuntime` / `hkRuntimeSnapshot` — keep it cheap and pure.
   */
  read?: () => HkRuntimeMeta;
  /**
   * Cross-context WRITE facet: plugin-style operations another context
   * or a host plugin may steer this subsystem with. Throw on unknown
   * op types — the registry turns that into a `false` return plus a
   * dev warning, never a crash.
   */
  write?: (op: HkRuntimeWriteOp) => void;
}

/** The handle a reporting subsystem holds to pulse/dispose its entry. */
export interface HkRuntimeHandle {
  readonly id: string;
  /** Activity beat: bumps `pulses`, refreshes `lastActiveAt`, merges meta. */
  pulse(meta?: HkRuntimeMeta): void;
  /** Shallow-merge meta without counting an activity pulse. */
  setMeta(meta: HkRuntimeMeta): void;
  /** Mark the entry disposed (uninstalled / torn down). Idempotent. */
  dispose(): void;
}

export interface HkRuntimeSnapshotEntry extends HkRuntimeEntryState {
  /** Live `read()` facet result, when the entry exposes one. */
  state?: HkRuntimeMeta;
}

export interface HkRuntimeSnapshot {
  generatedAt: number;
  entries: HkRuntimeSnapshotEntry[];
}

interface InternalEntry {
  /** Bumped every time a disposed entry's id is re-registered, so stale
   * handles from a previous lifetime cannot pulse/dispose the new one. */
  epoch: number;
  /** Monotonic registration sequence — the true registration order even
   *  when two installs land in the same millisecond. */
  seq: number;
  state: HkRuntimeEntryState;
  read?: () => HkRuntimeMeta;
  write?: (op: HkRuntimeWriteOp) => void;
}

const entries = new Map<string, InternalEntry>();
let registrationSeq = 0;

/**
 * Structural version — bumped whenever the ENTRY SET changes (new
 * registration / re-registration after dispose). The plain Map itself is
 * not reactive, so this ref is what invalidates `useHkRegistry().entries`
 * when a subsystem registers for the first time; pulses and status flips
 * of already-tracked entries invalidate it through their reactive states.
 */
const structureVersion = ref(0);

function warnDev(message: string): void {
  if (import.meta.env?.DEV) {
    console.warn(`[hikari:registry] ${message}`);
  }
}

function cloneState(entry: InternalEntry): HkRuntimeEntryState {
  return { ...entry.state, meta: { ...entry.state.meta } };
}

/**
 * Report (or re-report) a subsystem to the runtime registry. This is the
 * "I registered successfully" call every context/hook/bus/plugin makes
 * on install or first use — registration APIs themselves stay untouched.
 *
 * Idempotent while the entry is ACTIVE: a re-report refreshes the facets
 * (kind/description/meta/read/write) but keeps `registeredAt` and the
 * pulse history, so double-install protection in subsystems cannot erase
 * liveness history. After a `dispose()`, the next report starts a fresh
 * lifetime (new `registeredAt`, zeroed pulses).
 */
export function reportHkRuntime(id: string, report: HkRuntimeReport): HkRuntimeHandle {
  const existing = entries.get(id);
  if (existing && existing.state.status === "active") {
    if (existing.state.kind !== report.kind) {
      warnDev(`entry "${id}" re-reported with a different kind (${existing.state.kind} → ${report.kind}); keeping the new one`);
    }
    existing.state.kind = report.kind;
    existing.state.description = report.description ?? "";
    if (report.meta) existing.state.meta = { ...existing.state.meta, ...report.meta };
    existing.read = report.read;
    existing.write = report.write;
    return makeHandle(id, existing.epoch);
  }

  const now = Date.now();
  const internal: InternalEntry = {
    epoch: (existing?.epoch ?? 0) + 1,
    seq: ++registrationSeq,
    state: reactive({
      id,
      kind: report.kind,
      description: report.description ?? "",
      status: "active",
      registeredAt: now,
      lastActiveAt: now,
      pulses: 0,
      meta: { ...report.meta },
    }),
    read: report.read,
    write: report.write,
  };
  entries.set(id, internal);
  structureVersion.value += 1;
  return makeHandle(id, internal.epoch);
}

function makeHandle(id: string, epoch: number): HkRuntimeHandle {
  const live = (): InternalEntry | null => {
    const entry = entries.get(id);
    if (!entry || entry.epoch !== epoch || entry.state.status !== "active") return null;
    return entry;
  };
  return {
    id,
    pulse(meta) {
      const entry = live();
      if (!entry) return; // a disposed/replace subsystem's late beat is a no-op
      entry.state.lastActiveAt = Date.now();
      entry.state.pulses += 1;
      if (meta) entry.state.meta = { ...entry.state.meta, ...meta };
    },
    setMeta(meta) {
      const entry = live();
      if (!entry) return;
      entry.state.meta = { ...entry.state.meta, ...meta };
    },
    dispose() {
      const entry = live();
      if (!entry) return; // idempotent — disposing twice is safe
      entry.state.status = "disposed";
      // Facets go away with the subsystem; the record stays listed so a
      // debugger can still see what WAS installed and when it left.
      entry.read = undefined;
      entry.write = undefined;
    },
  };
}

/** The live reactive state of one entry (readonly view), if registered. */
export function getHkRuntimeEntry(id: string): Readonly<HkRuntimeEntryState> | undefined {
  const entry = entries.get(id);
  return entry ? readonly(entry.state) : undefined;
}

/** All entries, stable-ordered (true registration order via the internal
 *  sequence — same-millisecond installs cannot reorder). Plain clones —
 *  safe to log, diff, or feed to `console.table`. */
export function listHkRuntime(): HkRuntimeEntryState[] {
  return Array.from(entries.values())
    .sort((a, b) => a.seq - b.seq)
    .map(cloneState);
}

/**
 * Read another subsystem's global state "out of thin air" — no import of
 * the target module needed. Returns the entry's live `read()` snapshot,
 * or `undefined` when the id is unknown/disposed or the entry exposes no
 * read facet. A throwing read facet degrades to `undefined` + dev warn.
 */
export function readHkRuntime(id: string): HkRuntimeMeta | undefined {
  const entry = entries.get(id);
  if (!entry || entry.state.status !== "active" || !entry.read) return undefined;
  try {
    return entry.read();
  } catch (err) {
    warnDev(`read facet of "${id}" threw: ${String(err)}`);
    return undefined;
  }
}

/**
 * Steer another subsystem plugin-style. Returns `true` when the op was
 * applied; `false` for unknown ids, disposed entries, missing write
 * facets or ops the facet rejected (it threw). Never throws to the caller.
 */
export function writeHkRuntime(id: string, op: HkRuntimeWriteOp): boolean {
  const entry = entries.get(id);
  if (!entry || entry.state.status !== "active" || !entry.write) return false;
  try {
    entry.write(op);
    return true;
  } catch (err) {
    warnDev(`write op "${op.type}" on "${id}" rejected: ${String(err)}`);
    return false;
  }
}

/**
 * Full debug snapshot: every entry's state plus its live `read()` facet
 * result. JSON-serializable — hand it to a devtools panel, a support
 * dump, or a test assertion.
 */
export function hkRuntimeSnapshot(): HkRuntimeSnapshot {
  return {
    generatedAt: Date.now(),
    entries: listHkRuntime().map((state) => {
      const entry = entries.get(state.id);
      const facet = entry?.read ? safeRead(entry.read) : undefined;
      return facet === undefined ? state : { ...state, state: facet };
    }),
  };
}

function safeRead(read: () => HkRuntimeMeta): HkRuntimeMeta | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

/**
 * Vue-facing view of the registry for debug panels. `entries` is a
 * computed that tracks BOTH the reactive entry states (pulses/status
 * flips) and the structural version (brand-new registrations), so a
 * component listing them re-renders live in every case.
 */
export function useHkRegistry() {
  return {
    entries: computed(() => {
      void structureVersion.value;
      return listHkRuntime();
    }),
    get: getHkRuntimeEntry,
    read: readHkRuntime,
    write: writeHkRuntime,
    snapshot: hkRuntimeSnapshot,
  };
}
