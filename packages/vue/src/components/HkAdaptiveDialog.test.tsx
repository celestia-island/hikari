import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkAdaptiveDialog from "./HkAdaptiveDialog";
import { setLocale } from "../i18n/context";
import { usePopupManager } from "../runtime/usePopupManager";

/**
 * HkAdaptiveDialog contract tests:
 * - desktop width renders the HkModal shell, mobile width renders the
 *   HkDrawer side="bottom" shell, and the shell flips live on resize
 * - the v-model / update:modelValue contract round-trips in both shells
 * - footerActions render in both shells (same order/labels/handlers)
 * - the footer slot wins over footerActions (HkModal's precedence)
 * - afterLeave is forwarded from the active shell
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
const originalWidth = window.innerWidth;

const setWidth = (w: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: w,
  });
  window.dispatchEvent(new Event("resize"));
};

interface DialogHarness {
  container: HTMLElement;
  open: ReturnType<typeof ref<boolean>>;
  emitted: Array<string | null>;
  afterLeaveCount: () => number;
  unmount: () => void;
}

function mountDialog(
  props: Record<string, unknown> = {},
  slots: Record<string, unknown> = {},
): DialogHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const open = ref(true);
  const emitted: Array<string | null> = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkAdaptiveDialog, {
          title: "Test dialog",
          ...props,
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => {
            emitted.push(String(v));
            open.value = v;
          },
          "onAfterLeave": () => {
            emitted.push("afterLeave");
          },
        } as never, slots as never);
    },
  });

  const app = createApp(Wrapper);
  const entry = { app, container };
  mounts.push(entry);
  app.mount(container);
  return {
    container,
    open,
    emitted,
    afterLeaveCount: () => emitted.filter((e) => e === "afterLeave").length,
    unmount: () => {
      const idx = mounts.indexOf(entry);
      if (idx !== -1) mounts.splice(idx, 1);
      app.unmount();
      container.remove();
    },
  };
}

/** Let Vue's enter/leave transitions (frame/timeout based) settle in happy-dom. */
async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function modalContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-modal-content");
}

function drawerPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-drawer-panel");
}

function footerButtons(root: ParentNode): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter(
    (b) => !b.classList.contains("hk-modal-close") && !b.classList.contains("hk-drawer-close"),
  );
}

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.querySelectorAll(".hk-modal-root, .hk-drawer-overlay, [class^='hk-drawer-panel']").forEach((el) => el.remove());
  setWidth(originalWidth);
  await setLocale("en");
});

