import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkToast from "./HkToast";
import { useToast } from "../runtime/useToast";

/**
 * HkToast leave-transition contract:
 * - the leaving toast is pinned to its in-flow box (right/top/width/
 *   height + border-box) by the before-leave hook, because the fixed
 *   stack column is shrink-to-fit and collapses once the toast leaves
 *   the flow — a percentage width there resolves against a dead
 *   containing block and the toast "flashes" into a sliver
 * - the pin measures the PRE-PATCH box: during a multi-toast removal an
 *   earlier sibling's position:absolute re-fits the column inside the
 *   same patch pass, so live offset reads in a later sibling's
 *   before-leave hook would teleport it onto the reflowed slot and
 *   squash its bar (HkListTransition's pre-patch snapshot pattern)
 * - the toast is gone after the leave settles
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountHost() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkToast) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hk-toast-item"));
}

function stubLayout(el: HTMLElement, over: Partial<{
  offsetTop: number;
  offsetLeft: number;
  offsetWidth: number;
  offsetHeight: number;
}>): void {
  // happy-dom has no layout engine; feed the leave hook the geometry a
  // real browser would read from the laid-out stack.
  const wrapper = el.parentElement as HTMLElement;
  Object.defineProperty(wrapper, "clientWidth", { value: 384, configurable: true });
  Object.defineProperty(el, "offsetParent", { value: wrapper, configurable: true });
  Object.defineProperty(el, "offsetTop", { value: over.offsetTop ?? 0, configurable: true });
  Object.defineProperty(el, "offsetLeft", { value: over.offsetLeft ?? 0, configurable: true });
  Object.defineProperty(el, "offsetWidth", { value: over.offsetWidth ?? 384, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: over.offsetHeight ?? 83, configurable: true });
}

afterEach(async () => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  const { toasts, remove } = useToast();
  for (const t of [...toasts]) remove(t.id);
  document.querySelectorAll(".hk-toast-container").forEach((el) => el.remove());
});

describe("HkToast", () => {
  it("renders a toast slot per severity", async () => {
    mountHost();
    const toast = useToast();
    toast.error("backend unreachable");
    await settle();

    const [item] = items();
    expect(item).toBeTruthy();
    expect(item.className).toContain("hk-toast-error");
    expect(item.textContent).toContain("backend unreachable");

    toast.remove(toast.toasts[0]!.id);
    await settle();
    expect(items().length).toBe(0);
  });

  it("pins the leaving toast to its in-flow box so the stack collapse cannot deform it", async () => {
    mountHost();
    const toast = useToast();
    toast.error("long enough error body that wrapped to a tall box");
    await settle();

    const item = items()[0];
    stubLayout(item, { offsetTop: 0, offsetLeft: 0, offsetWidth: 384, offsetHeight: 83 });

    item.querySelector<HTMLButtonElement>(".hk-toast-close")!.click();
    await nextTick();

    const leaving = document.querySelector<HTMLElement>(".hk-toast-leave-active");
    expect(leaving).not.toBeNull();
    // The pin mirrors the measured in-flow box exactly.
    expect(leaving!.style.right).toBe("0px");
    expect(leaving!.style.top).toBe("0px");
    expect(leaving!.style.width).toBe("384px");
    expect(leaving!.style.height).toBe("83px");
    expect(leaving!.style.boxSizing).toBe("border-box");

    await settle();
    expect(items().length).toBe(0);
  });

  it("pins a later sibling to its pre-patch box when several toasts leave in one pass", async () => {
    mountHost();
    const toast = useToast();
    toast.error("long enough error body that wrapped to a tall box");
    toast.warning("medium body on the second row");
    await settle();

    const [first, second] = items();
    // Model the browser's synchronous re-layout: once the FIRST toast
    // goes position:absolute mid-patch, the shrink-to-fit column re-fits
    // to the remaining in-flow toast — its box re-stretches to its own
    // max-content (138) and it shifts up to the vacated top slot.
    // happy-dom has no layout engine, so the stubs branch on the first
    // toast's leave-active class to emulate the before/after readings.
    const wrapper = first.parentElement as HTMLElement;
    const reflowed = () => first.classList.contains("hk-toast-leave-active");
    Object.defineProperty(wrapper, "clientWidth", {
      configurable: true,
      get: () => (reflowed() ? 138 : 384),
    });
    const stub = (
      el: HTMLElement,
      pre: { top: number; left: number; width: number; height: number },
      post: { top: number; left: number; width: number; height: number },
    ) => {
      Object.defineProperty(el, "offsetParent", { value: wrapper, configurable: true });
      for (const key of ["offsetTop", "offsetLeft", "offsetWidth", "offsetHeight"] as const) {
        const short = key.slice(6).toLowerCase() as "top" | "left" | "width" | "height";
        Object.defineProperty(el, key, {
          configurable: true,
          get: () => (reflowed() ? post[short] : pre[short]),
        });
      }
    };
    stub(first, { top: 0, left: 0, width: 384, height: 83 }, { top: 0, left: 0, width: 384, height: 83 });
    stub(second, { top: 95, left: 0, width: 384, height: 48 }, { top: 0, left: 0, width: 138, height: 48 });

    const [idA, idB] = toast.toasts.map((t) => t.id);
    toast.remove(idA);
    toast.remove(idB);
    await nextTick();

    const [pinFirst, pinSecond] =
      document.querySelectorAll<HTMLElement>(".hk-toast-leave-active");
    // The second toast's pin mirrors its PRE-patch box — full-width bar
    // at its own row — not the reflowed sliver at the vacated top slot.
    expect(pinFirst!.style.right).toBe("0px");
    expect(pinFirst!.style.top).toBe("0px");
    expect(pinFirst!.style.width).toBe("384px");
    expect(pinFirst!.style.height).toBe("83px");
    expect(pinSecond!.style.right).toBe("0px");
    expect(pinSecond!.style.top).toBe("95px");
    expect(pinSecond!.style.width).toBe("384px");
    expect(pinSecond!.style.height).toBe("48px");

    await settle();
    expect(items().length).toBe(0);
  });
});
