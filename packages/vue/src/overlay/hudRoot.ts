/**
 * The ambient HUD root — a single `isolation: isolate` container appended
 * to `<body>` that always-visible, NON-INTERACTIVE annotations teleport
 * into: the screen-identify card (`HkScreenIdentifyHost`), recording
 * marks, kiosk readouts — anything that must stay visible while windows
 * are open.
 *
 * ## Why a second root instead of a band inside #hk-overlay-root
 *
 * `#hk-overlay-root` is the fenced home of every INTERACTIVE floating
 * layer (modal, drawer, anchored popup, tooltip, toast). Its ordinal
 * bands are managed by the popup manager and a HUD has no business
 * entering that arithmetic. Worse, its elevation (`--hk-z-overlay-root`,
 * 90000) is exactly what buried the identify card in the 2026-11-05
 * defect: the card was teleported to `<body>` with a hand-written
 * `z-index: 5000`, so the ENTIRE overlay tree — the modal backdrop
 * included — painted over it and the first thing the user saw after
 * "Identify screens" was a dimmed number underneath the board dialog.
 * A band inside the overlay root would fix the paint order but not the
 * a11y shape: the root carries `aria-hidden="true"`, and a status
 * announcement (`role="status"`) belongs in the accessory tree.
 *
 * So the HUD gets its own root, elevated by its own document-space band:
 *
 * | z-index | Surface |
 * |---------|---------|
 * |   90000 | #hk-overlay-root — every popup (modal backdrop included) |
 * |   90050 | #hk-hud-root — the ambient HUD (this module) |
 * |   95000 | error landing (covers everything) |
 * |   96000 | emergency alert takeover (HkEmergencyAlert, body-mounted) |
 * |  100001 | window titlebar (Tauri shell) |
 *
 * Everything above the HUD is a deliberate top-owner: an error takeover
 * and the shell's titlebar outrank annotations; nothing else does.
 *
 * The root is created lazily on first use, so consumers don't need to
 * include a bootstrap component — any Teleport target reference triggers
 * creation via `ensureHudRoot()`.
 */

/** The CSS selector for Teleport `to` attributes. */
export const HUD_ROOT_SELECTOR = "#hk-hud-root";

/**
 * The root's document-space elevation fallback — must match the
 * `--hk-z-hud` value in scale.scss (kept honest by
 * hudRoot.styles.test.ts). Inlined because the root is created before any
 * stylesheet loads; the var() indirection lets the sheet retune the band
 * without touching this file.
 */
export const HUD_ROOT_DOCUMENT_Z = 90050;

/**
 * Idempotently create and append the HUD root to `<body>`.
 *
 * Returns `null` where there is no document at all (SSR, a mini-program
 * JS core): there is no root to hand out, and inventing one would be a
 * lie the first `.appendChild` would expose.
 */
export function ensureHudRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let root = document.querySelector<HTMLElement>(HUD_ROOT_SELECTOR);
  if (!root) {
    root = document.createElement("div");
    root.id = "hk-hud-root";
    // Inline styles — this element is created BEFORE any stylesheet
    // loads, so it must be self-sufficient. `isolation` fences the
    // root's internal z-index space from the document's global stacking
    // order; `position` + `z-index` then lift the fenced root above the
    // overlay root. The var() name is the sheet's retuning path; the
    // fallback constant must equal scale.scss's --hk-z-hud.
    //
    // Deliberately NO aria-hidden here: HUD content is allowed to carry
    // role="status" (the identify card announces the number), unlike the
    // overlay root whose decorative containers are hidden wholesale.
    root.style.cssText =
      "isolation:isolate;pointer-events:none;position:relative;" +
      "width:0;height:0;overflow:visible;" +
      `z-index:var(--hk-z-hud,${HUD_ROOT_DOCUMENT_Z});`;
    document.body.appendChild(root);
  }
  return root;
}

// Module-level side effect: any import of this module ensures the root.
ensureHudRoot();
