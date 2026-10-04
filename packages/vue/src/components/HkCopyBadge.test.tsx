import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, defineComponent } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HkCopyBadge from "./HkCopyBadge";
import { useToast } from "../runtime/useToast";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  useToast().toasts.splice(0);
});

// `navigator.clipboard` does not exist under happy-dom — install a
// controllable stub and restore whatever was there before.
let writeText: ReturnType<typeof vi.fn>;
const originalClipboard = navigator.clipboard;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  });
});

describe("HkCopyBadge", () => {
  it("renders a HkBadge inside the tooltip wrapper with button semantics", () => {
    const c = mount(() => h(HkCopyBadge, { variant: "muted", mono: true }, () => "#d.132"));
    // The badge keeps its HkBadge identity (variant class, mono flag)…
    const badge = c.querySelector(".hk-badge");
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains("hk-badge-muted")).toBe(true);
    expect(badge!.hasAttribute("data-mono")).toBe(true);
    expect(badge!.textContent).toBe("#d.132");
    // …wrapped by the house tooltip, with button semantics on the badge.
    expect(c.querySelector(".hk-tooltip-wrapper")).not.toBeNull();
    expect(badge!.getAttribute("role")).toBe("button");
    expect(badge!.getAttribute("tabindex")).toBe("0");
    expect(badge!.classList.contains("hk-copy-badge")).toBe(true);
  });

  it("copies the rendered text on click and toasts the localized default", async () => {
    const c = mount(() => h(HkCopyBadge, null, () => "#demiurge.132"));
    (c.querySelector(".hk-badge") as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("#demiurge.132");
    const success = useToast().toasts.find((t) => t.type === "success");
    expect(success?.messages.some((m) => m.text === "Copied")).toBe(true);
  });

  it("prefers the value prop over the rendered label as the copy payload", async () => {
    const c = mount(() =>
      h(HkCopyBadge, { value: "demiurge.132" }, () => "#d.132"),
    );
    (c.querySelector(".hk-badge") as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("demiurge.132");
    expect(writeText).not.toHaveBeenCalledWith("#d.132");
  });

  it("stops the click from reaching clickable ancestors", async () => {
    const rowClick = vi.fn();
    const Row = defineComponent({
      setup() {
        return () =>
          h("div", { onClick: rowClick }, h(HkCopyBadge, null, () => "#d.132"));
      },
    });
    const c = mount(() => h(Row));
    (c.querySelector(".hk-badge") as HTMLElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalled();
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("activates on Enter and Space but not other keys", async () => {
    const c = mount(() => h(HkCopyBadge, null, () => "x"));
    const badge = c.querySelector(".hk-badge") as HTMLElement;

    badge.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    badge.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(2);

    badge.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("swaps the click behavior when `action` is set", async () => {
    const action = vi.fn();
    const c = mount(() => h(HkCopyBadge, { action, tooltip: "Open details" }, () => "#d.132"));
    (c.querySelector(".hk-badge") as HTMLElement).click();
    await Promise.resolve();

    expect(action).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders the custom tooltip text", () => {
    const c = mount(() => h(HkCopyBadge, { tooltip: "Open details" }, () => "#d.132"));
    const content = c.parentElement!.querySelector(".hk-tooltip-popup .hk-tooltip-content");
    expect(content?.textContent).toBe("Open details");
  });

  it("shows the localized click-to-copy tooltip by default", () => {
    const c = mount(() => h(HkCopyBadge, null, () => "#d.132"));
    const content = c.parentElement!.querySelector(".hk-tooltip-popup .hk-tooltip-content");
    expect(content?.textContent).toBe("Click to copy");
  });

  it("renders the inert badge face when disabled", () => {
    const c = mount(() => h(HkCopyBadge, { disabled: true }, () => "#d.132"));
    const badge = c.querySelector(".hk-badge")!;
    expect(badge.getAttribute("role")).toBeNull();
    expect(badge.getAttribute("tabindex")).toBeNull();
    expect(badge.classList.contains("hk-copy-badge")).toBe(false);
    // No tooltip wrapper at all.
    expect(c.querySelector(".hk-tooltip-wrapper")).toBeNull();
  });

  it("keeps the workspace tag contract: no badge text selection, ever", () => {
    // Source contract on the HkBadge base sheet — every tag in every host
    // inherits the no-selection rule, copyable or not.
    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "HkBadge.scss"), "utf-8");
    expect(scss).toMatch(/user-select:\s*none/);
  });

  it("lands consumer class on the badge element, not the tooltip wrapper", () => {
    const c = mount(() => h(HkCopyBadge, { class: "s-kanban-card-tag" }, () => "#tag"));
    const badge = c.querySelector(".hk-badge")!;
    expect(badge.classList.contains("s-kanban-card-tag")).toBe(true);
    expect(badge.classList.contains("hk-copy-badge")).toBe(true);
    const wrapper = c.querySelector(".hk-tooltip-wrapper")!;
    expect(wrapper.classList.contains("s-kanban-card-tag")).toBe(false);
  });

  it("keeps consumer class when disabled", () => {
    const c = mount(() => h(HkCopyBadge, { disabled: true, class: "x-pill" }, () => "#tag"));
    expect(c.querySelector(".hk-badge")!.classList.contains("x-pill")).toBe(true);
  });
});
