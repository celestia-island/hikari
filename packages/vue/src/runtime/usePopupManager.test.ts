import { afterEach, describe, expect, it } from "vitest";

import { POPUP_Z_BANDS, POPUP_Z_STEP, usePopupManager } from "./usePopupManager";

const managers: ReturnType<typeof usePopupManager>[] = [];

function freshManager() {
  const m = usePopupManager();
  managers.push(m);
  return m;
}

afterEach(() => {
  // The registry is a module singleton shared across usePopupManager()
  // instances — unregister everything so tests do not leak z state.
  for (const m of managers.splice(0)) {
    for (const entry of [...m.registry.value.values()]) {
      m.unregister(entry.id);
    }
  }
  document.body.style.overflow = "";
});

describe("usePopupManager z bands", () => {
  it("bands are ordered overlay < dropdown < tooltip < toast", () => {
    expect(POPUP_Z_BANDS.modal).toBe(POPUP_Z_BANDS.drawer);
    expect(POPUP_Z_BANDS.modal).toBeLessThan(POPUP_Z_BANDS.dropdown);
    expect(POPUP_Z_BANDS.dropdown).toBeLessThan(POPUP_Z_BANDS.tooltip);
    expect(POPUP_Z_BANDS.tooltip).toBeLessThan(POPUP_Z_BANDS.toast);
  });

  it("keeps a toast registered first above overlays opened later", () => {
    // The mobile regression: HkToast mounts once at shell level, so the
    // old registration-order ladder gave every later modal a higher z and
    // buried the toast under the phone bottom sheet. Bands must hold the
    // toast on top regardless of registration order.
    const m = freshManager();
    const toast = m.register("toast", false);
    expect(toast.zIndex).toBe(POPUP_Z_BANDS.toast);

    const modal = m.register("modal", true);
    const drawer = m.register("drawer", true);
    const dropdown = m.register("dropdown", false);
    expect(modal.zIndex).toBeLessThan(toast.zIndex);
    expect(drawer.zIndex).toBeLessThan(toast.zIndex);
    expect(dropdown.zIndex).toBeLessThan(toast.zIndex);
  });

  it("stacks in open order within a band and reclaims freed slots", () => {
    const m = freshManager();
    const a = m.register("modal", true);
    const b = m.register("modal", true);
    expect(a.zIndex).toBe(POPUP_Z_BANDS.modal);
    expect(b.zIndex).toBe(a.zIndex + POPUP_Z_STEP);

    m.unregister(b.id);
    // C must reclaim B's slot — NOT drift upward past it.
    const c = m.register("modal", true);
    expect(c.zIndex).toBe(b.zIndex);

    m.unregister(a.id);
    m.unregister(c.id);
    // Band empty again → back to the band base.
    const d = m.register("modal", true);
    expect(d.zIndex).toBe(POPUP_Z_BANDS.modal);
  });

  it("shares the overlay band between modal and drawer in open order", () => {
    const m = freshManager();
    const modal = m.register("modal", true);
    const drawer = m.register("drawer", true);
    // Same band: the drawer opened over the modal paints above it, and a
    // replacement drawer reclaims the freed slot instead of drifting.
    expect(modal.zIndex).toBe(POPUP_Z_BANDS.modal);
    expect(drawer.zIndex).toBe(modal.zIndex + POPUP_Z_STEP);

    m.unregister(drawer.id);
    const drawer2 = m.register("drawer", true);
    expect(drawer2.zIndex).toBe(drawer.zIndex);
  });

  it("keeps a dropdown opened from within an overlay above it", () => {
    // Select panels portal to <body>; opened from inside a modal they
    // must paint above the modal that contains them — the whole reason
    // the dropdown band sits above the overlay band.
    const m = freshManager();
    const modal = m.register("modal", true);
    const panel = m.register("dropdown", false);
    expect(panel.zIndex).toBeGreaterThan(modal.zIndex);

    m.unregister(panel.id);
    m.unregister(modal.id);

    // Same guarantee inverted: with the dropdown registered FIRST, the
    // later modal still lands on its own (lower) overlay band — band
    // membership, not registration order, decides.
    const dropdown = m.register("dropdown", false);
    const modal2 = m.register("modal", true);
    expect(dropdown.zIndex).toBe(POPUP_Z_BANDS.dropdown);
    expect(modal2.zIndex).toBe(POPUP_Z_BANDS.modal);
    expect(modal2.zIndex).toBeLessThan(dropdown.zIndex);
  });

  it("keeps tooltips above overlays and below toasts", () => {
    const m = freshManager();
    const modal = m.register("modal", true);
    const tooltip = m.register("tooltip", false);
    const toast = m.register("toast", false);
    expect(tooltip.zIndex).toBe(POPUP_Z_BANDS.tooltip);
    expect(tooltip.zIndex).toBeGreaterThan(modal.zIndex);
    expect(toast.zIndex).toBeGreaterThan(tooltip.zIndex);
  });

  it("keeps the scroll lock counter balanced across register/unregister", () => {
    const m = freshManager();
    const modal = m.register("modal", true);
    expect(document.body.style.overflow).toBe("hidden");

    const dropdown = m.register("dropdown", false);
    m.unregister(dropdown.id);
    // The modal still locks scroll.
    expect(document.body.style.overflow).toBe("hidden");

    m.unregister(modal.id);
    expect(document.body.style.overflow).toBe("");
  });
});
