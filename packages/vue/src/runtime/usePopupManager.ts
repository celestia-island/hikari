import { readonly, ref } from "vue";

export type PopupKind = "dropdown" | "modal" | "drawer" | "tooltip" | "toast";

/**
 * Kind-priority z bands — the single source of truth for popup stacking.
 *
 * Every registered popup lands in its kind's band, so layering is decided
 * by WHAT a surface is, never by WHEN it happened to register. Bands are
 * ordered low → high:
 *
 *   modal    (1000)  centered dialogs + phone bottom sheets
 *   drawer   (1000)  edge drawers share the overlay band with modals —
 *                    inside the band they stack in open order, so a
 *                    drawer opened over a modal still paints above it
 *   dropdown (2000)  anchor-attached popovers, select panels, menus —
 *                    ABOVE the overlay band on purpose: a select panel
 *                    opened from inside a modal portals to <body> and
 *                    must paint above the modal that contains it (the
 *                    common in-modal form flow). A page-level dropdown
 *                    can only coexist with a modal programmatically (the
 *                    modal overlay intercepts pointers), so the rare
 *                    stale-dropdown-over-modal case is accepted, matching
 *                    Ant Design
 *   tooltip  (3000)  transient annotations must stay visible above the
 *                    surfaces they annotate
 *   toast    (4000)  ALWAYS the topmost surface — a toast must never be
 *                    buried under a modal/sheet, no matter which opened
 *                    first (the long-lived HkToast stack registers once
 *                    at shell mount and must keep its band forever)
 *
 * Within a band, entries stack in open order (max live slot + step), and
 * freed slots are reclaimed automatically because the next z derives from
 * the CURRENT live entries of that band only — no monotonic counter, no
 * cross-band coupling (a persistent toast/tooltip registration can no
 * longer push later modals up the ladder; that ordering bug is what this
 * band scheme replaces). Overlay roots are spaced one Z_STEP apart so each
 * overlay's +1 content/panel layer always has a free slot above its own
 * root and below the next overlay.
 *
 * Keep the SCSS fallbacks (`--hi-z-*` / `--hk-z-*` in theme.scss and the
 * component sheets) in sync with these numbers.
 */
export const POPUP_Z_BANDS: Record<PopupKind, number> = {
  modal: 1000,
  drawer: 1000,
  dropdown: 2000,
  tooltip: 3000,
  toast: 4000,
};

/** In-band stacking step. Even numbers leave the odd slot free for the
 * +1 content/panel layer each overlay puts above its own root. */
export const POPUP_Z_STEP = 2;

export interface PopupEntry {
  id: string;
  kind: PopupKind;
  locksScroll: boolean;
  zIndex: number;
  title?: string;
  /**
   * True while the popup is a blocking window the user "navigates" —
   * a mobile bottom sheet that rose from a dropdown-kind surface. The
   * modal-stack breadcrumb lists window kinds (modal/drawer) always and
   * dropdown kinds only while they block like this; an anchored desktop
   * popover stays a hidden level. Named surfaces only: a blocking popup
   * without a title is a naming bug (dev warn at registration).
   */
  blocking: boolean;
}

/**
 * Dev-time naming enforcement for the window-stack breadcrumb. Any popup
 * that participates in the breadcrumb (window kinds, or a dropdown that
 * currently blocks as a sheet) must carry a real, i18n-resolved title —
 * a bare "Layer N" style fallback is exactly what the strip must never
 * show. Production builds stay silent; the breadcrumb falls back to a
 * generic localized label there.
 */
function warnUntitled(kind: PopupKind, blocking: boolean, title?: string): void {
  const stacks = kind === "modal" || kind === "drawer" || blocking;
  if (!stacks || title) return;
  if (import.meta.env?.DEV) {
    console.warn(
      `[hikari] popup registered without a title (kind: ${kind}). ` +
        "Window surfaces must pass an i18n-resolved title so the " +
        "modal-stack breadcrumb can label their layer.",
    );
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const registry = ref<Map<string, PopupEntry>>(new Map());
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
    blocking = false,
  ): PopupHandle {
    const id = uid();
    const band = POPUP_Z_BANDS[kind];
    // Next slot = one step above the highest LIVE entry of the same band.
    let maxSlot = -1;
    for (const entry of registry.value.values()) {
      if (POPUP_Z_BANDS[entry.kind] !== band) continue;
      const slot = (entry.zIndex - band) / POPUP_Z_STEP;
      if (slot > maxSlot) maxSlot = slot;
    }
    const zIndex = band + (maxSlot + 1) * POPUP_Z_STEP;
    const entry: PopupEntry = { id, kind, locksScroll, zIndex, title, blocking };
    registry.value.set(id, entry);
    warnUntitled(kind, blocking, title);
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

  /**
   * Flip the blocking flag while the popup stays open — a dropdown that
   * docks as a bottom sheet when the viewport crosses the mobile
   * breakpoint becomes a breadcrumb level mid-flight (and back).
   */
  function setBlocking(id: string, blocking: boolean) {
    const entry = registry.value.get(id);
    if (!entry || entry.blocking === blocking) return;
    entry.blocking = blocking;
    registry.value = new Map(registry.value);
    if (blocking) warnUntitled(entry.kind, true, entry.title);
  }

  function unregister(id: string) {
    const entry = registry.value.get(id);
    if (!entry) return;
    registry.value.delete(id);
    if (entry.locksScroll) {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      updateBodyScroll();
    }
  }

  function isOpen(id: string): boolean {
    return registry.value.has(id);
  }

  return {
    registry: readonly(registry),
    register,
    setTitle,
    setBlocking,
    unregister,
    isOpen,
  };
}
