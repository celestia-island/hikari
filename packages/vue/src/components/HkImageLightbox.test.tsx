import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkImageLightbox from "./HkImageLightbox";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

interface Setup {
  dialog: () => HTMLElement | null;
  closeButton: () => HTMLButtonElement;
  emitted: boolean[];
}

function mountLightbox(initialOpen: boolean): Setup {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const open = ref(initialOpen);
  const emitted: boolean[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkImageLightbox, {
          src: "/test-wallpaper.svg",
          alt: "wallpaper",
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  return {
    dialog: () => document.body.querySelector<HTMLElement>(".hk-modal-content.hk-image-lightbox"),
    closeButton: () => {
      const btn = document.body.querySelector<HTMLButtonElement>(".hk-image-lightbox-close");
      if (!btn) throw new Error("lightbox close button not rendered");
      return btn;
    },
    emitted,
  };
}

describe("HkImageLightbox", () => {
  it("renders the immersive dialog (viewer + close button) while open", () => {
    const s = mountLightbox(true);

    const dialog = s.dialog();
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector(".hk-image-viewer")).not.toBeNull();
    expect(dialog!.querySelector(".hk-image-viewer-img")).not.toBeNull();

    const btn = s.closeButton();
    expect(btn.getAttribute("aria-label")).toBe("Close");
    // Unified close glyph: the shared icon-button renders the registry X
    // (default-slot branch), never the fallback placeholder circle.
    expect(btn.querySelector(".hk-icon")).not.toBeNull();
    expect(btn.querySelector("circle")).toBeNull();
  });

  it("renders nothing while closed", () => {
    const s = mountLightbox(false);
    expect(s.dialog()).toBeNull();
  });

  it("the close button emits update:modelValue false", async () => {
    const s = mountLightbox(true);

    s.closeButton().click();
    await nextTick();

    expect(s.emitted).toEqual([false]);
  });

  it("Escape closes via the lightbox's own window listener", async () => {
    const s = mountLightbox(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(s.emitted).toEqual([false]);
  });

  it("the Escape listener is removed once closed (no stray closes)", async () => {
    const s = mountLightbox(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(s.emitted).toEqual([false]);

    // The modelValue watch removed the window listener on close — a
    // second Escape must not emit another update.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(s.emitted).toEqual([false]);
  });

  it("names the dialog via surfaceTitle without rendering a header or a dev warning", () => {
    // The spy must be live before mount: the popup manager warns (DEV
    // builds) the moment an untitled layer registers.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const s = mountLightbox(true);

      const dialog = s.dialog();
      expect(dialog).not.toBeNull();
      // surfaceTitle names the dialog…
      expect(dialog!.getAttribute("aria-label")).toBe("Image viewer");
      // …without conjuring header chrome.
      expect(dialog!.querySelector(".hk-modal-header")).toBeNull();
      // …and without tripping the untitled-popup dev warning.
      expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("popup registered without a title"));
    } finally {
      warn.mockRestore();
    }
  });

  it("unmounting while open removes the window Escape listener", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const open = ref(true);
    const emitted: boolean[] = [];
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkImageLightbox, {
            src: "/test-wallpaper.svg",
            modelValue: open.value,
            "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
          });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);
    await nextTick();
    expect(document.body.querySelector(".hk-modal-content.hk-image-lightbox")).not.toBeNull();

    // Tear the whole component down while the dialog is open…
    app.unmount();
    await nextTick();

    // …a stray Escape must reach nobody.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(emitted).toEqual([]);
  });
});
