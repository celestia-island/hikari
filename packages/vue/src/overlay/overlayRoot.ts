/**
 * The overlay root — a single `isolation: isolate` container appended to
 * `<body>` that every floating layer (modal, toast, tooltip, select
 * popout, context menu) Teleports into.
 *
 * Inside this root, z-index values only compete with each other (the
 * `isolation` property creates a new stacking context), so overlay types
 * use simple ordinal bands instead of the old global thousand-scale. A
 * tooltip at ordinal 300 inside the root always paints above a modal at
 * ordinal 10 inside the root, regardless of what the global stacking
 * space looks like outside.
 *
 * The fence only disciplines the root's INTERNALS, though — by itself
 * `isolation` does not lift the root above app chrome. A fixed/sticky
 * bar with a positive document-space z-index (the admin status bar sits
 * at `--hk-z-toolbar: 50`) painted over EVERY floating layer, dropping
 * the connection popover behind the panel footer (2026-10-15 defect
 * report). The root therefore carries ONE document-space z-index of its
 * own — `--hk-z-overlay-root` (fallback 90000) — parked between the old
 * floating bands and `--hk-z-error`, so the pre-isolation global order
 * is preserved: content chrome < floating layers < error landing <
 * window titlebar.
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
 * |    5    | modal backdrop | HkModal's fixed backdrop              |
 * |   10    | modal frame    | HkModal body, dialogs                 |
 * |   50    | blocking toast | HkBlockingToast                       |
 * |  100    | toast          | HkToast, persistent toasts            |
 * |  150    | loading veil   | HkLoadingVeil                         |
 * |  200    | anchored popup | HkSelectPanel popout, menus, popover  |
 * |  250    | breadcrumb     | HkModalBreadcrumb strip               |
 * |  300    | tooltip        | HkTooltip (always on top)             |
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
 * The root's document-space elevation fallback — must match the
 * `--hk-z-overlay-root` value in `scale.scss` (kept honest by
 * overlayRoot.styles.test.ts). Inlined because the root is created
 * before any stylesheet loads; the var() indirection lets the sheet
 * retune the band without touching this file.
 */
export const OVERLAY_ROOT_DOCUMENT_Z = 90000;

/**
 * Idempotently create and append the overlay root to `<body>`.
 * Called on module load — the first `import` of this module guarantees
 * the DOM node exists before any Teleport resolves its target.
 *
 * Returns `null` where there is no document at all (SSR, a mini-program
 * JS core): there is no root to hand out, and inventing one would be a
 * lie the first `.appendChild` would expose.
 */
export function ensureOverlayRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let root = document.querySelector<HTMLElement>(OVERLAY_ROOT_SELECTOR);
  if (!root) {
    root = document.createElement("div");
    root.id = "hk-overlay-root";
    root.setAttribute("aria-hidden", "true");
    // Inline styles — this element is created BEFORE any stylesheet
    // loads, so it must be self-sufficient. `isolation` fences the
    // root's internal z-index space from the document's global stacking
    // order; `position` + `z-index` then lift the fenced root above
    // every content-chrome band (see the module doc) — `position` is
    // repeated here so the elevation also applies pre-stylesheet. The
    // var() name is the sheet's retuning path; the fallback constant
    // must equal scale.scss's --hk-z-overlay-root.
    root.style.cssText =
      "isolation:isolate;pointer-events:none;position:relative;" +
      `z-index:var(--hk-z-overlay-root,${OVERLAY_ROOT_DOCUMENT_Z});`;
    document.body.appendChild(root);
  }
  return root;
}

// Module-level side effect: any import of this module ensures the root.
ensureOverlayRoot();
