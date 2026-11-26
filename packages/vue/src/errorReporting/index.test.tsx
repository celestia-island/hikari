import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import {
  clearGlobalError,
  createErrorReporting,
  reportGlobalError,
  resetErrorReportingForTests,
  serializeServerErrorLanding,
  SERVER_ERROR_LANDING_ID,
  type HkErrorReportingOptions,
  type HkServerErrorLanding,
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
  it("renders the toast band IN PLACE inside the takeover (not teleported)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app, container } = mountThrowingApp();
    await nextTick();

    const host = overlayHost();
    expect(host).not.toBeNull();
    // The takeover is a full-screen shell ABOVE the family overlay root —
    // a teleported band would paint under the landing's opaque backdrop
    // and the landing's copy click would be invisible. The viewport must
    // ride INSIDE the takeover (HToast teleport={false}).
    const inPlace = host!.querySelector(".hk-error-reporting-overlay .hk-toast-container");
    expect(inPlace).not.toBeNull();
    const teleported = document.getElementById("hk-overlay-root")?.querySelector(".hk-toast-container");
    expect(teleported).toBeNull();

    app.unmount();
    container.remove();
  });

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
    // The built-in copy action seats first, left of Home / Retry.
    expect(labels[0]).toBe("Copy error details");
    expect(labels).toContain("Back to home");
    expect(labels).toContain("Retry");

    clearGlobalError();

    installPlugin({ homeHref: false });
    reportGlobalError(new Error("boom"));
    await nextTick();
    const labels2 = Array.from(overlayHost()!.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels2).not.toContain("Back to home");
    expect(labels2).toContain("Copy error details");
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

  it("stays up for cross-origin-masked window errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Earlier tests in this file spy the same methods without restoring;
    // clear the accumulated calls so the assertions see only this test's.
    warn.mockClear();
    error.mockClear();
    installPlugin();

    // The masking signature: details withheld (error == null) because the
    // thrower is foreign-origin code (extension / userscript), message
    // pinned to "Script error." by every Chromium/Gecko/WebKit build.
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error.", error: null }));
    await nextTick();
    expect(overlayHost()).toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    // The bare-spelling variant is masked the same way.
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error", error: null }));
    await nextTick();
    expect(overlayHost()).toBeNull();

    clearGlobalError();
    warn.mockRestore();
    error.mockRestore();
  });

  it("still reports detail-less window errors that are not masked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin();

    // error == null with a real message is a script error the browser DID
    // describe — that stays reportable.
    window.dispatchEvent(
      new ErrorEvent("error", { message: "Uncaught SyntaxError: unexpected token", error: null }),
    );
    await nextTick();
    expect(overlayHost()!.querySelector(".hk-error-landing__desc")!.textContent)
      .toBe("Uncaught SyntaxError: unexpected token");
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

  it("renders the host landing card instead of the built-in one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin({
      landing: (err) =>
        h("div", { class: "host-card", "data-code": err.name }, [
          h("p", { class: "host-card__msg" }, err.message),
          h(
            "button",
            { class: "host-card__dismiss", onClick: () => clearGlobalError() },
            "Dismiss",
          ),
        ]),
    });
    reportGlobalError(new TypeError("host boom"));
    await nextTick();

    const host = overlayHost();
    expect(host).not.toBeNull();
    // The built-in card is fully replaced by the host's.
    expect(host!.querySelector(".hk-error-landing")).toBeNull();
    expect(host!.querySelector(".host-card")).not.toBeNull();
    expect(host!.querySelector(".host-card")!.getAttribute("data-code")).toBe("TypeError");
    expect(host!.querySelector(".host-card__msg")!.textContent).toBe("host boom");
    // The host owns the actions: the built-in Home/Retry pair is gone.
    expect(host!.textContent).not.toContain("Back to home");
    expect(host!.textContent).not.toContain("Retry");
    // The takeover shell stays (fixed, alert-dialog semantics).
    expect(host!.querySelector(".hk-error-reporting-overlay")!.getAttribute("role")).toBe(
      "alertdialog",
    );
    // The host card rides INSIDE the takeover shell (same fixed z-band), not
    // beside it: a sibling placement would float outside --hk-z-error. The
    // quadrant of these assertions that pins "same shell" is the ancestor
    // relationship — descendants of the shell, not just of the data node.
    expect(host!.querySelector(".hk-error-reporting-overlay .host-card")).not.toBeNull();
    // The host's own dismissal tears the takeover down.
    (host!.querySelector(".host-card__dismiss") as HTMLButtonElement).click();
    await nextTick();
    expect(overlayHost()).toBeNull();
  });

  it("lets landing step over title/describe and the built-in actions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin({
      title: "ignored headline",
      describe: () => "ignored description",
      homeHref: "/should-not-be-used",
      onHome: vi.fn(),
      onRetry: vi.fn(),
      landing: (err) =>
        h("div", { class: "host-card", "data-msg": err.message }, [
          h("p", { class: "host-card__msg" }, err.message),
        ]),
    });
    reportGlobalError(new TypeError("own content"));
    await nextTick();

    const host = overlayHost()!;
    // The host's card won outright; the built-in card (and its translated
    // headline / description) never mounted.
    expect(host.querySelector(".hk-error-landing")).toBeNull();
    expect(host.querySelector(".host-card__msg")!.textContent).toBe("own content");
    expect(host.textContent).not.toContain("ignored headline");
    expect(host.textContent).not.toContain("ignored description");
    expect(host.textContent).not.toContain("Back to home");
    expect(host.textContent).not.toContain("Retry");
    // The host card still receives the raw accepted record, not a
    // title/describe-shaped one — the overrides never leak in.
    expect(host.querySelector(".host-card")!.getAttribute("data-msg")).toBe("own content");
  });
});

