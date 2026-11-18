/**
 * The above-titlebar root — a single `isolation: isolate` container
 * appended to `<body>` for the ONE family of surfaces that must paint
 * OVER the host's window caption band even though the band itself is the
 * topmost layer of the page:
 *
 *   - popovers / menus / select popouts whose TRIGGER lives on the
 *     caption band (the notification bell, the workspace picker, the
 *     account menu, the console face's avatar menu). They are the band's
 *     own attachments: the band claims the titlebar layer so modals can
 *     never deaden its drag row, but the attachment a caption button
 *     opens must not be buried under the very row it hangs from.
 *   - tooltips that EXPLICITLY pin over the strip (`allowBandOverlap` /
 *     the `data-hk-tooltip-band-overlap` trigger marker) — the same
 *     exemption, granted per trigger and only while the bubble shows.
 *
 * ## Why a third root instead of a band inside #hk-overlay-root
 *
 * The overlay root is fenced at `--hk-z-overlay-root` (90000), BELOW the
 * window titlebar (100001) by design: a modal veil must never cover the
 * caption band (2026-11-12 contract), and that is exactly what raising
 * the shared root would do the moment any caption popover opened — the
 * band's drag row and window controls would go under an open veil again.
 * The HUD root (`--hk-z-hud`, 90050) is annotations, not interaction.
 * So caption attachments get their own body-level root, one band above
 * the titlebar:
 *
 * | z-index | Surface |
 * |---------|---------|
 * |   90000 | #hk-overlay-root — every popup (modal backdrop included) |
 * |   90050 | #hk-hud-root — the ambient HUD (annotations only) |
 * |   95000 | error landing (covers everything) |
 * |   96000 | emergency alert takeover |
 * |  100001 | window titlebar / chrome band (Tauri shell) |
 * |  100002 | #hk-top-root — the caption band's OWN attachments (this root) |
 *
 * Inside the root the popup-manager ordinals keep working untouched: an
 * opted-in surface registers exactly as it would in the overlay root, so
 * close-all/breadcrumb/outside-click logic is unchanged. The root is
 * pointer-transparent; each surface restores its own hit area.
 *
 * The root is an idempotent singleton behind `ensureTopRoot()`; the
 * module appends it once on import (the same eager pattern as the overlay
 * and HUD roots) because a Teleport target must exist before the first
 * opt-in surface mounts. It is a zero-size, empty, pointer-transparent
 * node until something teleports into it — importing the library costs
 * one empty `<div>`, nothing more.
 */

/** The CSS selector for Teleport `to` attributes. */
export const TOP_ROOT_SELECTOR = "#hk-top-root";

/**
 * The root's document-space elevation fallback — must match the
 * `--hk-z-top-layer` value in `scale.scss` (kept honest by
 * topRoot.styles.test.ts). Inlined because the root is created before
 * any stylesheet loads; the var() indirection lets the sheet retune the
 * band without touching this file.
 */
export const TOP_ROOT_DOCUMENT_Z = 100002;

/**
 * Idempotently create and append the above-titlebar root to `<body>`.
 *
 * Returns `null` where there is no document at all (SSR, a mini-program
 * JS core): there is no root to hand out, and inventing one would be a
 * lie the first `.appendChild` would expose.
 */
export function ensureTopRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let root = document.querySelector<HTMLElement>(TOP_ROOT_SELECTOR);
  if (!root) {
    root = document.createElement("div");
    root.id = "hk-top-root";
    // Same a11y contract as the overlay root (2026-11-10 review #1206):
    // this root hosts interactive surfaces (menu / popover dialog roles,
    // focusable rows), so it must NOT be wholesale hidden from the
    // accessibility tree. Decorative children declare their own
    // aria-hidden. `data-hk-top-root` is the marker hosts/other roots
    // read when deciding same-root layering.
    root.setAttribute("data-hk-top-root", "");
    // Inline styles — this element is created BEFORE any stylesheet
    // loads, so it must be self-sufficient. `isolation` fences the
    // root's internal z-index space; `position` + `z-index` lift the
    // fenced root above the window titlebar band. The var() name is the
    // sheet's retuning path; the fallback constant must equal
    // scale.scss's --hk-z-top-layer.
    root.style.cssText =
      "isolation:isolate;pointer-events:none;position:relative;" +
      "width:0;height:0;overflow:visible;" +
      `z-index:var(--hk-z-top-layer,${TOP_ROOT_DOCUMENT_Z});`;
    document.body.appendChild(root);
  }
  return root;
}

// Module-level side effect: any import of this module ensures the root.
ensureTopRoot();
