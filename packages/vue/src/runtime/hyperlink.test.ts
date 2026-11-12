import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyHyperlink,
  openExternalHyperlink,
  openHyperlink,
  provideHyperlinkCoordinator,
} from "./hyperlink";

/**
 * The hyperlink coordination context: one classify → resolve → open path
 * for every link activation in the library and its hosts. The pins below
 * carry the two failure modes the module exists for (a markdown anchor
 * navigating the webview onto the app origin; the 404 the chest login
 * window showed) plus the wiring contract each bridge must keep.
 */

afterEach(() => {
  provideHyperlinkCoordinator(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("classifyHyperlink", () => {
  it("splits the scheme vocabulary the openers care about", () => {
    expect(classifyHyperlink("https://docs.celestia.world/meta/cla.html")).toBe("external");
    expect(classifyHyperlink("http://127.0.0.1:8080/x")).toBe("external");
    expect(classifyHyperlink("HTTPS://EXAMPLE.COM")).toBe("external");
    expect(classifyHyperlink("mailto:security@celestia.world")).toBe("mailto");
    expect(classifyHyperlink("tel:+8610000000000")).toBe("tel");
    expect(classifyHyperlink("cla.md")).toBe("internal");
    expect(classifyHyperlink("/backend#dashboard")).toBe("internal");
    expect(classifyHyperlink("#section")).toBe("internal");
    expect(classifyHyperlink("")).toBe("internal");
    expect(classifyHyperlink("ftp://example.com/pub")).toBe("other");
    expect(classifyHyperlink("vscode://file/x")).toBe("other");
  });
});

describe("openHyperlink on the web face", () => {
  it("opens external URLs in a hardened new tab", async () => {
    const open = vi.fn(() => ({ opener: {} }));
    vi.stubGlobal("open", open);

    const opened = await openHyperlink("https://docs.celestia.world/meta/cla.html");

    expect(opened).toBe("https://docs.celestia.world/meta/cla.html");
    expect(open).toHaveBeenCalledWith(
      "https://docs.celestia.world/meta/cla.html",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("hands mail and custom schemes to the OS handler in place", async () => {
    const open = vi.fn();
    const writes: string[] = [];
    vi.stubGlobal("open", open);
    // happy-dom lets location.href assignments through; capture instead.
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: new Proxy(original, {
        set(_t, prop, value) {
          if (prop === "href") writes.push(String(value));
          return true;
        },
      }),
    });
    try {
      expect(await openHyperlink("mailto:security@celestia.world")).toBe(
        "mailto:security@celestia.world",
      );
      expect(writes).toEqual(["mailto:security@celestia.world"]);
      expect(open).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it("resolves an internal relative link against the document base and still opens a tab", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);

    const opened = await openHyperlink("cla.md", { linkContext: "unvendored" });

    expect(opened).toBe(new URL("cla.md", document.baseURI).href);
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe("openHyperlink on the native shell", () => {
  function stubInternals(invoke: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke, metadata: { currentWindow: { label: "main" } } });
  }

  it("rides the tauri-plugin-opener IPC and never touches window.open", async () => {
    const invoke = vi.fn(() => Promise.resolve());
    stubInternals(invoke);
    const open = vi.fn();
    vi.stubGlobal("open", open);

    const opened = await openHyperlink("https://docs.celestia.world/meta/cla.html");

    expect(opened).toBe("https://docs.celestia.world/meta/cla.html");
    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", {
      url: "https://docs.celestia.world/meta/cla.html",
      with: null,
    });
    expect(open).not.toHaveBeenCalled();
  });

  it("prefers the documented opener global when the shell injects it", async () => {
    const openUrl = vi.fn(() => Promise.resolve());
    vi.stubGlobal("__TAURI__", { opener: { openUrl } });
    const invoke = vi.fn(() => Promise.resolve());
    stubInternals(invoke);

    await openHyperlink("https://example.com");

    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("falls down the bridge chain when a bridge refuses", async () => {
    const openUrl = vi.fn(() => Promise.reject(new Error("forbidden")));
    vi.stubGlobal("__TAURI__", { opener: { openUrl } });
    const invoke = vi.fn(() => Promise.resolve());
    stubInternals(invoke);

    expect(await openHyperlink("https://example.com")).toBe("https://example.com");
    expect(invoke).toHaveBeenCalled();
  });

  it("lands on window.open when no bridge answers", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);

    expect(await openHyperlink("https://example.com")).toBe("https://example.com");
    expect(open).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
  });

  it("swallows an internal link instead of navigating the webview (the 404 report)", async () => {
    const invoke = vi.fn(() => Promise.resolve());
    stubInternals(invoke);
    const open = vi.fn();
    vi.stubGlobal("open", open);

    expect(await openHyperlink("cla.md")).toBeNull();
    expect(await openHyperlink("/backend#dashboard")).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("refuses to hand the app's own origin to the system browser", async () => {
    const invoke = vi.fn(() => Promise.resolve());
    stubInternals(invoke);

    const sameOrigin = new URL("/api/asset.png", window.location.href).href;
    expect(await openHyperlink(sameOrigin)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("the host coordinator halves", () => {
  it("lets resolve canonicalize a link before the default opener runs", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);
    provideHyperlinkCoordinator({
      resolve: (info) => {
        if (info.linkContext !== "protocol") return info.href;
        return new URL(info.href.replace(/\.md$/, ".html"), "https://docs.celestia.world/meta/").href;
      },
    });

    const opened = await openHyperlink("cla.md", {
      source: "markdown",
      linkContext: "protocol",
    });

    expect(opened).toBe("https://docs.celestia.world/meta/cla.html");
    expect(open).toHaveBeenCalledWith(
      "https://docs.celestia.world/meta/cla.html",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("swallows the activation when resolve returns null", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);
    provideHyperlinkCoordinator({ resolve: () => null });

    expect(await openHyperlink("https://example.com")).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it("hands the host opener the resolved URL and the full info", async () => {
    const open = vi.fn(() => Promise.resolve());
    provideHyperlinkCoordinator({ open });
    const invoke = vi.fn(() => Promise.resolve());
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });

    const opened = await openHyperlink("https://example.com/x", { source: "markdown" });

    expect(opened).toBe("https://example.com/x");
    expect(open).toHaveBeenCalledWith(
      "https://example.com/x",
      expect.objectContaining({ href: "https://example.com/x", kind: "external", source: "markdown" }),
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("reports the refusal when the host opener fails", async () => {
    provideHyperlinkCoordinator({ open: () => Promise.reject(new Error("no shell")) });

    expect(await openHyperlink("https://example.com")).toBeNull();
  });
});

describe("openExternalHyperlink floor", () => {
  it("returns false when the shell has no bridge at all and popups are blocked", async () => {
    vi.stubGlobal("open", vi.fn(() => null));
    expect(await openExternalHyperlink("https://example.com")).toBe(false);
  });
});
