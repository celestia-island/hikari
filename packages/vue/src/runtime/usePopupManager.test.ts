import { afterEach, describe, expect, it } from "vitest";

import { usePopupManager } from "./usePopupManager";

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

describe("usePopupManager z ladder", () => {
  it("starts at the base band and steps by Z_STEP while popups stack", () => {
    const m = freshManager();
    const a = m.register("dropdown", false);
    const b = m.register("modal", true);

    expect(a.zIndex).toBe(1000);
    expect(b.zIndex).toBe(1002);
    expect(m.isOpen(a.id)).toBe(true);
    expect(m.isOpen(b.id)).toBe(true);
  });

  it("reclaims a freed z band instead of drifting upward forever", () => {
    const m = freshManager();
    // Simulate HkToast's persistent registration: it stays mounted forever,
    // so the old monotonic counter could never reset.
    const toast = m.register("toast", false);
    expect(toast.zIndex).toBe(1000);

    const a = m.register("dropdown", false);
    expect(a.zIndex).toBe(1002);
    const b = m.register("dropdown", false);
    expect(b.zIndex).toBe(1004);

    m.unregister(b.id);
    // C must reclaim B's band (1004) — NOT drift to 1006.
    const c = m.register("dropdown", false);
    expect(c.zIndex).toBe(1004);

    m.unregister(c.id);
    m.unregister(a.id);
    // Registry still holds the toast, so the ladder must not reset to base.
    expect(m.registry.value.size).toBe(1);
    const d = m.register("tooltip", false);
    expect(d.zIndex).toBe(1002);
  });

  it("resets to the base band when the registry empties", () => {
    const m = freshManager();
    const a = m.register("dropdown", false);
    const b = m.register("dropdown", false);
    m.unregister(a.id);
    m.unregister(b.id);

    expect(m.registry.value.size).toBe(0);
    const c = m.register("tooltip", false);
    expect(c.zIndex).toBe(1000);
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
