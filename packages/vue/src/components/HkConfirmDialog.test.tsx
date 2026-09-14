import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkConfirmDialog from "./HkConfirmDialog";

const apps: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  document.body.innerHTML = "";
});

async function flush() {
  await nextTick();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Mount an open confirm dialog and record every event it emits. */
function mountDialog(extra: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(true);
  const events: string[] = [];
  const Host = defineComponent({
    setup() {
      return () =>
        h(HkConfirmDialog, {
          open: open.value,
          title: "Enable emergency lockdown?",
          message: "Every agent tool call is blocked.",
          confirmLabel: "Confirm",
          cancelLabel: "Cancel",
          onConfirm: () => events.push("confirm"),
          onCancel: () => events.push("cancel"),
          "onUpdate:open": (v: boolean) => events.push(`open:${v}`),
          ...extra,
        });
    },
  });
  const app = createApp(Host);
  apps.push(app);
  app.mount(container);
  return { open, events };
}

function actionButtons(): HTMLButtonElement[] {
  return [
    ...document.body.querySelectorAll<HTMLButtonElement>(
      ".hk-confirm-dialog-actions button",
    ),
  ];
}

describe("HkConfirmDialog", () => {
  it("puts the primary action before the dismiss action", async () => {
    mountDialog();
    await flush();

    const buttons = actionButtons();
    expect(buttons.map((b) => b.textContent)).toEqual(["Confirm", "Cancel"]);
    // The first button is the primary one (danger by default), the second the
    // secondary dismiss — desktop message-box ordering.
    expect(buttons[0]!.classList.contains("hk-btn-danger")).toBe(true);
    expect(buttons[1]!.classList.contains("hk-btn-secondary")).toBe(true);
  });

  it("resolves through confirm + update:open on the primary action", async () => {
    const { events } = mountDialog();
    await flush();

    actionButtons()[0]!.click();
    await flush();

    expect(events).toEqual(["confirm", "open:false"]);
  });

  it("resolves through cancel + update:open on the dismiss action", async () => {
    const { events } = mountDialog();
    await flush();

    actionButtons()[1]!.click();
    await flush();

    expect(events).toEqual(["cancel", "open:false"]);
  });

  /** `open` is caller-owned, so relaying the modal's close request as
   *  `update:open` alone left the window on screen and the caller's promise
   *  pending: the operator hit ✕, nothing happened, and an awaiting
   *  `useConfirm()` caller waited until unmount (user report 2026-09-11). */
  it("dismisses as a cancel when the title-bar close button is used", async () => {
    const { events } = mountDialog();
    await flush();

    const close = document.body.querySelector<HTMLButtonElement>(".hk-modal-close");
    expect(close, "title-bar close button renders").toBeTruthy();
    close!.click();
    await flush();

    expect(events).toContain("cancel");
    expect(events).toContain("open:false");
    expect(events).not.toContain("confirm");
  });

  it("dismisses as a cancel when the overlay is clicked", async () => {
    const { events } = mountDialog();
    await flush();

    const overlay = document.body.querySelector<HTMLElement>(".hk-modal-overlay");
    expect(overlay, "overlay renders").toBeTruthy();
    overlay!.click();
    await flush();

    expect(events).toContain("cancel");
    expect(events).toContain("open:false");
  });

  it("dismisses as a cancel on Escape", async () => {
    const { events } = mountDialog();
    await flush();

    const surface = document.body.querySelector<HTMLElement>(".hk-modal-content");
    expect(surface, "dialog surface renders").toBeTruthy();
    surface!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flush();

    expect(events).toContain("cancel");
    expect(events).toContain("open:false");
    expect(events).not.toContain("confirm");
  });

  it("cannot be dismissed while the confirmation is loading", async () => {
    const { events } = mountDialog({ loading: true });
    await flush();

    expect(document.body.querySelector(".hk-modal-close")).toBeNull();
    // Both actions refuse input too, so a half-submitted confirmation cannot
    // be answered twice.
    const buttons = actionButtons();
    expect(buttons.map((b) => b.disabled)).toEqual([true, true]);
    buttons.forEach((b) => b.click());
    const overlay = document.body.querySelector<HTMLElement>(".hk-modal-overlay");
    overlay?.click();
    await flush();

    expect(events).toEqual([]);
  });
});
