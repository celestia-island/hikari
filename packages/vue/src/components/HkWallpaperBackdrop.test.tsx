import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";

import { __teardownMediaQueries } from "../runtime/useMediaQuery";
import { luminanceSamplerRefCount, stopLuminanceSampler } from "../theme/useBackgroundLuminance";
import { configureWallpaper, useWallpaper } from "../theme/useWallpaper";
import HkWallpaperBackdrop, { WALLPAPER_REDUCED_MOTION_QUERY } from "./HkWallpaperBackdrop";

/**
 * HkWallpaperBackdrop — the wallpaper stack's surface, and the three
 * implicit DOM contracts it replaces.
 *
 * The ported renderer (chest's WallpaperRenderer.tsx) built `#s-wallpaper-*`
 * elements and PREPENDED them to `document.body`, then wrote `--wallpaper-*`
 * / `data-wallpaper-art` on `documentElement`. Two layouts mount a backdrop
 * (chest does: chat + admin), so:
 *
 *   1. both instances raced for the same global ids (`clearAll()` on either
 *      unmount removed the other's <img>/<video>/<canvas> — the assertions
 *      in "two mounted backdrops" are the counter-example to that);
 *   2. `document.body.children` grew wallpaper nodes no host asked for, and
 *      `documentElement` carried the renderer's variables.
 *
 * A third contract is the canvas itself: a WebGL2 context that fails to
 * appear left the ported `apply()` with nothing painted. Standing down to
 * the solid floor (and REMOVING the canvas) is the required degradation.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const IMAGE_URL = "/res/wallpapers/test-image.png";
const VIDEO_URL = "/res/wallpapers/test-video.mp4";

const wallpaper = () => useWallpaper();

function registerFixtures() {
  configureWallpaper({
    storagePrefix: "hktest",
    presets: [
      { id: "art-image", name: "Image", default: true, source: { type: "image", url: IMAGE_URL } },
      { id: "art-video", name: "Video", source: { type: "video", url: VIDEO_URL } },
      { id: "art-pipeline", name: "Pipeline", source: { type: "pipeline", preset: "aurora" } },
      { id: "art-solid", name: "Solid", source: { type: "solid", color: "auto" } },
    ],
  });
}

function selectWallpaper(id: string) {
  wallpaper().setActiveWallpaper(id);
}

const mounts: Array<{ app: App; container: HTMLElement }> = [];

function mountBackdrop(props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkWallpaperBackdrop, props) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

function unmount(container: HTMLElement) {
  const index = mounts.findIndex((m) => m.container === container);
  const [entry] = mounts.splice(index, 1);
  entry?.app.unmount();
  container.remove();
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 0));
  await nextTick();
}

function root(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".hk-wallpaper-backdrop");
  expect(el, "backdrop root rendered").not.toBeNull();
  return el!;
}

// ── reduced-motion stub ─────────────────────────────────────────────────
//
// useMediaQuery caches one MediaQueryList per query string for the module
// graph, so the stub must be installed over a CLEARED registry and the
// listeners are driven by hand (a real change event is not available in
// happy-dom).

let reduceMotionMatches = false;
let reduceListeners = new Set<(e: MediaQueryListEvent) => void>();
let realMatchMedia: ((query: string) => MediaQueryList) | null = null;

function stubMatchMedia() {
  realMatchMedia = window.matchMedia.bind(window);
  const stub = vi.fn((query: string) => {
    const mql = realMatchMedia!(query);
    return Object.create(mql, {
      matches: { get: () => (query === WALLPAPER_REDUCED_MOTION_QUERY ? reduceMotionMatches : false) },
      addEventListener: {
        value: (_: string, l: (e: MediaQueryListEvent) => void) => reduceListeners.add(l),
      },
      removeEventListener: {
        value: (_: string, l: (e: MediaQueryListEvent) => void) => reduceListeners.delete(l),
      },
    }) as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", stub);
}

function setReduceMotion(matches: boolean) {
  reduceMotionMatches = matches;
  for (const listener of [...reduceListeners]) {
    listener(new MediaQueryListEvent("change", { media: WALLPAPER_REDUCED_MOTION_QUERY, matches }));
  }
}

beforeEach(() => {
  localStorage.clear();
  registerFixtures();
  reduceMotionMatches = false;
  reduceListeners = new Set();
  __teardownMediaQueries();
  stubMatchMedia();
  stopLuminanceSampler();
});

afterEach(() => {
  while (mounts.length > 0) {
    const entry = mounts.pop()!;
    entry.app.unmount();
    entry.container.remove();
  }
  stopLuminanceSampler();
  __teardownMediaQueries();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HkWallpaperBackdrop — the layers live in the component's own root", () => {
  it("leaves document.body free of wallpaper nodes", async () => {
    selectWallpaper("art-image");
    mountBackdrop();
    await settle();

    // The ported renderer's body prepend, asserted absent in every dialect
    // it used: fixed id, class, and the element kind itself.
    expect(document.querySelectorAll("#s-wallpaper-canvas, #s-wallpaper-img, #s-wallpaper-video")).toHaveLength(0);
    expect(document.querySelectorAll(".s-wallpaper-img, .s-wallpaper-video, .s-wallpaper-canvas")).toHaveLength(0);
    for (const child of Array.from(document.body.children)) {
      expect(["IMG", "VIDEO", "CANVAS"]).not.toContain(child.tagName);
    }
  });

  it("renders the art inside its own element, under a stable root", async () => {
    selectWallpaper("art-image");
    const container = mountBackdrop();
    await settle();

    const el = root(container);
    const img = el.querySelector<HTMLImageElement>(".hk-wallpaper-backdrop-img");
    expect(img, "image layer rendered").not.toBeNull();
    expect(img!.src).toContain(IMAGE_URL);
    expect(img!.parentElement).toBe(el);

    // …and the component creates no global ids of its own.
    expect(el.querySelectorAll("[id]")).toHaveLength(0);
  });

  it("writes nothing on documentElement (the global-variable contract)", async () => {
    const styleBefore = document.documentElement.getAttribute("style");
    const datasetBefore = JSON.stringify({ ...document.documentElement.dataset });

    selectWallpaper("art-image");
    const container = mountBackdrop();
    await settle();

    expect(document.documentElement.getAttribute("style")).toBe(styleBefore);
    expect(JSON.stringify({ ...document.documentElement.dataset })).toBe(datasetBefore);
    // The old renderer's scrim gate lived here; the component's own root
    // carries the replacement attribute instead.
    expect(document.documentElement.dataset.wallpaperArt).toBeUndefined();
    expect(root(container).getAttribute("data-hk-wallpaper-art")).toBe("true");

    unmount(container);
    await settle();
    expect(document.documentElement.getAttribute("style")).toBe(styleBefore);
    expect(JSON.stringify({ ...document.documentElement.dataset })).toBe(datasetBefore);
  });

  it("marks a plain (solid) wallpaper as art-free and paints no layer", async () => {
    selectWallpaper("art-solid");
    const container = mountBackdrop();
    await settle();

    const el = root(container);
    expect(el.getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(el.getAttribute("data-hk-wallpaper-art")).toBe("false");
    expect(el.querySelector(".hk-wallpaper-backdrop-layer")).toBeNull();
  });

  it("renders the video layer with the autoplay attributes the renderer set", async () => {
    selectWallpaper("art-video");
    const container = mountBackdrop();
    await settle();

    const video = root(container).querySelector<HTMLVideoElement>(".hk-wallpaper-backdrop-video");
    expect(video, "video layer rendered").not.toBeNull();
    expect(video!.getAttribute("src")).toContain(VIDEO_URL);
    expect(video!.autoplay).toBe(true);
    expect(video!.loop).toBe(true);
    expect(video!.muted).toBe(true);
    expect(video!.hasAttribute("playsinline")).toBe(true);
  });
});

describe("HkWallpaperBackdrop — two instances on one page", () => {
  it("keeps the surviving instance rendering after the other unmounts", async () => {
    selectWallpaper("art-image");
    const first = mountBackdrop();
    const second = mountBackdrop();
    await settle();

    expect(root(first).querySelector(".hk-wallpaper-backdrop-img")).not.toBeNull();
    expect(root(second).querySelector(".hk-wallpaper-backdrop-img")).not.toBeNull();

    unmount(first);
    await settle();

    // The counter-example to the ported renderer: `clearAll()` removed
    // #s-wallpaper-img by id, so unmounting either layout blanked both.
    expect(document.querySelectorAll(".hk-wallpaper-backdrop")).toHaveLength(1);
    const survivor = root(second).querySelector<HTMLImageElement>(".hk-wallpaper-backdrop-img");
    expect(survivor, "surviving backdrop still renders its art").not.toBeNull();
    expect(survivor!.src).toContain(IMAGE_URL);
  });

  it("shares one luminance sampler loop and releases only its own claim", async () => {
    selectWallpaper("art-image");
    const first = mountBackdrop();
    const second = mountBackdrop();
    await settle();
    expect(luminanceSamplerRefCount()).toBe(2);

    unmount(first);
    await settle();
    expect(luminanceSamplerRefCount(), "the survivor's claim survives").toBe(1);

    unmount(second);
    await settle();
    expect(luminanceSamplerRefCount()).toBe(0);
  });

  it("re-renders both instances from the one shared wallpaper state", async () => {
    selectWallpaper("art-image");
    const first = mountBackdrop();
    const second = mountBackdrop();
    await settle();

    selectWallpaper("art-video");
    await settle();

    expect(root(first).querySelector(".hk-wallpaper-backdrop-video")).not.toBeNull();
    expect(root(second).querySelector(".hk-wallpaper-backdrop-video")).not.toBeNull();
  });
});

describe("HkWallpaperBackdrop — reduced motion is the component's own gate", () => {
  function pipelineDriver(dispose = vi.fn()) {
    const factory = vi.fn(() => ({ dispose }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    return { factory, dispose };
  }

  it("never starts the animated surface when the query matches", async () => {
    setReduceMotion(true);
    selectWallpaper("art-pipeline");
    const { factory } = pipelineDriver();

    const container = mountBackdrop({ createSurface: factory });
    await settle();

    // No factory call ⇒ no host render loop ⇒ no onFrame registration: the
    // host cannot be blamed for this one, the component never asked.
    expect(factory).not.toHaveBeenCalled();
    expect(container.querySelector("canvas")).toBeNull();
    expect(root(container).getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(luminanceSamplerRefCount(), "no shared frame loop either").toBe(0);
  });

  it("starts the surface when the preference is off (control)", async () => {
    selectWallpaper("art-pipeline");
    const { factory } = pipelineDriver();

    const container = mountBackdrop({ createSurface: factory });
    await settle();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(root(container).getAttribute("data-hk-wallpaper-mode")).toBe("pipeline");
    expect(luminanceSamplerRefCount()).toBe(1);
  });

  it("tears a running surface down when the preference turns on mid-flight", async () => {
    selectWallpaper("art-pipeline");
    const { factory, dispose } = pipelineDriver();

    const container = mountBackdrop({ createSurface: factory });
    await settle();
    expect(factory).toHaveBeenCalledTimes(1);

    setReduceMotion(true);
    await settle();

    expect(dispose, "the running loop is disposed, not merely ignored").toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
    expect(root(container).getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(luminanceSamplerRefCount(), "the idle sampler loop is released too").toBe(0);
  });

  it("does not gate the static art kinds (image still paints)", async () => {
    setReduceMotion(true);
    selectWallpaper("art-image");
    const container = mountBackdrop();
    await settle();

    expect(root(container).querySelector(".hk-wallpaper-backdrop-img")).not.toBeNull();
    expect(root(container).getAttribute("data-hk-wallpaper-art")).toBe("true");
  });
});

describe("HkWallpaperBackdrop — pipeline degradation", () => {
  it("degrades to the solid floor when getContext('webgl2') returns null", async () => {
    selectWallpaper("art-pipeline");
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(null as unknown as RenderingContext);
    const factory = vi.fn(() => ({ dispose: vi.fn() }));

    const container = mountBackdrop({ createSurface: factory });
    await settle();

    expect(getContext).toHaveBeenCalledWith("webgl2", expect.objectContaining({ powerPreference: "high-performance" }));
    expect(factory).not.toHaveBeenCalled();
    const el = root(container);
    expect(el.getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(el.getAttribute("data-hk-wallpaper-art")).toBe("false");
    // The dead canvas is not left behind pretending to paint.
    expect(container.querySelector("canvas")).toBeNull();
    expect(el.classList.contains("hk-wallpaper-backdrop-solid")).toBe(true);
  });

  it("degrades to the solid floor when no driver is registered", async () => {
    selectWallpaper("art-pipeline");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);

    const container = mountBackdrop();
    await settle();

    expect(root(container).getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("degrades to the solid floor when the driver declines or throws", async () => {
    selectWallpaper("art-pipeline");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);

    const declining = mountBackdrop({ createSurface: () => null });
    await settle();
    expect(root(declining).getAttribute("data-hk-wallpaper-mode")).toBe("solid");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwing = mountBackdrop({
      createSurface: () => {
        throw new Error("no shaders");
      },
    });
    await settle();
    expect(root(throwing).getAttribute("data-hk-wallpaper-mode")).toBe("solid");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes the canvas, a live context and the preset id to the driver", async () => {
    selectWallpaper("art-pipeline");
    const gl = {} as WebGL2RenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl);
    const factory = vi.fn(() => ({ dispose: vi.fn() }));

    const container = mountBackdrop({ createSurface: factory });
    await settle();

    expect(factory).toHaveBeenCalledTimes(1);
    const ctx = (factory.mock.calls[0] as unknown[])[0] as {
      canvas: HTMLCanvasElement;
      gl: WebGL2RenderingContext;
      presetId: string;
      powerPreference: string;
    };
    expect(ctx.canvas).toBe(container.querySelector("canvas"));
    expect(ctx.gl).toBe(gl);
    expect(ctx.presetId).toBe("aurora");
    expect(ctx.powerPreference).toBe("high-performance");
  });

  it("honours the powerPreference prop (the battery knob)", async () => {
    selectWallpaper("art-pipeline");
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as WebGL2RenderingContext);

    mountBackdrop({ createSurface: () => ({ dispose: vi.fn() }), powerPreference: "low-power" });
    await settle();

    expect(getContext).toHaveBeenCalledWith("webgl2", expect.objectContaining({ powerPreference: "low-power" }));
  });

  it("disposes the surface on unmount", async () => {
    selectWallpaper("art-pipeline");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    const dispose = vi.fn();

    const container = mountBackdrop({ createSurface: () => ({ dispose }) });
    await settle();
    unmount(container);
    await settle();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
