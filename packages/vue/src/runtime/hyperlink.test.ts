import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyHyperlink,
  isDangerousHref,
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

/**
 * SECURITY (audit PS-18, 2026-11-15): the `other` bucket must keep carrying
 * custom protocols to the OS handler, so the fix is a scheme BLOCKLIST —
 * never an allowlist like `safeHref` enforces for anchors. These pins hold
 * both halves of that: script schemes must never reach a navigation sink,
 * and a legitimate custom scheme must keep flowing.
 */
describe("isDangerousHref", () => {
  it("blocks the script and local-file schemes", () => {
    expect(isDangerousHref("javascript:alert(1)")).toBe(true);
    expect(isDangerousHref("JaVaScRiPt:alert(1)")).toBe(true);
    expect(isDangerousHref("  javascript:alert(1)")).toBe(true);
    expect(isDangerousHref("vbscript:msgbox(1)")).toBe(true);
    expect(isDangerousHref("data:text/html,<script>alert(1)</script>")).toBe(true);
    expect(isDangerousHref("file:///etc/passwd")).toBe(true);
    // A page-minted blob is same-origin HTML: assigning location.href to it
    // runs script here. `filesystem:` is the old Chrome spelling of the same.
    expect(isDangerousHref("blob:https://app.example/uuid-1")).toBe(true);
    expect(isDangerousHref("filesystem:https://app.example/temporary/x")).toBe(true);
  });

  it("sees through the control characters engines skip", () => {
    // Browsers drop tab/LF/CR inside the scheme — `java\tscript:` still runs.
    expect(isDangerousHref("java\tscript:alert(1)")).toBe(true);
    expect(isDangerousHref("java\nscript:alert(1)")).toBe(true);
    expect(isDangerousHref("j\u0000avascript:alert(1)")).toBe(true);
  });

  it("leaves every legitimate navigation form alone", () => {
    expect(isDangerousHref("https://docs.celestia.world/x")).toBe(false);
    expect(isDangerousHref("mailto:security@celestia.world")).toBe(false);
    expect(isDangerousHref("tel:+8610000000000")).toBe(false);
    expect(isDangerousHref("cla.md")).toBe(false);
    expect(isDangerousHref("#section")).toBe(false);
    // The whole point of `other`: custom protocols must keep working.
    expect(isDangerousHref("vscode://file/x")).toBe(false);
    expect(isDangerousHref("zoommtg://zoom.us/join?confno=1")).toBe(false);
    expect(isDangerousHref("ftp://example.com/pub")).toBe(false);
  });
});

describe("openHyperlink refuses script schemes (PS-18)", () => {
  function stubLocation(): string[] {
    const writes: string[] = [];
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
    return writes;
  }

  it("never assigns location.href for a javascript: link", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const writes = stubLocation();
    try {
      expect(await openHyperlink("javascript:alert(1)")).toBeNull();
      expect(writes).toEqual([]);
      expect(open).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("refuses a dangerous URL the RESOLVER minted, not just the href", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const writes = stubLocation();
    provideHyperlinkCoordinator({
      resolve: () => "javascript:alert(1)",
    });
    try {
      expect(await openHyperlink("https://docs.celestia.world/x")).toBeNull();
      expect(writes).toEqual([]);
      expect(open).not.toHaveBeenCalled();
    } finally {
      provideHyperlinkCoordinator(null);
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("guards its own last-resort sink (openExternalHyperlink)", async () => {
    // Publicly exported => a host may call it directly. A guard that lives
    // only in the callers would leave this window.open reachable.
    const open = vi.fn();
    vi.stubGlobal("open", open);
    try {
      expect(await openExternalHyperlink("javascript:alert(1)")).toBe(false);
      expect(open).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("never hands a dangerous URL to a host-provided open", async () => {
    // Pins the guard at the ENTRY, not just the default opener. The inner
    // default-opener guard is a redundant belt (mutation-tested: removing it
    // alone stays green because the entry guard pre-empts it) — it exists for
    // hosts that drive `useHyperlinkCoordinator().open()` directly.
    const seen: string[] = [];
    provideHyperlinkCoordinator({
      open: (url) => {
        seen.push(url);
        return true;
      },
    });
    try {
      expect(await openHyperlink("javascript:alert(1)")).toBeNull();
      expect(seen).toEqual([]);
    } finally {
      provideHyperlinkCoordinator(null);
    }
  });

  it("still hands a custom scheme to the OS handler", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const writes = stubLocation();
    try {
      expect(await openHyperlink("vscode://file/x")).toBe("vscode://file/x");
      expect(writes).toEqual(["vscode://file/x"]);
      expect(open).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
