import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkEmergencyAlert from "./HkEmergencyAlert";
import {
  clearEmergencyAlert,
  raiseEmergencyAlert,
  resetEmergencyAlerts,
} from "../runtime/useEmergencyAlert";

/**
 * HkEmergencyAlert contract tests:
 * - nothing renders with no active alerts
 * - raise renders the takeover band (role=alert, severity class, tone
 *   badge, kicker default, host actions + built-in snooze)
 * - dismissible=false drops the snooze button (red alerts stay)
 * - snooze hides the band until the episode clears
 * - multiple alerts: only the most severe takes the band, the rest
 *   count in the "+N more" line; clearing the winner promotes the next
 * - Esc snoozes when the focus is inside the band
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountHost() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkEmergencyAlert) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function layer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-emergency");
}

function buttons(): HTMLButtonElement[] {
  return Array.from(layer()?.querySelectorAll<HTMLButtonElement>(".hk-emergency-actions button") ?? []);
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  resetEmergencyAlerts();
});

describe("HkEmergencyAlert rendering", () => {
  it("renders nothing while no alert is active", async () => {
    mountHost();
    await settle();
    expect(layer()).toBeNull();
  });

  it("renders the takeover band with severity, title, badge and kicker", async () => {
    mountHost();
    raiseEmergencyAlert({
      id: "platform-link",
      severity: "danger",
      title: "警告：所有平台连接已断开",
      description: "没有任何边缘或计算平台在线",
      code: "ALL_PLATFORMS_DOWN",
      kicker: "PLATFORM LINK LOST",
      dismissible: false,
    });
    await settle();
    const el = layer();
    expect(el).not.toBeNull();
    expect(el!.getAttribute("role")).toBe("alert");
    expect(el!.classList.contains("is-danger")).toBe(true);
    expect(el!.textContent).toContain("警告：所有平台连接已断开");
    expect(el!.textContent).toContain("没有任何边缘或计算平台在线");
    expect(el!.textContent).toContain("ALL_PLATFORMS_DOWN");
    expect(el!.textContent).toContain("PLATFORM LINK LOST");
    // Non-dismissible: no built-in snooze button.
    expect(buttons().some((b) => b.textContent === "Hide for now")).toBe(false);
  });

  it("falls back to the per-severity kicker word when none is given", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t" });
    await settle();
    expect(layer()!.textContent).toContain("WARNING");
  });

  it("clearing the alert removes the band", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t" });
    await settle();
    expect(layer()).not.toBeNull();
    clearEmergencyAlert("q");
    await settle();
    expect(layer()).toBeNull();
  });
});

describe("actions & snooze", () => {
  it("renders host actions plus the built-in snooze and wires their handlers", async () => {
    mountHost();
    const handle = vi.fn();
    const onSnooze = vi.fn();
    raiseEmergencyAlert({
      id: "quota",
      severity: "warning",
      title: "额度耗尽",
      actions: [{ label: "立即处理", onClick: handle }],
      onSnooze,
    });
    await settle();
    const [primary, snooze] = buttons();
    expect(primary.textContent).toBe("立即处理");
    expect(snooze.textContent).toBe("Hide for now");

    primary.click();
    expect(handle).toHaveBeenCalledTimes(1);
    // The action does NOT dismiss the band — only the condition
    // clearing (or a snooze) does; "handle now" navigates away but the
    // emergency stands until resolved.
    expect(layer()).not.toBeNull();

    snooze.click();
    await settle();
    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(layer()).toBeNull();
    // Snoozed, not cleared: the context still holds the alert.
    expect(document.querySelector(".hk-emergency")).toBeNull();
  });

  it("Esc snoozes a dismissible band while the focus is inside it", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t" });
    await settle();
    const el = layer()!;
    // Focus is moved onto the band's primary action on raise — the Esc
    // path below only acts while the band owns the focus.
    expect(el.contains(document.activeElement)).toBe(true);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(layer()).toBeNull();
  });

  it("Esc does nothing on a non-dismissible band", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "danger", title: "t", dismissible: false });
    await settle();
    layer()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(layer()).not.toBeNull();
  });
});

describe("focus choreography", () => {
  it("raise then clear returns the focus to the element that held it", async () => {
    const outside = document.createElement("button");
    outside.textContent = "work";
    document.body.appendChild(outside);
    outside.focus();
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t" });
    await settle();
    // The band took the focus on raise…
    expect(layer()!.contains(document.activeElement)).toBe(true);
    clearEmergencyAlert("q");
    await settle();
    // …and gave it back on clear (first-raise capture works even though
    // the layer was not yet in the DOM during the pre-flush watch).
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("focus lands on the primary action when the alert pre-dates the host mount", async () => {
    raiseEmergencyAlert({
      id: "pre",
      severity: "danger",
      title: "t",
      dismissible: false,
      actions: [{ label: "Go" }],
    });
    mountHost();
    await settle();
    const primary = layer()!.querySelector<HTMLButtonElement>(".hk-emergency-actions button");
    expect(primary?.textContent).toBe("Go");
    expect(document.activeElement).toBe(primary);
  });

  it("clearing never steals the focus back from work below", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t" });
    await settle();
    // The user moves into the page below while the alert stands (the
    // page stays focusable by design)…
    input.focus();
    clearEmergencyAlert("q");
    await settle();
    // …and the clear must leave that focus alone.
    expect(document.activeElement).toBe(input);
    input.remove();
  });
});

describe("single-band policy", () => {
  it("the most severe alert takes the band and counts the suppressed", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度耗尽" });
    raiseEmergencyAlert({ id: "link", severity: "danger", title: "全平台失联" });
    await settle();
    const el = layer()!;
    expect(el.classList.contains("is-danger")).toBe(true);
    expect(el.textContent).toContain("全平台失联");
    expect(el.textContent).toContain("+1");
    expect(el.textContent).toContain("more alert(s) pending");

    // Clearing the winner promotes the suppressed warning.
    clearEmergencyAlert("link");
    await settle();
    const promoted = layer()!;
    expect(promoted.classList.contains("is-warning")).toBe(true);
    expect(promoted.textContent).toContain("额度耗尽");
    expect(promoted.textContent).not.toContain("+1");
  });

  it("a snoozed alert neither takes the band nor counts as suppressed", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "a", severity: "warning", title: "a" });
    raiseEmergencyAlert({ id: "b", severity: "danger", title: "b" });
    await settle();
    // Snooze the winner through the context; only "a" remains visible.
    const snooze = buttons().find((b) => b.textContent === "Hide for now")!;
    snooze.click();
    await settle();
    const el = layer()!;
    expect(el.textContent).toContain("a");
    expect(el.textContent).not.toContain("+1");
  });
});
