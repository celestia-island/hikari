import { onUnmounted, ref, type Ref } from "vue";

interface OverlayRegistryEntry {
  close: () => void;
  group?: string;
}

const registry = new Map<string, OverlayRegistryEntry>();

function closeGroup(group: string) {
  for (const [name, entry] of registry) {
    if (entry.group === group) {
      entry.close();
      registry.delete(name);
    }
  }
}

function register(name: string, close: () => void, group?: string) {
  registry.set(name, { close, group });
}

function unregister(name: string) {
  registry.delete(name);
}

export function closeAll() {
  for (const [, entry] of registry) {
    entry.close();
  }
  registry.clear();
}

export function isOverlayOpen(name: string): boolean {
  return registry.has(name);
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

  function open(): void {
    if (isOpen.value) return;
    if (opts.group) closeGroup(opts.group);
    isOpen.value = true;
    register(opts.name, close, opts.group);
  }

  function close(): void {
    if (!isOpen.value) return;
    isOpen.value = false;
    unregister(opts.name);
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
    if (isOpen.value) unregister(opts.name);
  });

  return { isOpen, open, close, toggle, onUpdate };
}
