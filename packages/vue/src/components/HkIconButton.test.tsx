import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";

import HkIconButton from "./HkIconButton";

/**
 * HkIconButton contract tests:
 * - extra attrs (aria-label / title / data-*) fall through onto the root
 *   <button> (the component sets inheritAttrs:false and MUST spread
 *   $attrs itself — regression guard for silent dead attributes)
 * - the declared `click` emit keeps firing alongside the fallthrough
 * - disabled + size classes compose with the fallthrough attrs.
 *
 * House style: no @vue/test-utils dependency — raw createApp mounts on a
 * shared container list torn down after each case.
 */

const mounts: Array<ReturnType<typeof createApp>> = [];

function mountComp(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(defineComponent({ setup: () => render }));
  mounts.push(app);
  app.mount(container);
  return container;
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
});

describe("HkIconButton", () => {
  it("falls through extra attrs (aria-label / title) onto the root button", () => {
    const c = mountComp(() =>
      h(HkIconButton, {
        "aria-label": "Close inspector",
        title: "Close inspector",
        "data-test": "probe",
      }, { icon: () => h("span", "x") }),
    );
    const btn = c.querySelector("button")!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Close inspector");
    expect(btn.getAttribute("title")).toBe("Close inspector");
    expect(btn.getAttribute("data-test")).toBe("probe");
  });

  it("keeps the declared click emit working alongside attr fallthrough", async () => {
    let clicks = 0;
    const c = mountComp(() =>
      h(HkIconButton, {
        "aria-label": "go",
        onClick: () => { clicks += 1; },
      }, { icon: () => h("span") }),
    );
    (c.querySelector("button")! as HTMLButtonElement).click();
    await Promise.resolve();
    expect(clicks).toBe(1);
  });

  it("renders disabled and the size class together with fallthrough attrs", () => {
    const c = mountComp(() =>
      h(HkIconButton, {
        size: 16,
        disabled: true,
        "aria-label": "sync",
      }),
    );
    const btn = c.querySelector("button")! as HTMLButtonElement;
    expect(btn.classList.contains("hk-icon-button-16")).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-label")).toBe("sync");
  });
});
