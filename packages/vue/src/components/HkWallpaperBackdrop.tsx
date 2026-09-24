import { computed, defineComponent, onMounted, onUnmounted, ref, watch, type CSSProperties, type PropType } from "vue";

import { releaseMediaQuery, useMediaQuery } from "../runtime/useMediaQuery";
import {
  registerWallpaperSurfaceSources,
  releaseLuminanceSampler,
  retainLuminanceSampler,
  sampleLuminanceNow,
} from "../theme/useBackgroundLuminance";
import type { TimePeriod } from "../theme/useSolarTime";
import { useWallpaper } from "../theme/useWallpaper";
import { buildWallpaperFilter } from "../theme/wallpaperDisplay";
import type { WallpaperDisplaySettings } from "../theme/wallpaper";
import "./HkWallpaperBackdrop.scss";

/**
 * HkWallpaperBackdrop — the wallpaper stack's SURFACE: the page layer that
 * paints the active wallpaper (image / video / pipeline canvas, over a solid
 * floor) for whichever layout mounts it.
 *
 * ## Host registration (there is no hikari default, on purpose)
 *
 * ```ts
 * registerThemeDecor({
 *   themeId: "*", slot: "backdrop", component: HkWallpaperBackdrop,
 *   // Only when the host has a pipeline renderer of its own — hikari ships
 *   // the surface, not the shaders (see `createSurface`):
 *   props: { createSurface: mySurfaceFactory },
 * });
 * ```
 *
 * The props bag above is how a driver reaches the component: `HkThemeDecor`
 * forwards a registration's `props` to the resolved component, so the host
 * does not have to wrap it.
 *
 * hikari does NOT register this on the `backdrop` slot's built-in floor.
 * `registerThemeDecor` has no unregister, and the floor is what a host
 * cannot configure away — a library-owned page-covering layer would be a
 * decision the host could not take back. `standardDecor.ts` records the
 * same gap from the other side: `getThemeDecor("backdrop", …)` is
 * `undefined` until a HOST registers something, and that `undefined` is the
 * correct "no backdrop configured" state. Registering `themeId: "*"` (the
 * wildcard level, above the floor) is what a host that wants the shared
 * wallpaper stack does, and what this component exists to be registered as.
 *
 * ## What it owns, and what it deliberately does NOT
 *
 * The ported renderer (chest's `WallpaperRenderer.tsx`) built `#s-wallpaper-*`
 * elements with FIXED ids, prepended them to `document.body`, and wrote
 * `documentElement` style/dataset properties. Two layouts mounting it (chest
 * does: chat layout AND admin layout) therefore shared one set of global ids:
 * `clearAll()` on either unmount removed the OTHER layout's elements, and
 * `destroySlangPipeline()` (a module-level singleton teardown) destroyed the
 * other instance's pipeline. This component renders every layer inside ITS
 * OWN root element instead — no `document.body` writes, no global ids, no
 * module-level teardown — so two instances are two independent surfaces.
 *
 * What stays with the CONSUMER, because it is a page-global selector the
 * component has no business writing:
 *
 *  - `body { background-image / background-attachment }` and the page tint
 *    (`body::before` scrim, chest's `theme.scss`). The host reads
 *    `overlayOpacity` / `pipelineOverlay` from `useWallpaper()` itself and
 *    gates its own scrim on this component's `data-hk-wallpaper-art`
 *    attribute (the old renderer wrote `html[data-wallpaper-art]`, which was
 *    the same global-write mistake in miniature).
 *  - the SOLID FLOOR color stays a theme token: the root paints
 *    `rgb(var(--color-background))`, exactly what the ported renderer left
 *    on `body` (`applySolid` removed `--wallpaper-solid-color` rather than
 *    setting it, so "solid" has always meant "the page background shows").
 *
 * Mount it where no ancestor creates a containing block for `position:
 * fixed` (no `transform` / `filter` / `will-change` on an ancestor): the
 * root is a viewport-fixed layer, and a transformed ancestor would quietly
 * re-anchor it. The ported renderer sidestepped that by appending to `body`;
 * a component cannot, and the host placing it at the top of its app tree is
 * the replacement contract.
 *
 * ## Reduced motion: the component's own gate, not the host's call
 *
 * `hits prefers-reduced-motion: reduce` ⇒ the ANIMATED layer is never
 * created: no canvas element, no surface factory call, so no `onFrame`
 * loop can exist for it (the host pipeline's `init()` is what registers one,
 * so standing the attach down is what actually stops it — an erp-style host
 * that never wires up motion at all still gets a static backdrop). The
 * static stand-in is the solid floor.
 *
 * The gate is a `useMediaQuery` subscription, NOT hikari's
 * `useReducedMotion()`: that composable has a module-level one-shot latch
 * (`let initialized = false`) and exposes no readable state — it pushes into
 * the animation bus for whoever called it FIRST, so a component reading it
 * would inherit another caller's answer and, in a page with two backdrops,
 * could not gate itself at all. `useMediaQuery` is per-query shared,
 * reactive, SSR-safe and released on unmount.
 *
 * Under reduced motion one-shot sampling still runs on every wallpaper
 * change (`sampleLuminanceNow`), so the floating-text contrast tokens are
 * computed from the real surface without a frame loop.
 *
 * ## Preconditions
 *
 *  - `initWallpaper()` (host boot) owns the solar clock; this component only
 *    consumes `useWallpaper()` state. A host that never calls it renders the
 *    "day" period and no user wallpaper — the logic layer's contract, not
 *    this component's.
 *  - A pipeline wallpaper paints NOTHING without a `createSurface` driver:
 *    hikari ships the surface, not the renderer (chest's shader presets are
 *    application assets). The component then stands down to the solid floor
 *    rather than leaving an invisible canvas on screen — the "no WebGL, no
 *    driver ⇒ paint nothing and say nothing" failure the ported `apply()`
 *    had.
 */

