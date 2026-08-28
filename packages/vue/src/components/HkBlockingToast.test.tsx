import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkBlockingToast from "./HkBlockingToast";
import { setLocale } from "../i18n/context";
import { usePopupManager } from "../runtime/usePopupManager";
import {
  clearBlockingToasts,
  showBlockingToast,
} from "../runtime/useBlockingToast";

/**
 * HkBlockingToast + useBlockingToast contract tests:
 * - showBlockingToast renders a card in the toast stack host
 * - confirm resolves true, cancel resolves false, and the card leaves
 * - no auto-dismiss by default (the gate is truly blocking)
 * - timeoutMs resolves false on expiry
 * - the open card registers with the popup manager (kind "toast") and
 *   unregisters when answered
 * - multiple prompts stack and resolve independently
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountHost() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkBlockingToast) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hk-blocking-toast-card"));
}

function actionButtons(card: HTMLElement): HTMLButtonElement[] {
  return Array.from(card.querySelectorAll<HTMLButtonElement>(".hk-blocking-toast-actions button"));
}

function toastRegistryTitles(): Array<{ kind: string; title?: string }> {
  return [...usePopupManager().registry.value.values()].map((e) => ({ kind: e.kind, title: e.title }));
}

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  clearBlockingToasts();
  document.querySelectorAll(".hk-blocking-toast-container").forEach((el) => el.remove());
  await setLocale("en");
});

describe("HkBlockingToast", () => {
  it("shows a card on showBlockingToast with title, message and default labels", async () => {
    mountHost();
    const gate = showBlockingToast("Admins can view your usage.", { title: "Join group?" });
    await settle();

    expect(cards().length).toBe(1);
    const card = cards()[0];
    expect(card.querySelector(".hk-blocking-toast-title")!.textContent).toContain("Join group?");
    expect(card.querySelector(".hk-blocking-toast-message")!.textContent).toContain("Admins can view your usage.");
    const labels = actionButtons(card).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Cancel", "Confirm"]);

    actionButtons(card)[1].click();
    await expect(gate).resolves.toBe(true);
    await settle();
    expect(cards().length).toBe(0);
  });

  it("resolves false on cancel and removes the card", async () => {
    mountHost();
    const gate = showBlockingToast("Cancel me");
    await settle();
    const card = cards()[0];

    actionButtons(card)[0].click();
    await expect(gate).resolves.toBe(false);
    await settle();
    expect(cards().length).toBe(0);
  });

  it("does not auto-dismiss by default", async () => {
    mountHost();
    const gate = showBlockingToast("Blocks forever");
    await settle();
    expect(cards().length).toBe(1);

    await new Promise((r) => setTimeout(r, 120));
    expect(cards().length).toBe(1);

    // Clean up the deliberately unanswered gate.
    actionButtons(cards()[0])[1].click();
    await expect(gate).resolves.toBe(true);
  });

  it("registers with the popup manager while open and unregisters when answered", async () => {
    mountHost();
    expect(toastRegistryTitles().some((e) => e.kind === "toast")).toBe(false);

    const gate = showBlockingToast("Register me", { title: "Consent" });
    await settle();
    expect(toastRegistryTitles().some((e) => e.kind === "toast" && e.title === "Consent")).toBe(true);

    actionButtons(cards()[0])[0].click();
    await expect(gate).resolves.toBe(false);
    await settle();
    expect(toastRegistryTitles().some((e) => e.kind === "toast")).toBe(false);
  });

  it("resolves false when timeoutMs expires", async () => {
    mountHost();
    const gate = showBlockingToast("Times out", { timeoutMs: 40 });
    await settle();
    expect(cards().length).toBe(1);

    await expect(gate).resolves.toBe(false);
    await settle();
    expect(cards().length).toBe(0);
  });

  it("stacks multiple prompts that resolve independently", async () => {
    mountHost();
    const first = showBlockingToast("First prompt", { title: "One" });
    const second = showBlockingToast("Second prompt", { title: "Two" });
    await settle();

    expect(cards().length).toBe(2);
    const [cardOne, cardTwo] = cards();
    expect(cardOne.querySelector(".hk-blocking-toast-title")!.textContent).toContain("One");
    expect(cardTwo.querySelector(".hk-blocking-toast-title")!.textContent).toContain("Two");

    // Answer only the second; the first keeps blocking.
    actionButtons(cardTwo)[1].click();
    await expect(second).resolves.toBe(true);
    await settle();
    expect(cards().length).toBe(1);
    expect(cards()[0].querySelector(".hk-blocking-toast-title")!.textContent).toContain("One");

    actionButtons(cards()[0])[0].click();
    await expect(first).resolves.toBe(false);
  });

  it("honors custom labels and the danger variant", async () => {
    mountHost();
    const gate = showBlockingToast("Danger zone", {
      confirmLabel: "Join",
      cancelLabel: "Back out",
      variant: "danger",
    });
    await settle();

    const card = cards()[0];
    expect(card.classList.contains("hk-blocking-toast-danger")).toBe(true);
    const labels = actionButtons(card).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["Back out", "Join"]);

    actionButtons(card)[1].click();
    await expect(gate).resolves.toBe(true);
  });

  it("uses localized default labels when the locale provides them", async () => {
    await setLocale("zh-Hans");
    mountHost();
    const gate = showBlockingToast("本地化");
    await settle();

    const labels = actionButtons(cards()[0]).map((b) => b.textContent?.trim());
    expect(labels).toEqual(["取消", "确认"]);

    actionButtons(cards()[0])[1].click();
    await expect(gate).resolves.toBe(true);
    await setLocale("en");
  });

  it("pins the leaving card slot to its in-flow box before it goes absolute", async () => {
    mountHost();
    const gate = showBlockingToast("Confirm me");
    await settle();

    // happy-dom has no layout engine; feed the leave hook the geometry
    // a real browser would read from the laid-out stack column.
    const slot = document.querySelector<HTMLElement>(".hk-blocking-toast-slot");
    expect(slot).not.toBeNull();
    const wrapper = slot!.parentElement as HTMLElement;
    Object.defineProperty(wrapper, "clientWidth", { value: 384, configurable: true });
    Object.defineProperty(slot!, "offsetParent", { value: wrapper, configurable: true });
    Object.defineProperty(slot!, "offsetTop", { value: 0, configurable: true });
    Object.defineProperty(slot!, "offsetLeft", { value: 0, configurable: true });
    Object.defineProperty(slot!, "offsetWidth", { value: 384, configurable: true });
    Object.defineProperty(slot!, "offsetHeight", { value: 120, configurable: true });

    actionButtons(cards()[0])[0].click();
    await nextTick();

    const leaving = document.querySelector<HTMLElement>(".hk-blocking-toast-leave-active");
    expect(leaving).not.toBeNull();
    expect(leaving!.style.right).toBe("0px");
    expect(leaving!.style.top).toBe("0px");
    expect(leaving!.style.width).toBe("384px");
    expect(leaving!.style.height).toBe("120px");
    expect(leaving!.style.boxSizing).toBe("border-box");

    await expect(gate).resolves.toBe(false);
    await settle();
    expect(cards().length).toBe(0);
  });
});
