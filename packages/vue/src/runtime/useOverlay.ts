import { onUnmounted, ref, type Ref } from "vue";

interface OverlayRegistryEntry {
  id: string;
  name: string;
  close: () => void;
  group?: string;
}

/** Registry keyed by a per-instance unique id — NOT the display name. Two
 *  instances sharing a name (e.g. two open selects both named "hk-select")
 *  used to overwrite each other's entry in the name-keyed map, corrupting
 *  closeAll()/isOverlayOpen() and leaking the first instance's open state.
 *  The name/group metadata is retained for lookups and group closing. */
const registry = new Map<string, OverlayRegistryEntry>();

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function closeGroup(group: string) {
  for (const [, entry] of registry) {
    if (entry.group === group) {
      entry.close();
      registry.delete(entry.id);
    }
  }
}

function register(id: string, name: string, close: () => void, group?: string) {
  registry.set(id, { id, name, close, group });
}

function unregister(id: string) {
  registry.delete(id);
}

export function closeAll() {
  for (const [, entry] of registry) {
    entry.close();
  }
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
}

export interface OverlayHandle {
  isOpen: Ref<boolean>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  onUpdate: (v: boolean) => void;
}

export function useOverlay(opts: UseOverlayOptions): OverlayHandle {
  const isOpen = ref(false);
  const id = uid();

  function open(): void {
    if (isOpen.value) return;
    if (opts.group) closeGroup(opts.group);
    isOpen.value = true;
    register(id, opts.name, close, opts.group);
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