/** The layer this component is painting (or standing down to) right now. */
export type HkWallpaperBackdropMode = "solid" | "image" | "video" | "pipeline";

/** The media query the component gates its own animation on. */
export const WALLPAPER_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The component-owned rendering surface handed to a host pipeline driver.
 *
 * The driver owns the drawing buffer (`canvas.width/height`) and any resize
 * policy it needs: the component keeps the CSS box (the sheet sizes the
 * canvas to the root), the host keeps the pixels. `dispose()` is called on
 * unmount, on a wallpaper switch away from the pipeline, and when reduced
 * motion turns on — a driver that registered an `onFrame` loop must drop it
 * there.
 */
export interface HkWallpaperSurface {
  /** Solar period change (day / dusk / night) — optional. */
  setPeriod?(period: TimePeriod): void;
  /** Tear down: drop every listener/handle the driver created. */
  dispose(): void;
}

/** Everything a driver needs to attach to the component's canvas. */
export interface HkWallpaperSurfaceContext {
  /** The component-owned canvas, already in the DOM. */
  canvas: HTMLCanvasElement;
  /** A live WebGL2 context on `canvas` (created by the component). */
  gl: WebGL2RenderingContext;
  /** The resolved pipeline preset id (see `WallpaperPipelineLookup`). */
  presetId: string;
  /** The period at attach time (later changes arrive via `setPeriod`). */
  period: TimePeriod;
  /** The context attribute the component requested (see the prop). */
  powerPreference: WebGLPowerPreference;
}

/**
 * Host pipeline driver factory. Return `null` to decline — the component
 * then stands down to the solid floor, exactly as it does when WebGL2 is
 * unavailable.
 */
export type HkWallpaperSurfaceFactory = (
  ctx: HkWallpaperSurfaceContext,
) => HkWallpaperSurface | null | undefined;

/** Frame-stable canvas fit/zoom, ported from the renderer this replaces.
 *  Pipeline canvases are authored fullscreen, so "contain" and "cover"
 *  coincide and must keep the exact 1:1 framing (the default dark-mode
 *  pipeline look). "stretch" zooms in; a left/right position shifts the
 *  canvas with overscan so the exposed side reads as intentional empty
 *  space rather than a rendering artifact. */
