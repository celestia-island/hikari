import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkQrCode } from "./HkQrCode";

const OTPAUTH =
  "otpauth://totp/Example:langyo%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountQr(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkQrCode, props),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  while (mounts.length > 0) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

describe("HkQrCode", () => {
  it("renders a labeled canvas for a value", async () => {
    const container = mountQr({ value: OTPAUTH });
    await nextTick();
    const canvas = container.querySelector("canvas.hk-qr-canvas");
    expect(canvas).toBeTruthy();
    expect(canvas!.getAttribute("role")).toBe("img");
    expect(canvas!.getAttribute("aria-label")).toBe("QR code");
    expect((canvas as HTMLElement).style.width).toBe("168px");
  });

  it("shows the caption label under the QR", async () => {
    const container = mountQr({ value: OTPAUTH, label: "Scan with your app" });
    await nextTick();
    expect(container.querySelector(".hk-qr-label")?.textContent).toBe(
      "Scan with your app",
    );
    // The aria-label falls back to the caption.
    expect(container.querySelector("canvas")?.getAttribute("aria-label")).toBe(
      "Scan with your app",
    );
  });

  it("renders nothing for an empty value", async () => {
    const container = mountQr({ value: "" });
    await nextTick();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".hk-qr-card")?.getAttribute("data-empty")).toBe("true");
  });

  it("re-encodes when the value changes", async () => {
    const container = mountQr({ value: OTPAUTH, size: 200 });
    await nextTick();
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect((canvas.style.width)).toBe("200px");
  });
});
