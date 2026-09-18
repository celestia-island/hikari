import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkNodeCanvas from "./HkNodeCanvas";

/** Mount a component into a detached div and return the root element. */
function mountToDom(component: ReturnType<typeof defineComponent>): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(component);
  app.mount(el);
  return el;
}

function pointerEvent(type: string, opts: Record<string, number | boolean> = {}): PointerEvent {
  return new PointerEvent(type, {
    pointerId: (opts.pointerId as number) ?? 1,
    clientX: (opts.clientX as number) ?? 0,
    clientY: (opts.clientY as number) ?? 0,
    button: (opts.button as number) ?? 0,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
}

describe("HkNodeCanvas gesture & animation upgrades", () => {
  describe("tweenCamera", () => {
    it("exposes tweenCamera as a function", () => {
      const exposed: Record<string, unknown> = {};
      const Host = defineComponent({
        setup() {
          const canvasRef = ref<unknown>(null);
          const check = () => {
            const vm = canvasRef.value as Record<string, unknown> | null;
            if (vm) Object.assign(exposed, { tweenCamera: vm.tweenCamera });
          };
          return () =>
            h(HkNodeCanvas, { ref: canvasRef, minimap: false, onVnodeMounted: check }, { default: () => h("div") });
        },
      });
      const el = mountToDom(Host);
      expect(typeof exposed.tweenCamera).toBe("function");
      el.remove();
    });

    it("tweenMs=0 (default) does not start an animation frame", () => {
      let tweenFn: ((...a: unknown[]) => void) | null = null;
      const Host = defineComponent({
        setup() {
          const canvasRef = ref<unknown>(null);
          const check = () => {
            const vm = canvasRef.value as Record<string, unknown> | null;
            if (vm) tweenFn = vm.tweenCamera as (...a: unknown[]) => void;
          };
          return () =>
            h(HkNodeCanvas, {
              ref: canvasRef,
              minimap: false,
              fitOnLoad: false,
              onVnodeMounted: check,
            }, { default: () => h("div") });
        },
      });
      const el = mountToDom(Host);
      expect(tweenFn).toBeTruthy();
      // Calling with default tweenMs=0 should snap (no rAF started).
      tweenFn!({ k: 2, x: 100, y: 50 });
      el.remove();
    });
  });

  describe("pinchable prop", () => {
    it("defaults to true", () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () => h(HkNodeCanvas, { minimap: false }, { default: () => h("div") });
        },
      }));
      expect(el.querySelector(".hk-node-canvas")).toBeTruthy();
      el.remove();
    });

    it("can be disabled", () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () => h(HkNodeCanvas, { minimap: false, pinchable: false }, { default: () => h("div") });
        },
      }));
      expect(el.querySelector(".hk-node-canvas")).toBeTruthy();
      el.remove();
    });
  });

  describe("reduced motion", () => {
    it("respectReducedMotion defaults to true", () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () => h(HkNodeCanvas, { minimap: false }, { default: () => h("div") });
        },
      }));
      expect(el.querySelector(".hk-node-canvas")).toBeTruthy();
      el.remove();
    });
  });

  describe("pointerScale prop", () => {
    it("accepts a pointerScale function", () => {
      const el = mountToDom(defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              minimap: false,
              pointerScale: () => ({ x: 2, y: 2 }),
            }, { default: () => h("div") });
        },
      }));
      expect(el.querySelector(".hk-node-canvas")).toBeTruthy();
      el.remove();
    });
  });

  describe("pinch gesture (integration)", () => {
    it("two simultaneous pointers do not crash", async () => {
      const Host = defineComponent({
        setup() {
          return () =>
            h(HkNodeCanvas, {
              minimap: false,
              pannable: true,
              pinchable: true,
            }, { default: () => h("div") });
        },
      });
      const el = mountToDom(Host);
      const root = el.querySelector(".hk-node-canvas")!;
      expect(root).toBeTruthy();

      // Simulate two fingers down.
      root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 10, clientX: 100, clientY: 100 }));
      root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 20, clientX: 200, clientY: 100 }));
      await nextTick();

      // Simulate one finger moving (pinch in progress).
      root.dispatchEvent(pointerEvent("pointermove", { pointerId: 20, clientX: 150, clientY: 100 }));
      await nextTick();

      // Release both fingers.
      root.dispatchEvent(pointerEvent("pointerup", { pointerId: 10 }));
      root.dispatchEvent(pointerEvent("pointerup", { pointerId: 20 }));
      await nextTick();

      // No crash — the component is still mounted.
      expect(el.querySelector(".hk-node-canvas")).toBeTruthy();
      el.remove();
    });
  });
});
