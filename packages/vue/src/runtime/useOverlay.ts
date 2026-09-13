import { onUnmounted, ref, type Ref } from "vue";

import { reportHkRuntime, type HkRuntimeHandle } from "./registry";

interface OverlayRegistryEntry {
  id: string;
  name: string;
  close: () => void;
  /** Component-level teardown invoked alongside the internal flip when a
   *  global/group close fires — lets the owner close its own visible
   *  popout state (e.g. an open ref bound to the popup manager). */
  onCloseRequested?: () => void;
  group?: string;
}

/** Registry keyed by a per-instance unique id — NOT the display name. Two
 *  instances sharing a name (e.g. two open selects both named "hk-select")
 *  used to overwrite each other's entry in the name-keyed map, corrupting
 *  closeAll()/isOverlayOpen() and leaking the first instance's open state.
 *  The name/group metadata is retained for lookups and group closing. */
const registry = new Map<string, OverlayRegistryEntry>();

// Runtime-registry reporting (the "context of contexts"). Lazy: the
// overlay context reports itself on first useOverlay() call and pulses
// on every register/unregister/group-close, so "which popouts are live"
// is answerable from readHkRuntime("overlay") without importing this
// module. The registration API itself is unchanged.
let runtimeReport: HkRuntimeHandle | null = null;
function ensureRuntimeReport(): HkRuntimeHandle {
  return (runtimeReport ??= reportHkRuntime("overlay", {
    kind: "context",
    description: "The overlay context: open/close bookkeeping for named popout surfaces (selects, popovers, menus).",
    read: () => {
      const names = new Set<string>();
      for (const entry of registry.values()) names.add(entry.name);
      return { open: registry.size, names: Array.from(names) };
    },
  }));
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Run an entry's full close path: the internal flip AND the component
 *  onCloseRequested hook, each isolated so a throwing callback cannot abort
 *  the remaining entries (or the sibling hook). */
function runEntryClose(entry: OverlayRegistryEntry) {
  try {
    entry.close();
  } catch (err) {
    console.warn("[useOverlay] overlay close() threw for", entry.name, err);
  }
  try {
    entry.onCloseRequested?.();
  } catch (err) {
    console.warn("[useOverlay] overlay onCloseRequested() threw for", entry.name, err);
  }
}

function closeGroup(group: string) {
  let closed = 0;
  for (const [, entry] of registry) {
    if (entry.group === group) {
      runEntryClose(entry);
      registry.delete(entry.id);
      closed++;
    }
  }
  if (closed > 0) runtimeReport?.pulse();
}

function register(
  id: string,
  name: string,
  close: () => void,
  group?: string,
  onCloseRequested?: () => void,
) {
  registry.set(id, { id, name, close, group, onCloseRequested });
  runtimeReport?.pulse();
}

function unregister(id: string) {
  if (registry.delete(id)) runtimeReport?.pulse();
}

export function closeAll() {
  for (const [, entry] of registry) {
    runEntryClose(entry);
  }
  if (registry.size > 0) runtimeReport?.pulse();
  registry.clear();
}

export function isOverlayOpen(name: string): boolean {
  for (const entry of registry.values()) {
    if (entry.name === name) return true;
  }
  return false;
}

export interface UseOverlayOptions {
  name: string;
  group?: string;
  /** Component-level teardown run by closeAll()/group-close alongside the
   *  internal isOpen flip — close the owner's own visible popout state. */
  onCloseRequested?: () => void;
}

export interface OverlayHandle {
  isOpen: Ref<boolean>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  onUpdate: (v: boolean) => void;
}

export function useOverlay(opts: UseOverlayOptions): OverlayHandle {
  ensureRuntimeReport();
  const isOpen = ref(false);
  const id = uid();

  function open(): void {
    if (isOpen.value) return;
    if (opts.group) closeGroup(opts.group);
    isOpen.value = true;
    register(id, opts.name, close, opts.group, opts.onCloseRequested);
  }

  function close(): void {
    if (!isOpen.value) return;
    isOpen.value = false;
    unregister(id);
  }

  function toggle(): void {
    if (isOpen.value) close();
    else open();
  }

  function onUpdate(v: boolean): void {
    if (v) open();
    else close();
  }

  onUnmounted(() => {
    if (isOpen.value) unregister(id);
  });

  return { isOpen, open, close, toggle, onUpdate };
}
