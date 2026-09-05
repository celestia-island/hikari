import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import {
  clearGlobalError,
  createErrorReporting,
  reportGlobalError,
  resetErrorReportingForTests,
  type HkErrorReportingOptions,
} from "./index";

const Boom = defineComponent({
  name: "Boom",
  setup() {
    throw new TypeError("Cannot read properties of undefined (reading 'length')");
  },
  render: () => h("div", "never"),
});

function installPlugin(options?: HkErrorReportingOptions) {
  // A throwaway app: the plugin's window hooks and module state outlive it,
  // exactly like the real host app installing it at bootstrap.
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => null });
  app.use(createErrorReporting(options));
  app.mount(container);
  app.unmount();
  container.remove();
}

function mountThrowingApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(Boom);
  app.use(createErrorReporting());
  app.mount(container);
  return { app, container };
}

function overlayHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-hikari-error-reporting]");
}

afterEach(() => {
  resetErrorReportingForTests();
  document.querySelectorAll("[data-hikari-error-reporting]").forEach((el) => el.remove());
});

describe("createErrorReporting", () => {
  it("shows the unified error landing for uncaught render errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app, container } = mountThrowingApp();
    await nextTick();

    const host = overlayHost();
    expect(host).not.toBeNull();
    expect(host!.querySelector(".hk-error-landing")).not.toBeNull();
    expect(host!.querySelector(".hk-error-landing__code")!.textContent).toBe("TypeError");
    expect(host!.querySelector(".hk-error-landing__desc")!.textContent)
      .toBe("Cannot read properties of undefined (reading 'length')");
    // Raw details ride in the JSON tree.
    expect(host!.querySelector(".s-tool-json-tree")).not.toBeNull();

    app.unmount();
    container.remove();
  });

  it("renders Home and Retry actions and hides Home when disabled", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin();
    reportGlobalError(new Error("boom"));
    await nextTick();

    const host = overlayHost()!;
    const labels = Array.from(host.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Back to home");
    expect(labels).toContain("Retry");

    clearGlobalError();

    installPlugin({ homeHref: false });
    reportGlobalError(new Error("boom"));
    await nextTick();
    const labels2 = Array.from(overlayHost()!.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels2).not.toContain("Back to home");
    expect(labels2).toContain("Retry");
  });

  it("takes over for unhandled window errors and rejections", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin();

    window.dispatchEvent(new ErrorEvent("error", { error: new RangeError("out of range") }));
    await nextTick();
    expect(overlayHost()!.querySelector(".hk-error-landing__code")!.textContent).toBe("RangeError");

    clearGlobalError();

    // happy-dom has no PromiseRejectionEvent constructor; a plain event with
    // a `reason` property exercises the same listener path.
    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", { value: new Error("async boom") });
    window.dispatchEvent(rejection);
    await nextTick();
    expect(overlayHost()!.querySelector(".hk-error-landing__desc")!.textContent).toBe("async boom");
  });

  it("keeps the first error and still fires onError for later ones", () => {
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin({ onError });

    reportGlobalError(new Error("first"));
    reportGlobalError(new Error("second"));
    expect(overlayHost()!.querySelector(".hk-error-landing__desc")!.textContent).toBe("first");
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("drops errors rejected by shouldReport", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin({ shouldReport: (_err, source) => source === "manual" });

    window.dispatchEvent(new ErrorEvent("error", { error: new Error("filtered away") }));
    expect(overlayHost()).toBeNull();
  });

  it("chains a pre-existing app errorHandler", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const previous = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({ render: () => null });
    app.config.errorHandler = previous;
    app.use(createErrorReporting());
    app.mount(container);
    app.config.errorHandler!(new Error("routed"), null, "setup function");
    expect(previous).toHaveBeenCalledTimes(1);
    expect(overlayHost()).not.toBeNull();
    app.unmount();
    container.remove();
  });

  it("uses custom onRetry instead of reloading", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onRetry = vi.fn();
    installPlugin({ onRetry });
    reportGlobalError(new Error("boom"));
    await nextTick();

    const retry = Array.from(overlayHost()!.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent === "Retry")!;
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("clearGlobalError tears the overlay down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reportGlobalError(new Error("boom"));
    await nextTick();
    expect(overlayHost()).not.toBeNull();
    clearGlobalError();
    expect(overlayHost()).toBeNull();
  });
});
