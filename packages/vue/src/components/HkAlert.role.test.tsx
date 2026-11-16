import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive } from "vue";

import HkAlert from "./HkAlert";

/**
 * A11y guard for HkAlert's root live-region semantics: error/warning
 * announce assertively (`role="alert"` + aria-live="assertive"), info/
 * success politely (`role="status"` + aria-live="polite") — the same
 * split and explicit pairing as the HkToast family. The role rides the
 * ROOT element so the whole alert body is one announced region, and
 * the pairing must survive a runtime variant change (both real
 * consumers mount the alert conditionally; HkSectionCard swaps the
 * variant as state changes).
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountAlert(props: Record<string, unknown> = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () => h(HkAlert, { message: "mind the gap", ...props });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const el = container.querySelector<HTMLElement>(".hk-alert");
  expect(el, ".hk-alert renders").toBeTruthy();
  return el!;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkAlert live-region role", () => {
  it.each([
    ["error", "alert", "assertive"],
    ["warning", "alert", "assertive"],
    ["info", "status", "polite"],
    ["success", "status", "polite"],
  ] as const)(
    "the %s variant renders role=%s + aria-live=%s on the root",
    (variant, role, live) => {
      const el = mountAlert({ variant });
      expect(el.getAttribute("role")).toBe(role);
      expect(el.getAttribute("aria-live")).toBe(live);
    },
  );

  it("the default variant (error) announces assertively", () => {
    const el = mountAlert();
    expect(el.getAttribute("role")).toBe("alert");
    expect(el.getAttribute("aria-live")).toBe("assertive");
  });

  it("the pairing survives a runtime variant change", async () => {
    // The computed role must react to the prop: HkSectionCard swaps the
    // variant while mounted (idle → error), so a stale role would
    // mis-announce the whole class of state-driven alerts.
    const state = reactive<{ variant: "info" | "error" }>({ variant: "info" });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Wrapper = defineComponent({
      setup() {
        return () => h(HkAlert, { message: "mind the gap", ...state });
      },
    });
    const app = createApp(Wrapper);
    app.mount(container);
    mounts.push({ app, container });

    const el = container.querySelector<HTMLElement>(".hk-alert")!;
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-live")).toBe("polite");

    state.variant = "error";
    await nextTick();
    expect(el.getAttribute("role")).toBe("alert");
    expect(el.getAttribute("aria-live")).toBe("assertive");
  });

  it("the root is the only role carrier — even with title + close button", () => {
    // The closable configuration adds the most plausible nested
    // candidate (a <button>); it must stay role-less so the root
    // remains the ONE announced region (no double announcement).
    const el = mountAlert({ variant: "info", closable: true, title: "Heads up" });
    expect(el.classList.contains("hk-alert")).toBe(true);
    expect(el.getAttribute("role")).toBe("status");
    expect(el.querySelector("button.hk-alert-close")).toBeTruthy();
    expect(el.querySelectorAll("[role]").length).toBe(0);
  });
});
