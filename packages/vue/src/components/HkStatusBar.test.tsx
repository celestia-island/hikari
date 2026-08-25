import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkStatusBar } from "./HkStatusBar";
import type { HkConnectionInfo } from "./HkConnectionInfo";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBar(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkStatusBar, props) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

const INFO: HkConnectionInfo = {
  state: "connected",
  tier: "poll",
  quality: "good",
  latencyMs: 42,
  isLocalhost: false,
  region: "US",
  retryCount: 0,
  maxRetries: 3,
  asn: null,
  attemptNumber: 1,
  countdown: 0,
};

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("HkStatusBar", () => {
  it("mounts with the traffic light and version rows inline, protocol row on hover-open", async () => {
    const container = mountBar({
      version: "1.2.3",
      engineVersion: "9.8.7",
      connectionStatus: "connected",
      connectionInfo: INFO,
      transportTier: "poll",
    });
    await nextTick();

    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    expect(tag, "status tag renders").toBeTruthy();
    expect(container.querySelector(".s-status-bar-dot"), "traffic-light dot renders").toBeTruthy();
    // Full mode: the panel/engine version rows ride inline in the tag.
    expect(container.querySelectorAll(".s-status-bar-version").length).toBe(2);
    expect(tag.textContent).toContain("1.2.3");
    expect(tag.textContent).toContain("9.8.7");
    expect(tag.hasAttribute("data-compact")).toBe(false);

    // Hover the tag open: the protocol row lives in the popover content,
    // teleported to <body> inside the HPopover panel.
    tag.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    const panel = document.body.querySelector<HTMLElement>(".hk-popover-panel");
    expect(panel, "popover opens on hover").toBeTruthy();
    expect(panel!.textContent).toContain("Protocol");
    expect(panel!.textContent).toContain("HTTP poll");
  });

  it("compact mode collapses the tag to the bare dot with no inline status text", async () => {
    const container = mountBar({
      version: "1.2.3",
      engineVersion: "9.8.7",
      connectionStatus: "connected",
      connectionInfo: INFO,
      compact: true,
    });
    await nextTick();

    const tag = container.querySelector<HTMLElement>(".s-status-bar-tag")!;
    expect(tag.getAttribute("data-compact")).toBe("true");
    // Standing user directive: mobile shows ONLY the traffic light — no
    // translated connection state ("Connected"/"已连接"/…) renders next to
    // the dot in compact mode. The state rides the aria-label, and the
    // full status stays reachable through the tap popover.
    const inlineLabel = tag.querySelector<HTMLElement>(".s-status-bar-tag-label");
    // The only tag-label left in the tag is the CSS-hidden "Panel" row of
    // the version block — its text must NOT be a connection state.
    expect(inlineLabel?.textContent).not.toMatch(/connected|connecting|disconnected/i);
    // The dot itself renders.
    expect(tag.querySelector(".s-status-bar-dot"), "traffic-light dot renders").toBeTruthy();
    // The version rows leave the visible pill: they are hidden inline by
    // the [data-compact] CSS (styles/admin-tokens.scss) and the versions
    // ride the aria-label for assistive tech instead.
    expect(tag.getAttribute("aria-label")).toBe("Connected · 1.2.3 · 9.8.7");
  });
});
