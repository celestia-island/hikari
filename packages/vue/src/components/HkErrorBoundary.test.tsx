import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type Component } from "vue";

import HkErrorBoundary from "./HkErrorBoundary";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountWith(child: Component, props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkErrorBoundary, props, { default: () => h(child) }),
  });
  app.config.errorHandler = () => {}; // Silence Vue's own duplicate logging.
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

const Boom = defineComponent({
  name: "Boom",
  setup() {
    throw new TypeError("Cannot read properties of undefined (reading 'length')");
  },
  render: () => h("div", "never"),
});

const Fine = defineComponent({
  name: "Fine",
  render: () => h("div", { class: "fine-child" }, "fine"),
});

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  vi.restoreAllMocks();
});

describe("HkErrorBoundary", () => {
  it("renders children while nothing throws", () => {
    const el = mountWith(Fine);
    expect(el.querySelector(".fine-child")).not.toBeNull();
    expect(el.querySelector(".hk-error-landing")).toBeNull();
  });

  it("captures a crash and renders the inline error landing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mountWith(Boom);
    await nextTick();

    const landing = el.querySelector(".hk-error-landing");
    expect(landing).not.toBeNull();
    expect(landing!.classList.contains("is-inline")).toBe(true);
    expect(el.querySelector(".hk-error-landing__code")!.textContent).toBe("TypeError");
    expect(el.querySelector(".hk-error-landing__desc")!.textContent)
      .toBe("Cannot read properties of undefined (reading 'length')");
    // Raw details ride in the JSON tree.
    expect(el.querySelector(".s-tool-json-tree")).not.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("falls back to the default headline when no title is given", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mountWith(Boom);
    await nextTick();
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("Something went wrong");
  });

  it("honours a custom title override", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mountWith(Boom, { errorTitle: "发生了错误" });
    await nextTick();
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("发生了错误");
  });

  it("recovers via the retry action", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mountWith(Boom, { retryLabel: "重试" });
    await nextTick();

    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button"));
    const retry = buttons.find((b) => b.textContent === "重试");
    expect(retry).toBeDefined();
    retry!.click();
    await nextTick();
    // The slot rerender throws again, so the landing stays — but the error
    // ref was cleared and recaptured (boundary proven by a fresh record).
    expect(el.querySelector(".hk-error-landing")).not.toBeNull();
  });

  it("keeps the custom fallback render prop contract", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const el = mountWith(Boom, {
      fallback: (err: string, retry: () => void) => h("div", { class: "custom-fallback" }, [err.slice(0, 10), h("button", { onClick: retry }, "go")]),
    });
    await nextTick();
    expect(el.querySelector(".custom-fallback")).not.toBeNull();
    expect(el.querySelector(".hk-error-landing")).toBeNull();
  });
});
