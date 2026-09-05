import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkErrorLanding } from "./HkErrorLanding";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOptions {
  title?: string;
  description?: string;
  code?: string;
  status?: number;
  tone?: "error" | "warning" | "info";
  variant?: "page" | "inline";
  detailsOpen?: boolean;
  details?: () => ReturnType<typeof h>;
  actions?: () => ReturnType<typeof h>;
  brand?: () => ReturnType<typeof h>;
}

function mountLanding(opts: MountOptions = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkErrorLanding, {
        title: opts.title ?? "",
        description: opts.description ?? "",
        code: opts.code ?? "",
        status: opts.status,
        tone: opts.tone ?? "error",
        variant: opts.variant ?? "page",
        detailsOpen: opts.detailsOpen ?? true,
      }, {
        ...(opts.details ? { default: opts.details } : {}),
        ...(opts.actions ? { actions: opts.actions } : {}),
        ...(opts.brand ? { brand: opts.brand } : {}),
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkErrorLanding", () => {
  it("renders the fallback title when none is given", () => {
    const el = mountLanding({});
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("Something went wrong");
  });

  it("renders the given title, description, and meta chips", () => {
    const el = mountLanding({ title: "OAuth failed", description: "line1\nline2", code: "unknown_provider", status: 400 });
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("OAuth failed");
    expect(el.querySelector(".hk-error-landing__code")!.textContent).toBe("unknown_provider");
    expect(el.querySelector(".hk-error-landing__status")!.textContent).toBe("HTTP 400");
  });

  it("omits meta chips when neither code nor status is set", () => {
    const el = mountLanding({ title: "Boom" });
    expect(el.querySelector(".hk-error-landing__meta")).toBeNull();
  });

  it("renders the details slot with the raw JSON tree pane and toggles it", async () => {
    const el = mountLanding({
      details: () => h("pre", { class: "s-tool-json-tree" }, "raw"),
    });
    const toggle = el.querySelector<HTMLButtonElement>(".hk-error-landing__details-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(el.querySelector(".hk-error-landing__details-body")).not.toBeNull();
    toggle.click();
    await nextTick();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(el.querySelector(".hk-error-landing__details-body")).toBeNull();
  });

  it("keeps details collapsed when detailsOpen is false", () => {
    const el = mountLanding({ detailsOpen: false, details: () => h("pre", {}, "raw") });
    expect(el.querySelector(".hk-error-landing__details-body")).toBeNull();
  });

  it("renders no details section without a default slot", () => {
    const el = mountLanding({});
    expect(el.querySelector(".hk-error-landing__details")).toBeNull();
  });

  it("renders action and brand slots and applies the tone class", () => {
    const el = mountLanding({
      tone: "warning",
      actions: () => h("button", { class: "fake-action" }, "Back"),
      brand: () => h("div", { class: "fake-brand" }, "brand"),
    });
    expect(el.querySelector(".hk-error-landing")!.classList.contains("is-warning")).toBe(true);
    expect(el.querySelector(".fake-action")).not.toBeNull();
    expect(el.querySelector(".fake-brand")).not.toBeNull();
  });

  it("applies the inline variant class without the page backdrop", () => {
    const el = mountLanding({ variant: "inline", title: "Boom" });
    const root = el.querySelector(".hk-error-landing")!;
    expect(root.classList.contains("is-inline")).toBe(true);
  });
});
