import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import HkImagePreview from "./HkImagePreview";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

// Plain relative src: happy-dom keeps resource loading inert for these,
// so load/error events are dispatched manually below — fully
// deterministic (data: URIs would fire a real async load event).
const SVG_SRC = "/test-wallpaper.svg";

interface Setup {
  root: () => HTMLElement;
  img: () => HTMLImageElement;
  emitted: Record<string, number>;
}

function mountPreview(props: Record<string, unknown> = {}): Setup {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const emitted: Record<string, number> = {};
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkImagePreview, {
          src: SVG_SRC,
          alt: "wallpaper",
          ...props,
          onOpen: () => { emitted.open = (emitted.open ?? 0) + 1; },
          onError: () => { emitted.error = (emitted.error ?? 0) + 1; },
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  return {
    root: () => {
      const el = container.querySelector<HTMLElement>(".hk-image-preview");
      if (!el) throw new Error("preview root not rendered");
      return el;
    },
    img: () => {
      const img = container.querySelector<HTMLImageElement>(".hk-image-preview-img");
      if (!img) throw new Error("preview img not rendered");
      return img;
    },
    emitted,
  };
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe("HkImagePreview states", () => {
  it("shows the loading shimmer, then the image after the load event", async () => {
    const s = mountPreview();
    expect(s.root().querySelector(".hk-image-preview-loading")).not.toBeNull();
    expect(s.img().classList.contains("is-pending")).toBe(true);

    s.img().dispatchEvent(new Event("load"));
    await nextTick();

    expect(s.root().querySelector(".hk-image-preview-loading")).toBeNull();
    expect(s.img().classList.contains("is-pending")).toBe(false);
    expect(s.img().getAttribute("draggable")).toBe("false");
  });

  it("shows the error placeholder with retry after the error event", async () => {
    const s = mountPreview();

    s.img().dispatchEvent(new Event("error"));
    await nextTick();

    expect(s.emitted.error).toBe(1);
    const errorBox = s.root().querySelector(".hk-image-preview-error");
    expect(errorBox).not.toBeNull();
    expect(errorBox!.querySelector(".hk-image-preview-error-text")!.textContent).toContain("Couldn't load image");
    // The broken image itself is gone; only the placeholder remains.
    expect(s.root().querySelector(".hk-image-preview-img")).toBeNull();

    // Retry re-arms the loading state (the <img> is re-created and
    // re-requests the src) and recovers on a successful load.
    const retryBtn = errorBox!.querySelector<HTMLButtonElement>("button");
    expect(retryBtn).not.toBeNull();
    expect(retryBtn!.textContent).toContain("Retry");
    retryBtn!.click();
    await nextTick();

    expect(s.root().querySelector(".hk-image-preview-error")).toBeNull();
    expect(s.root().querySelector(".hk-image-preview-loading")).not.toBeNull();
    s.img().dispatchEvent(new Event("load"));
    await nextTick();
    expect(s.root().querySelector(".hk-image-preview-img")).not.toBeNull();
  });
});

describe("HkImagePreview zoomable", () => {
  it("clicking a zoomable preview opens the built-in lightbox", async () => {
    const s = mountPreview();
    s.img().dispatchEvent(new Event("load"));
    await nextTick();

    // Button affordances ride on the loaded state.
    expect(s.root().classList.contains("is-zoomable")).toBe(true);
    expect(s.root().getAttribute("role")).toBe("button");
    expect(s.root().getAttribute("tabindex")).toBe("0");
    expect(s.root().getAttribute("aria-label")).toBe("View larger");

    s.root().click();
    await settle();

    const dialog = document.body.querySelector(".hk-modal-content.hk-image-lightbox");
    expect(dialog).not.toBeNull();
    expect(s.emitted.open).toBe(1);
  });

  it("Enter opens the lightbox from a zoomable preview", async () => {
    const s = mountPreview();
    s.img().dispatchEvent(new Event("load"));
    await nextTick();

    s.root().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle();
    expect(document.body.querySelector(".hk-modal-content.hk-image-lightbox")).not.toBeNull();
    expect(s.emitted.open).toBe(1);
  });

  it("Space opens the lightbox from a zoomable preview", async () => {
    // Fresh mount: reopening over an in-flight leave transition keeps
    // stale DOM around under happy-dom (transitionend never fires), so
    // each keyboard path gets its own preview.
    const s = mountPreview();
    s.img().dispatchEvent(new Event("load"));
    await nextTick();

    s.root().dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    await settle();
    expect(document.body.querySelector(".hk-modal-content.hk-image-lightbox")).not.toBeNull();
    expect(s.emitted.open).toBe(1);
  });

  it("zoomable=false never opens the lightbox and drops the button role", async () => {
    const s = mountPreview({ zoomable: false });
    s.img().dispatchEvent(new Event("load"));
    await nextTick();

    expect(s.root().classList.contains("is-zoomable")).toBe(false);
    expect(s.root().getAttribute("role")).toBeNull();
    expect(s.root().getAttribute("tabindex")).toBeNull();

    s.root().click();
    await settle();

    expect(document.body.querySelector(".hk-modal-content.hk-image-lightbox")).toBeNull();
    expect(s.emitted.open).toBeUndefined();
  });

  it("a failed preview does not open the lightbox on click", async () => {
    const s = mountPreview();

    s.img().dispatchEvent(new Event("error"));
    await nextTick();
    expect(s.root().classList.contains("is-zoomable")).toBe(false);

    s.root().click();
    await settle();
    expect(document.body.querySelector(".hk-modal-content.hk-image-lightbox")).toBeNull();
    expect(s.emitted.open).toBeUndefined();
  });
});