function canvasTransform(settings: WallpaperDisplaySettings): string {
  const tx = settings.position === "left" ? -14 : settings.position === "right" ? 14 : 0;
  const base = tx !== 0 ? 1.15 : 1.0;
  const zoom = settings.scale === "stretch" ? base * 1.12 : base;
  if (tx === 0 && zoom === 1.0) return "none";
  return `scale(${zoom.toFixed(4)}) translateX(${tx}%)`;
}

export default defineComponent({
  name: "HkWallpaperBackdrop",
  props: {
    /**
     * WebGL context attribute for the pipeline canvas. Default
     * `"high-performance"` is what the ported renderer hard-coded, so the
     * shipped behaviour is unchanged; a host that cares about laptop battery
     * (an integrated-GPU preference) sets `"low-power"` here instead of
     * patching the library.
     */
    powerPreference: {
      type: String as PropType<WebGLPowerPreference>,
      default: "high-performance",
    },
    /** Host pipeline renderer — see `HkWallpaperSurfaceFactory`. */
    createSurface: {
      type: Function as PropType<HkWallpaperSurfaceFactory | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    const { isPipeline, isSolid, isVideo, mediaUrl, pipelinePreset, currentPeriod, displaySettings } =
      useWallpaper();

    const reduceMotion = useMediaQuery(WALLPAPER_REDUCED_MOTION_QUERY);

    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const videoRef = ref<HTMLVideoElement | null>(null);

    /** The pipeline branch could not start (no WebGL2 / no driver / driver
     *  declined): the solid floor is the rendering, and the canvas is not
     *  left behind pretending to paint something. */
    const pipelineStoodDown = ref(false);

    let surface: HkWallpaperSurface | null = null;
    let unregisterSources: (() => void) | null = null;
    let samplerRetained = false;

    /** What the wallpaper state asks for, before any stand-down. */
    const requestedMode = computed<HkWallpaperBackdropMode>(() => {
      if (isSolid.value) return "solid";
      if (isPipeline.value && pipelinePreset.value) return "pipeline";
      if (isVideo.value && mediaUrl.value) return "video";
      if (mediaUrl.value) return "image";
      return "solid";
    });

    /** What is actually painted. The pipeline branch degrades to "solid" —
     *  never to "an empty canvas" — under reduced motion or after a failed
     *  attach. */
    const effectiveMode = computed<HkWallpaperBackdropMode>(() =>
      requestedMode.value === "pipeline" && (reduceMotion.value || pipelineStoodDown.value)
        ? "solid"
        : requestedMode.value,
    );

    const paintsArt = computed(() => effectiveMode.value !== "solid");

    const mediaStyle = computed<CSSProperties>(() => {
      const settings = displaySettings.value;
      const fit =
        settings.scale === "stretch" ? "fill" : settings.scale === "contain" ? "contain" : "cover";
      const pos =
        settings.position === "left"
          ? "left center"
          : settings.position === "right"
            ? "right center"
            : "center center";
      return {
        objectFit: fit,
        objectPosition: pos,
        filter: buildWallpaperFilter(settings),
      };
    });

    const canvasStyle = computed<CSSProperties>(() => ({
      filter: buildWallpaperFilter(displaySettings.value),
      transform: canvasTransform(displaySettings.value),
    }));

    function disposeSurface(): void {
      const current = surface;
      surface = null;
      if (!current) return;
      try {
        current.dispose();
      } catch (err) {
        // A host teardown that throws must not take the unmount with it.
        if (typeof console !== "undefined") {
          console.warn("[HkWallpaperBackdrop] surface dispose threw", err);
        }
      }
    }

    /** Probe WebGL2, hand the canvas to the host driver, or stand down. */
    function syncSurface(): void {
      disposeSurface();
      if (effectiveMode.value !== "pipeline") return;

      const canvas = canvasRef.value;
      const presetId = pipelinePreset.value;
      const factory = props.createSurface;
      if (!canvas || !presetId || !factory) {
        pipelineStoodDown.value = true;
        return;
      }

      let gl: WebGL2RenderingContext | null = null;
      try {
        gl = canvas.getContext("webgl2", {
          alpha: true,
          antialias: false,
          powerPreference: props.powerPreference,
        }) as WebGL2RenderingContext | null;
      } catch {
        gl = null;
      }
      if (!gl) {
        // No WebGL2 (old browser, blocklisted driver, headless): the solid
        // floor is the fallback, and the canvas is removed from the tree.
        pipelineStoodDown.value = true;
        return;
      }

      let created: HkWallpaperSurface | null = null;
      try {
        created =
          factory({
            canvas,
            gl,
            presetId,
            period: currentPeriod.value,
            powerPreference: props.powerPreference,
          }) ?? null;
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[HkWallpaperBackdrop] pipeline surface factory threw", err);
        }
        created = null;
      }
      if (!created) {
        pipelineStoodDown.value = true;
        return;
      }
      surface = created;
    }

    /** One shared sampler loop, however many backdrops are mounted. */
    function applySamplerPolicy(): void {
      if (reduceMotion.value) {
        if (samplerRetained) {
          samplerRetained = false;
          releaseLuminanceSampler();
        }
        // No loop: one static read keeps the floating-text tokens honest.
        sampleLuminanceNow();
        return;
      }
      if (!samplerRetained) {
        samplerRetained = true;
        retainLuminanceSampler();
      }
    }

    // Two watchers over the same sources, deliberately: the PRE pass re-arms
    // the pipeline branch (so the canvas is back in the tree), the POST pass
    // then probes with that canvas available. A single watcher cannot do
    // both — at pre-flush time the element does not exist yet.
    const syncSources = [
      requestedMode,
      pipelinePreset,
      reduceMotion,
      () => props.createSurface,
      () => props.powerPreference,
    ] as const;

    watch(syncSources, () => {
      pipelineStoodDown.value = false;
    });

    watch(
      syncSources,
      () => {
        syncSurface();
        applySamplerPolicy();
      },
      { flush: "post" },
    );

    // post: the <video> element is in the tree by the time this runs.
    watch(
      [effectiveMode, mediaUrl],
      () => {
        const video = videoRef.value;
        if (!video) return;
        video.muted = true;
        try {
          void Promise.resolve(video.play()).catch(() => {});
        } catch {
          // Autoplay refused (policy) — the first frame still paints.
        }
      },
      { flush: "post" },
    );

    watch(currentPeriod, (period) => {
      surface?.setPeriod?.(period);
    });

    onMounted(() => {
      // Registered BEFORE the first sample: the sampler resolves its source
      // through this registry, and an unregistered instance falls back to
      // the legacy element ids (the pre-component contract).
      unregisterSources = registerWallpaperSurfaceSources({
        canvas: () => canvasRef.value,
        video: () => videoRef.value,
      });
      syncSurface();
      applySamplerPolicy();
    });

    onUnmounted(() => {
      disposeSurface();
      if (samplerRetained) {
        samplerRetained = false;
        releaseLuminanceSampler();
      }
      unregisterSources?.();
      unregisterSources = null;
      releaseMediaQuery(WALLPAPER_REDUCED_MOTION_QUERY);
    });

    return () => {
      const mode = effectiveMode.value;
      return (
        <div
          class={["hk-wallpaper-backdrop", `hk-wallpaper-backdrop-${mode}`]}
          data-hk-wallpaper-mode={mode}
          data-hk-wallpaper-art={paintsArt.value ? "true" : "false"}
          aria-hidden="true"
        >
          {mode === "image" ? (
            <img
              class="hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-img"
              src={mediaUrl.value}
              alt=""
              style={mediaStyle.value}
            />
          ) : null}
          {mode === "video" ? (
            <video
              ref={videoRef}
              class="hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-video"
              src={mediaUrl.value}
              autoplay
              loop
              muted
              playsinline
              disablePictureInPicture
              style={mediaStyle.value}
            />
          ) : null}
          {mode === "pipeline" ? (
            <canvas
              ref={canvasRef}
              class="hk-wallpaper-backdrop-layer hk-wallpaper-backdrop-canvas"
              style={canvasStyle.value}
            />
          ) : null}
        </div>
      );
    };
  },
});
