import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkLoadMore from "./HkLoadMore";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

/** The en bundle loads eagerly, so the two-arg t() fallbacks double as
 *  the assertions' expected strings — no i18n test setup needed. */
describe("HkLoadMore", () => {
  it("idle renders the load-more button and the shown/total counter", () => {
    const c = mount(h(HkLoadMore, { shown: 3, total: 19 }));
    const button = c.querySelector("button.hk-btn");
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain("Load more");
    expect(c.querySelector(".hk-load-more-count")!.textContent).toBe("3 / 19");
    expect(c.querySelector(".hk-load-more")!.getAttribute("data-state")).toBe("idle");
  });

  it("clicking the button emits load-more", () => {
    const fired: string[] = [];
    const c = mount(h(HkLoadMore, { onLoadMore: () => fired.push("more") }));
    (c.querySelector("button.hk-btn") as HTMLButtonElement).click();
    expect(fired).toEqual(["more"]);
  });

  it("loading state disables the button with aria-busy and the loading label", () => {
    const c = mount(h(HkLoadMore, { state: "loading", shown: 3, total: 19 }));
    const button = c.querySelector("button.hk-btn") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("Loading…");
    expect(c.querySelector(".hk-spinner")).not.toBeNull();
  });

  it("end state swaps the button for the reached-the-end status note", () => {
    const c = mount(h(HkLoadMore, { state: "end", shown: 19, total: 19 }));
    expect(c.querySelector("button.hk-btn")).toBeNull();
    const note = c.querySelector('[role="status"]');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain("You've reached the end");
    expect(c.querySelector(".hk-load-more-count")!.textContent).toBe("19 / 19");
  });

  it("omits the counter entirely when shown/total are absent", () => {
    const c = mount(h(HkLoadMore));
    expect(c.querySelector(".hk-load-more-count")).toBeNull();
  });
});