describe("server error landing handoff", () => {
  const OAUTH_502: HkServerErrorLanding = {
    status: 502,
    code: "identity_provider_unreachable",
    message: "identity provider unreachable: identity provider answered 400 Bad Request",
    raw: { error: "identity provider unreachable: identity provider answered 400 Bad Request" },
  };

  /** Plant the island exactly as a family server injects it into index.html. */
  function plant(landing: HkServerErrorLanding | string): void {
    const island = document.createElement("script");
    island.id = SERVER_ERROR_LANDING_ID;
    island.type = "application/json";
    island.textContent = typeof landing === "string" ? landing : serializeServerErrorLanding(landing);
    document.head.appendChild(island);
  }

  function statusChip(): string | null {
    return overlayHost()?.querySelector(".hk-error-landing__status")?.textContent ?? null;
  }

  afterEach(() => {
    document.getElementById(SERVER_ERROR_LANDING_ID)?.remove();
  });

  it("raises the landing at install — before the host tree mounts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    plant(OAUTH_502);
    installPlugin();
    await nextTick();

    const host = overlayHost();
    expect(host).not.toBeNull();
    // The wire facts, as chips and copy: the status the server ANSWERED
    // with, the wire code, the server's own explanation.
    expect(statusChip()).toBe("HTTP 502");
    expect(host!.querySelector(".hk-error-landing__code")!.textContent).toBe("identity_provider_unreachable");
    expect(host!.querySelector(".hk-error-landing__desc")!.textContent).toBe(OAUTH_502.message);
    // The raw body the browser would otherwise have shown as bare JSON is
    // now inside the details pane.
    expect(host!.querySelector(".s-tool-json-tree")).not.toBeNull();
    expect(host!.querySelector(".s-tool-json-tree")!.textContent).toContain("response");
    // The visitor still has the way back and the retry.
    const labels = Array.from(host!.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Back to home");
    expect(labels).toContain("Retry");
    // Reported through the ordinary channel, under its own source.
    expect(error).toHaveBeenCalledWith("[hikari:error-reporting:server]", expect.any(Error));
  });

  it("consumes the island: it is gone after install and a reinstall cannot re-raise it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    plant(OAUTH_502);
    installPlugin();
    await nextTick();
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();

    clearGlobalError();
    expect(overlayHost()).toBeNull();
    installPlugin();
    await nextTick();
    // The visitor dismissed it; a second install on the same document is
    // not a new server answer.
    expect(overlayHost()).toBeNull();
  });

  it("falls back to an http_<status> code chip when the server sent no code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    plant({ status: 404, code: "", message: "route not found" });
    installPlugin();
    await nextTick();
    const host = overlayHost()!;
    expect(statusChip()).toBe("HTTP 404");
    expect(host.querySelector(".hk-error-landing__code")!.textContent).toBe("http_404");
    expect(host.querySelector(".hk-error-landing__desc")!.textContent).toBe("route not found");
    // No body came back, so there is no `response` — and what the server
    // answered is the WHOLE record: the only stack a handoff has names the
    // install call that raised it, which tells the visitor nothing.
    expect(host.querySelector('[aria-label="server error details"]')).not.toBeNull();
    const tree = host.querySelector(".s-tool-json-tree")!.textContent!;
    expect(tree).toContain("route not found");
    expect(tree).not.toContain("stack");
    expect(tree).not.toContain("    at ");
  });

  it("paints a 4xx as a warning and a 5xx as an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    plant({ status: 410, code: "share_gone", message: "This link was revoked." });
    installPlugin();
    await nextTick();
    expect(overlayHost()!.querySelector(".hk-error-landing")!.className).toContain("is-warning");

    clearGlobalError();
    plant({ status: 503, code: "starting", message: "Starting up." });
    installPlugin();
    await nextTick();
    expect(overlayHost()!.querySelector(".hk-error-landing")!.className).toContain("is-error");
  });

  it("ignores a malformed island — nothing is raised", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Negative control: the same install with the same document, minus a
    // usable payload. A filter that "always raises" would fail here.
    plant("{not json");
    installPlugin();
    expect(overlayHost()).toBeNull();
    // A status outside the error classes is not a handoff either.
    plant({ status: 302, code: "", message: "should be followed, not shown" });
    installPlugin();
    expect(overlayHost()).toBeNull();
  });

  it("lets shouldReport drop a handoff like any other source", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    plant(OAUTH_502);
    installPlugin({ shouldReport: (_err, source) => source !== "server" });
    // Consumed even though filtered: the document still carried it.
    expect(document.getElementById(SERVER_ERROR_LANDING_ID)).toBeNull();
    expect(overlayHost()).toBeNull();
  });

  it("hands status and details to a host landing card", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    plant(OAUTH_502);
    installPlugin({
      landing: (err) => h("div", { class: "host-card", "data-status": err.status ?? "none" }, [
        h("span", { class: "host-card__raw" }, JSON.stringify(err.details)),
      ]),
    });
    await nextTick();
    // A host that owns its card (chest-style) reads the same two fields
    // the built-in card paints — the handoff is not a built-in-only path.
    expect(overlayHost()!.querySelector(".host-card")!.getAttribute("data-status")).toBe("502");
    expect(overlayHost()!.querySelector(".host-card__raw")!.textContent).toBe(JSON.stringify(OAUTH_502.raw));
    expect(overlayHost()!.querySelector(".hk-error-landing")).toBeNull();
  });

  it("carries the status line and the raw body on the copy action", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    plant(OAUTH_502);
    installPlugin();
    await nextTick();

    const copy = Array.from(overlayHost()!.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent === "Copy error details")!;
    copy.click();
    await nextTick();
    await nextTick();

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]![0];
    // The headline, then exactly the body the server sent — nothing else:
    // no JS stack, no `source:` footer from the runtime record.
    expect(text).toBe(
      "HTTP 502 identity_provider_unreachable: " + OAUTH_502.message + "\n\n" + JSON.stringify(OAUTH_502.raw, null, 2),
    );
  });

  it("shows no status chip for runtime errors — the handoff fields are opt-in", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin();
    reportGlobalError(new TypeError("plain runtime error"));
    await nextTick();
    expect(statusChip()).toBeNull();
    expect(overlayHost()!.querySelector(".hk-error-landing")!.className).not.toContain("is-warning");
    expect(overlayHost()!.querySelector('[aria-label="stack trace"]')).not.toBeNull();
  });

  it("leaves a runtime error alone even when it happens to carry status/details fields", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installPlugin();
    // The shape of an HTTP client's error object (and of validation
    // libraries' `details`): those fields belong to the host, not to the
    // handoff — the runtime card must not start painting them.
    const clientError = Object.assign(new TypeError("Request failed with status code 404"), {
      status: 404,
      details: { field: "email" },
    });
    reportGlobalError(clientError);
    await nextTick();
    expect(statusChip()).toBeNull();
    expect(overlayHost()!.querySelector(".hk-error-landing")!.className).not.toContain("is-warning");
    expect(overlayHost()!.querySelector('[aria-label="stack trace"]')).not.toBeNull();
    expect(overlayHost()!.querySelector(".s-tool-json-tree")!.textContent).not.toContain("response");

    // The same object reported AS a handoff is the host's explicit choice.
    clearGlobalError();
    reportGlobalError(clientError, "server");
    await nextTick();
    expect(statusChip()).toBe("HTTP 404");
    expect(overlayHost()!.querySelector(".s-tool-json-tree")!.textContent).toContain("response");
  });
});
