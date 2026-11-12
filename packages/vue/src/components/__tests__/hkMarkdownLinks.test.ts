import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkMarkdownRenderer from "../HkMarkdownRenderer";
import { provideHyperlinkCoordinator } from "../../runtime/hyperlink";

/**
 * The markdown link activation contract (runtime/hyperlink.ts): every
 * anchor a rendered body carries activates through the coordinator — the
 * web face opens a hardened new tab, the native shell hands the URL to
 * the opener bridge — and the anchor's default is ALWAYS taken over, so
 * the webview itself never navigates (the 2026-11-12 protocol-modal 404:
 * the chest login window followed a vendored relative href onto the app
 * origin). The linkContext prop rides the activation for host resolvers.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

async function mountMarkdown(content: string, linkContext?: string): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkMarkdownRenderer, {
          content,
          ...(linkContext !== undefined ? { linkContext } : {}),
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  // The renderer lazy-imports marked + DOMPurify on the first non-plain
  // parse — POLL for the rendered body (the chest suites learned this
  // the same way: a fixed settle races the module transform).
  for (let i = 0; i < 100; i += 1) {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (document.body.querySelector(".hk-markdown-body a[href]")) return;
  }
  throw new Error(
    "markdown body never rendered an anchor; body HTML: " +
      (document.body.querySelector(".hk-markdown-body")?.innerHTML ?? "(no body)") +
      " / rendered: " +
      (document.body.querySelector(".hk-markdown")?.outerHTML.slice(0, 300) ?? "(none)"),
  );
}

function bodyAnchor(href: string): HTMLAnchorElement {
  const anchor = document.body.querySelector<HTMLAnchorElement>(
    '.hk-markdown-body a[href="' + href + '"]',
  );
  expect(anchor, 'anchor "' + href + '" renders').toBeTruthy();
  return anchor!;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  provideHyperlinkCoordinator(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("markdown link activation", () => {
  it("opens an external anchor in a hardened new tab on the web face", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);

    await mountMarkdown("[CLA](https://docs.celestia.world/meta/cla.html)");
    const anchor = bodyAnchor("https://docs.celestia.world/meta/cla.html");
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(open).toHaveBeenCalledWith(
      "https://docs.celestia.world/meta/cla.html",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("never lets the anchor default through (the webview must not navigate)", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);

    const locationBefore = window.location.href;
    await mountMarkdown("[guide](cla.md)", "protocol");
    const anchor = bodyAnchor("cla.md");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The DEFAULT is taken over (the webview never follows the href); the
    // web face instead opens the resolved tab — the open() call IS the
    // designed routing here, the assertion is that no navigation happened.
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.href).toBe(locationBefore);
    expect(open).toHaveBeenCalledTimes(1);
    const firstCall = open.mock.calls[0] as unknown as [string] | undefined;
    expect(firstCall?.[0]).toBe(new URL("cla.md", document.baseURI).href);
  });

  it("carries the linkContext so the host resolver can canonicalize", async () => {
    const open = vi.fn(() => ({}));
    vi.stubGlobal("open", open);
    const seen: Array<{ href: string; linkContext?: string; source: string }> = [];
    provideHyperlinkCoordinator({
      resolve: (info) => {
        seen.push({ href: info.href, linkContext: info.linkContext, source: info.source });
        return null; // swallow — this pin only observes the handoff
      },
    });

    await mountMarkdown("[CLA](cla.md)", "protocol");
    bodyAnchor("cla.md").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(seen).toEqual([
      { href: "cla.md", linkContext: "protocol", source: "markdown" },
    ]);
    expect(open).not.toHaveBeenCalled();
  });

  it("activates through the opener IPC on the native shell", async () => {
    const invoke = vi.fn(() => Promise.resolve());
    vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    await mountMarkdown("[site](https://example.com)");
    bodyAnchor("https://example.com").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(invoke).toHaveBeenCalledWith("plugin:opener|open_url", {
      url: "https://example.com",
      with: null,
    });
    expect(open).not.toHaveBeenCalled();
  });
});
