/**
 * The overlay root — a single `isolation: isolate` container appended to
 * `<body>` that every floating layer (modal, toast, tooltip, select
 * popout, context menu) Teleports into.
 *
 * Inside this root, z-index values only compete with each other (the
 * `isolation` property creates a new stacking context), so overlay types
 * use simple ordinals (1 = lowest … 10 = highest) instead of the old
 * global thousand-scale bands. A tooltip at z-index 8 inside the root
 * always paints above a modal at z-index 3 inside the root, regardless
 * of what the global stacking space looks like outside.
 *
 * The root is created lazily on first use (`ensureOverlayRoot()`), so
 * consumers don't need to include a bootstrap component — any Teleport
 * target reference triggers creation via the module-level side effect
 * in `OVERLAY_ROOT_SELECTOR`.
 *
 * ## Ordinal bands (internal to the root — never leak out)
 *
 * | z-index | Layer          | Examples                              |
 * |---------|----------------|---------------------------------------|
 * |    1    | modal backdrop | HkModal's fixed backdrop              |
 * |    2    | modal frame    | HkModal body, dialogs                 |
 * |    3    | blocking toast | HkBlockingToast                       |
 * |    4    | toast          | HkToast, persistent toasts            |
 * |    5    | loading veil   | HkLoadingVeil                         |
 * |    6    | anchored popup | HkSelectPanel popout, menus, popover  |
 * |    7    | breadcrumb     | HkModalBreadcrumb strip               |
 * |    8    | tooltip        | HkTooltip (always on top)             |
 *
 * Components that need to layer within the SAME band (e.g. multiple
 * stacked modals) use their own local stacking mechanisms (the modal
 * popup manager already assigns incremental z-values).
 */

/** The CSS selector for Teleport `to` attributes. */
export const OVERLAY_ROOT_SELECTOR = "#hk-overlay-root";

/** Ordinal z-index bands — the ONLY z-index values inside the root. */
export const OVERLAY_Z = {
  modalBackdrop: 5,
  modalFrame: 10,
  blockingToast: 50,
  toast: 100,
  loadingVeil: 150,
  anchoredPopup: 200,
  breadcrumb: 250,
  tooltip: 300,
} as const;

/**
 * Idempotently create and append the overlay root to `<body>`.
 * Called on module load — the first `import` of this module guarantees
 * the DOM node exists before any Teleport resolves its target.
 */
export function ensureOverlayRoot(): HTMLElement {
  if (typeof document === "undefined") return null as unknown as HTMLElement;
  let root = document.querySelector<HTMLElement>(OVERLAY_ROOT_SELECTOR);
  if (!root) {
    root = document.createElement("div");
    root.id = "hk-overlay-root";
    root.setAttribute("aria-hidden", "true");
    // Inline styles — this element is created BEFORE any stylesheet
    // loads, so it must be self-sufficient. The `isolation` is the
    // whole point: it fences the root's internal z-index space from
    // the document's global stacking order.
    root.style.cssText = "isolation:isolate;pointer-events:none;";
    document.body.appendChild(root);
  }
  return root;
}

// Module-level side effect: any import of this module ensures the root.
ensureOverlayRoot();
