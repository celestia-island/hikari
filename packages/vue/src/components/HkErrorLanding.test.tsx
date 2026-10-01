import { afterEach, describe, expect, it, vi } from "vitest";
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
  copyText?: string;
  copyLabel?: string;
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
        copyText: opts.copyText ?? "",
        copyLabel: opts.copyLabel ?? "",
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

/** Stub the async clipboard (jsdom ships none) and restore afterwards. */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

function actionButtons(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll<HTMLButtonElement>(".hk-error-landing__actions button"));
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

describe("HkErrorLanding", () => {
  it("renders the fallback title when none is given", () => {
    const el = mountLanding({});
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("Something went wrong");
  });

  it("renders the given title, description, and meta chips", () => {
    const el = mountLanding({ title: "OAuth failed", description: "line1\nline2", code: "unknown_provider", status: 400 });
    expect(el.querySelector(".hk-error-landing__title")!.textContent).toBe("OAuth failed");
    // Chips ride on the canonical HkBadge (class fallthrough keeps the
    // landing-level selectors testable).
    expect(el.querySelector(".hk-error-landing__code")!.classList.contains("hk-badge")).toBe(true);
    expect(el.querySelector(".hk-error-landing__code")!.classList.contains("hk-badge-warning")).toBe(false);
    expect(el.querySelector(".hk-error-landing__code")!.textContent).toBe("unknown_provider");
    expect(el.querySelector(".hk-error-landing__status")!.classList.contains("hk-badge-muted")).toBe(true);
    expect(el.querySelector(".hk-error-landing__status")!.textContent).toBe("HTTP 400");
  });

  it("omits meta chips when neither code nor status is set", () => {
    const el = mountLanding({ title: "Boom" });
    expect(el.querySelector(".hk-error-landing__meta")).toBeNull();
  });

  it("renders the details pane always open with a tone-following code chip", () => {
    const el = mountLanding({
      details: () => h("pre", { class: "s-tool-json-tree" }, "raw"),
    });
    // No collapse affordance — the pane is a standing frame; folding
    // changes only its content (standing-frame contract in scss).
    expect(el.querySelector(".hk-error-landing__details-toggle")).toBeNull();
    expect(el.querySelector(".hk-error-landing__details-label")!.textContent).toContain("Raw error details");
    expect(el.querySelector(".hk-error-landing__details-pane")).not.toBeNull();
    expect(el.querySelector(".hk-error-landing__details-body")).not.toBeNull();
  });

  it("keeps the code chip on the tone variant and the status chip muted", () => {
    const el = mountLanding({ code: "rate_limited", status: 429, tone: "warning" });
    expect(el.querySelector(".hk-error-landing__code")!.classList.contains("hk-badge-warning")).toBe(true);
    expect(el.querySelector(".hk-error-landing__status")!.classList.contains("hk-badge-muted")).toBe(true);
  });

  it("maps the info tone onto the info chip variant", () => {
    const el = mountLanding({ code: "maintenance", tone: "info" });
    expect(el.querySelector(".hk-error-landing__code")!.classList.contains("hk-badge-info")).toBe(true);
  });

  it("renders the description text", () => {
    const el = mountLanding({ description: "line1\nline2" });
    expect(el.querySelector(".hk-error-landing__desc")!.textContent).toBe("line1\nline2");
  });

  it("attaches the overlay scrollbar chrome inside the details pane on BOTH axes", () => {
    const el = mountLanding({ details: () => h("pre", { class: "s-tool-json-tree" }, "raw") });
    const pane = el.querySelector(".hk-error-landing__details-pane")!;
    expect(pane.querySelector(".hk-scrollbar-track")).not.toBeNull();
    expect(pane.querySelector(".hk-scrollbar-thumb")).not.toBeNull();
    // The pane's CSS hides the NATIVE bar on both axes, so the overlay is
    // the only scrollbar the raw payload can ever show. A vertical-only
    // attach (the pre-fix default) leaves a horizontal overflow — deep
    // JSON nesting, long unwrapped keys (preview rows ellipsize by
    // design) — with no scrollbar at all: pin one track per axis.
    expect(pane.querySelector(".hk-scrollbar-track[data-axis='horizontal']")).not.toBeNull();
    expect(pane.querySelector(".hk-scrollbar-track:not([data-axis='horizontal'])")).not.toBeNull();
    // Exactly the two tracks — no duplicate chrome from a double attach.
    expect(pane.querySelectorAll(".hk-scrollbar-track")).toHaveLength(2);
  });

  it("renders no scrollbar chrome without a details pane", () => {
    const el = mountLanding({});
    expect(el.querySelector(".hk-scrollbar-track")).toBeNull();
  });

  it("detaches the scrollbar chrome on unmount", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(HkErrorLanding, { title: "Boom" }, { default: () => h("pre", "raw") }),
    });
    app.mount(container);
    expect(container.querySelector(".hk-scrollbar-track")).not.toBeNull();
    app.unmount();
    container.remove();
    expect(container.querySelector(".hk-scrollbar-track")).toBeNull();
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

  it("seats the built-in copy action FIRST, left of the host actions", () => {
    const el = mountLanding({
      copyText: "Boom: bad",
      actions: () => h("button", { class: "fake-action" }, "Retry"),
    });
    const buttons = actionButtons(el);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toBe("Copy error details");
    expect(buttons[1]!.classList.contains("fake-action")).toBe(true);
  });

  it("writes the copy payload and flips the label to Copied", async () => {
    const writeText = stubClipboard();
    const el = mountLanding({ copyText: "full error info" });
    const copy = actionButtons(el)[0]!;
    copy.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith("full error info");
    await nextTick();
    await nextTick();
    expect(actionButtons(el)[0]!.textContent).toBe("Copied");
  });

  it("renders the copy action alone when the host passes no actions", () => {
    const el = mountLanding({ copyText: "raw" });
    const buttons = actionButtons(el);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe("Copy error details");
  });

  it("renders no copy action and no actions row without copyText and slot", () => {
    const el = mountLanding({ title: "Boom" });
    expect(el.querySelector(".hk-error-landing__actions")).toBeNull();
  });

  it("keeps the actions row host-only when copyText is empty", () => {
    const el = mountLanding({ actions: () => h("button", { class: "fake-action" }, "Retry") });
    const buttons = actionButtons(el);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.classList.contains("fake-action")).toBe(true);
  });

  it("honours a custom copy label override", () => {
    const el = mountLanding({ copyText: "raw", copyLabel: "Copy Error" });
    expect(actionButtons(el)[0]!.textContent).toBe("Copy Error");
  });
});
