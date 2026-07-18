import { readonly, ref } from "vue";

export type PopupKind = "dropdown" | "modal" | "drawer" | "tooltip" | "toast";

interface PopupEntry {
  id: string;
  kind: PopupKind;
  locksScroll: boolean;
  zIndex: number;
  title?: string;
}

const Z_BASE = 1000;
const Z_STEP = 2;

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const registry = ref<Map<string, PopupEntry>>(new Map());
let nextZ = Z_BASE;
let scrollLockCount = 0;

function updateBodyScroll() {
  if (scrollLockCount > 0) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
}

export interface PopupHandle {
  id: string;
  zIndex: number;
}

export function usePopupManager() {
  function register(
    kind: PopupKind,
    locksScroll = false,
    title?: string,
  ): PopupHandle {
    const id = uid();
    const zIndex = nextZ;
    nextZ += Z_STEP;
    const entry: PopupEntry = { id, kind, locksScroll, zIndex, title };
    registry.value.set(id, entry);
    if (locksScroll) {
      scrollLockCount++;
      updateBodyScroll();
    }
    return { id, zIndex };
  }

  function setTitle(id: string, title: string) {
    const entry = registry.value.get(id);
    if (!entry) return;
    entry.title = title;
    registry.value = new Map(registry.value);
  }

  function unregister(id: string) {
    const entry = registry.value.get(id);
    if (!entry) return;
    registry.value.delete(id);
    if (entry.locksScroll) {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      updateBodyScroll();
    }
    if (registry.value.size === 0) {
      nextZ = Z_BASE;
    }
  }

  function isOpen(id: string): boolean {
    return registry.value.has(id);
  }

  return {
    registry: readonly(registry),
    register,
    setTitle,
    unregister,
    isOpen,
  };
}
