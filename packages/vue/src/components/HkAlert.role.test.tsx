import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkAlert from "./HkAlert";

/**
 * A11y guard for HkAlert's root live-region role: error/warning announce
 * assertively (`role="alert"`, implicit aria-live="assertive"), info/
 * success politely (`role="status"`, implicit aria-live="polite") — the
 * ARIA standard split, same pattern as the chest notification wave
 * (#2582/#2583). The role rides the ROOT element so the whole alert
 * body is announced as one region.
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
    ["error", "alert"],
    ["warning", "alert"],
    ["info", "status"],
    ["success", "status"],
  ] as const)("the %s variant renders role=%s on the root", (variant, role) => {
    const el = mountAlert({ variant });
    expect(el.getAttribute("role")).toBe(role);
  });

  it("the default variant (error) announces assertively", () => {
    const el = mountAlert();
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("the role rides the ROOT element, and the alert is ONE region", () => {
    const el = mountAlert({ variant: "info" });
    expect(el.classList.contains("hk-alert")).toBe(true);
    expect(el.getAttribute("role")).toBe("status");
    // The root is the only role carrier: no nested live region, so
    // assistive tech never double-announces the body.
    expect(el.querySelectorAll("[role]").length).toBe(0);
  });
});
