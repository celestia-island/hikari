import { readonly, ref } from "vue";

export type PopupKind = "dropdown" | "modal" | "drawer" | "tooltip" | "toast";

/**
 * Kind-priority z bands — the single source of truth for popup stacking.
 *
 * Layering is decided by WHAT a surface IS — window or attachment — never
 * by WHEN it happened to register:
 *
 *   modal    (1000)  the WINDOW band: centered dialogs + phone bottom
 *   drawer   (1000)  sheets + edge drawers. Anything that BLOCKS the page
 *                    like a window is a window: modals and drawers by
 *                    kind, and a dropdown-kind surface while it is docked
 *                    as a mobile bottom sheet (`blocking`). Within the
 *                    band surfaces stack purely in open order (push/pop
 *                    stack semantics), so a window opened FROM inside a
 *                    sheet always paints above it — the sheet keeps no
 *                    kind-priority claim over windows opened later.
 *   dropdown (2000)  ANCHORED popovers, select panels, menus — surfaces
 *                    attached to an anchor on whatever window is on top,
 *                    not windows themselves. ABOVE the window band on
 *                    purpose: a select panel opened from inside a modal
 *                    portals to <body> and must paint above the modal
 *                    that contains it (the common in-modal form flow). A
 *                    page-level anchored dropdown can only coexist with a
 *                    modal programmatically (the modal overlay intercepts
 *                    pointers), so the rare stale-dropdown-over-modal case
 *                    is accepted, matching Ant Design
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
 * longer push later modals up the ladder). A dropdown flipping its
 * blocking flag (anchored popover docking as a sheet, or the reverse)
 * REBANDS in place: promotion pushes onto the top of the window band
 * (becoming a window IS a push), demotion lands on the top of the
 * anchored band. Overlay roots are spaced one Z_STEP apart so each
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

/**
 * The band a popup CURRENTLY stacks in. Dropdown-kind surfaces have two:
 * the anchored band while attached to an anchor, the WINDOW band
 * (shared with modals/drawers) while docked as a blocking bottom sheet.
 * Window kinds always live in the window band.
 */
function effectiveBand(kind: PopupKind, blocking: boolean): number {
  if (kind === "dropdown") return blocking ? POPUP_Z_BANDS.modal : POPUP_Z_BANDS.dropdown;
  return POPUP_Z_BANDS[kind];
}

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
   * a mobile bottom sheet that rose from a dropdown-kind surface. This
   * flag is window-stack MEMBERSHIP: it lists the popup in the
   * modal-stack breadcrumb AND moves it into the window z band (see
   * effectiveBand) — a blocking sheet is a window in every sense, so
   * windows opened from inside it stack above it. Window kinds
   * (modal/drawer) are windows by kind and always listed; an anchored
   * desktop popover stays a hidden level. Named surfaces only: a
   * blocking popup without a title is a naming bug (dev warn at
   * registration).
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
    const band = effectiveBand(kind, blocking);
    // Next slot = one step above the highest LIVE entry of the same band.
    // Band membership follows the entry's CURRENT shape (see
    // effectiveBand): a blocking sheet scans the window band, so it lands
    // above every window opened before it.
    let maxSlot = -1;
    for (const entry of registry.value.values()) {
      if (effectiveBand(entry.kind, entry.blocking) !== band) continue;
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
   *
   * The flip also REBANDS the z: promotion pushes the sheet onto the top
   * of the window band (becoming a window is a push — it must cover the
   * page), demotion lands it on the top of the anchored band. The freed
   * slot in the old band reclaims lazily via the usual max-live-slot
   * derivation.
   */
  function setBlocking(id: string, blocking: boolean) {
    const entry = registry.value.get(id);
    if (!entry || entry.blocking === blocking) return;
    entry.blocking = blocking;
    const band = effectiveBand(entry.kind, entry.blocking);
    let maxSlot = -1;
    for (const other of registry.value.values()) {
      if (other === entry) continue;
      if (effectiveBand(other.kind, other.blocking) !== band) continue;
      const slot = (other.zIndex - band) / POPUP_Z_STEP;
      if (slot > maxSlot) maxSlot = slot;
    }
    entry.zIndex = band + (maxSlot + 1) * POPUP_Z_STEP;
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