describe("HkAdaptiveDialog", () => {
  it("renders the modal shell at desktop width and registers kind modal", () => {
    setWidth(1280);
    mountDialog();
    expect(modalContent()).toBeTruthy();
    expect(drawerPanel()).toBeNull();

    const entries = [...usePopupManager().registry.value.values()];
    expect(entries.some((e) => e.kind === "modal" && e.title === "Test dialog")).toBe(true);
    expect(entries.some((e) => e.kind === "drawer")).toBe(false);
  });

  it("renders the bottom drawer shell at mobile width and registers kind drawer", () => {
    setWidth(375);
    mountDialog();
    const panel = drawerPanel();
    expect(panel).toBeTruthy();
    expect(panel!.classList.contains("hk-drawer-bottom")).toBe(true);
    expect(modalContent()).toBeNull();
    // No footer slot and no footerActions -> no empty footer band.
    expect(document.querySelector(".hk-drawer-footer")).toBeNull();

    const entries = [...usePopupManager().registry.value.values()];
    expect(entries.some((e) => e.kind === "drawer")).toBe(true);
    expect(entries.some((e) => e.kind === "modal")).toBe(false);
  });

  it("flips the shell live when the viewport crosses the breakpoint", async () => {
    setWidth(1280);
    mountDialog();
    expect(modalContent()).toBeTruthy();
    expect(drawerPanel()).toBeNull();

    setWidth(375);
    await nextTick();
    await settle();
    expect(drawerPanel()).toBeTruthy();
    expect(modalContent()).toBeNull();

    setWidth(1280);
    await nextTick();
    await settle();
    expect(modalContent()).toBeTruthy();
    expect(drawerPanel()).toBeNull();
  });

  it("round-trips v-model through the modal shell (close button + reopen)", async () => {
    setWidth(1280);
    const harness = mountDialog();
    expect(modalContent()).toBeTruthy();

    document.querySelector<HTMLElement>(".hk-modal-close")!.click();
    await settle();
    expect(harness.emitted).toContain("false");
    expect(modalContent()).toBeNull();

    harness.open.value = true;
    await settle();
    expect(modalContent()).toBeTruthy();
  });

  it("round-trips v-model through the drawer shell and forwards afterLeave", async () => {
    setWidth(375);
    const harness = mountDialog();
    expect(drawerPanel()).toBeTruthy();

    document.querySelector<HTMLElement>(".hk-drawer-close")!.click();
    await settle();
    expect(harness.emitted).toContain("false");
    expect(drawerPanel()).toBeNull();
    expect(harness.afterLeaveCount()).toBeGreaterThan(0);

    harness.open.value = true;
    await settle();
    expect(drawerPanel()).toBeTruthy();
  });

  it("closes on Escape through the drawer shell", async () => {
    setWidth(375);
    const harness = mountDialog();
    const panel = drawerPanel()!;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(harness.emitted).toContain("false");
  });

  it("renders footerActions in the modal footer", () => {
    setWidth(1280);
    mountDialog({
      footerActions: [
        { label: "Keep", variant: "secondary" },
        { label: "Delete", variant: "danger" },
      ],
    });
    const labels = footerButtons(document).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Keep", "Delete"]);
  });

  it("renders footerActions as an equivalent button row in the drawer footer", () => {
    setWidth(375);
    const clicked: string[] = [];
    mountDialog({
      footerActions: [
        { label: "Keep", variant: "secondary", onClick: () => clicked.push("keep") },
        { label: "Delete", variant: "danger", onClick: () => clicked.push("delete") },
      ],
    });
    const footer = document.querySelector<HTMLElement>(".hk-drawer-footer");
    expect(footer).toBeTruthy();
    const row = footer!.querySelector<HTMLElement>(".hk-adaptive-dialog-footer");
    expect(row).toBeTruthy();

    const labels = footerButtons(footer!).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Keep", "Delete"]);

    footerButtons(footer!)[1].click();
    expect(clicked).toEqual(["delete"]);
  });

  it("lets the footer slot win over footerActions in both shells", () => {
    const slots = { footer: () => h("div", { class: "custom-footer" }, "CUSTOM") };
    const actions = [{ label: "SlotShouldWin" }];

    setWidth(1280);
    const desktop = mountDialog({ footerActions: actions }, slots);
    expect(document.querySelector(".hk-modal-footer .custom-footer")).toBeTruthy();
    expect(footerButtons(document).map((b) => b.textContent?.trim())).toEqual([]);
    desktop.unmount();

    setWidth(375);
    const mobile = mountDialog({ footerActions: actions }, slots);
    const footer = document.querySelector<HTMLElement>(".hk-drawer-footer")!;
    expect(footer.querySelector(".custom-footer")).toBeTruthy();
    expect(footerButtons(footer).map((b) => b.textContent?.trim())).toEqual([]);
    mobile.unmount();
  });

  it("maps the header slot to the modal sub-header and keeps the drawer title bar", () => {
    const slots = { header: () => h("div", { class: "custom-header" }, "SUB") };

    setWidth(1280);
    const desktop = mountDialog({}, slots);
    expect(document.querySelector(".hk-modal-subheader .custom-header")).toBeTruthy();
    expect(document.querySelector<HTMLElement>(".hk-modal-title")!.textContent).toContain("Test dialog");
    desktop.unmount();

    setWidth(375);
    const mobile = mountDialog({}, slots);
    const composed = document.querySelector<HTMLElement>(".hk-adaptive-dialog-drawer-header");
    expect(composed).toBeTruthy();
    expect(composed!.querySelector(".hk-drawer-title")!.textContent).toContain("Test dialog");
    expect(composed!.querySelector(".custom-header")).toBeTruthy();
    mobile.unmount();
  });
});
