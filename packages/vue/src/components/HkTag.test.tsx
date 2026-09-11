import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, type VNode } from "vue";

import HkTag from "./HkTag";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountTag(props: Record<string, unknown> = {}, children?: () => VNode) {
  const events = { close: 0 };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(
        HkTag,
        {
          ...props,
          onClose: () => {
            events.close++;
          },
        },
        children ? { default: children } : undefined,
      ),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { events, container };
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkTag", () => {
  it("renders slot content without a close button by default", () => {
    const { container } = mountTag({}, () => h("span", "Default"));
    const tag = container.querySelector(".hk-tag")!;
    expect(tag.textContent).toBe("Default");
    expect(tag.querySelector(".hk-tag-close")).toBeNull();
  });

  it("closable renders the × which emits close", () => {
    const { events, container } = mountTag({ closable: true }, () => h("span", "Closable"));
    const close = container.querySelector<HTMLButtonElement>(".hk-tag-close")!;
    expect(close).toBeTruthy();
    // The pre-prop markup: an unlabeled button, exactly as before.
    expect(close.hasAttribute("aria-label")).toBe(false);
    close.click();
    expect(events.close).toBe(1);
  });

  it("closeLabel names the close button for screen readers", () => {
    const { events, container } = mountTag(
      { closable: true, closeLabel: "Remove — News" },
      () => h("span", "News"),
    );
    const close = container.querySelector<HTMLButtonElement>(".hk-tag-close")!;
    expect(close.getAttribute("aria-label")).toBe("Remove — News");
    close.click();
    expect(events.close).toBe(1);
  });

  it("keeps the variant and size classes untouched", () => {
    const { container } = mountTag(
      { variant: "success", size: "sm", closable: true, closeLabel: "Remove" },
      () => h("span", "Done"),
    );
    const tag = container.querySelector(".hk-tag")!;
    expect(tag.classList.contains("hk-tag-success")).toBe(true);
    expect(tag.classList.contains("hk-tag-sm")).toBe(true);
  });
});
