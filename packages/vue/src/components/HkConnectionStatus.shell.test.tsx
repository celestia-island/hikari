import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import { HkConnectionStatus } from "./HkConnectionStatus";

/** The shell contract: WITHOUT injections the component never touches
 * the network — the fetch-poll was demoted with the chat kit (the M1
 * mutation guard: a fetch in the fallback path must go red here). */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkConnectionStatus (shell)", () => {
  it("renders an inert unknown state with zero network calls", () => {
    const fetchSpy = vi.fn();
    const holder = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const app = createApp({ render: () => h(HkConnectionStatus, { standalone: true }) });
      app.mount(container);
      mounts.push({ app, container });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(container.textContent ?? "").not.toBeNull();
    } finally {
      globalThis.fetch = holder;
    }
  });
});
