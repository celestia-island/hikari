/**
 * HkPopover outside-click shield × nested popout layers: a popover
 * opened from INSIDE another popover teleports to <body>, so the outer
 * shield cannot see the nesting by DOM containment. The host marks
 * every layer with data-hk-popout-layer and the shield honors it — a
 * click inside a nested layer is that layer's business, never a
 * backdrop dismissal for the ancestor (2026-10-14: picking a select
 * option inside a filter panel used to slam the whole panel shut).
 */
import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkPopover from "./HkPopover";

const apps: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of apps.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim")
    .forEach((el) => el.remove());
});

/** Outer popover hosting a trigger that opens an inner (teleported)
 * popover — the filter-panel nesting shape in miniature. */
const Host = defineComponent({
  name: "ShieldProbeHost",
  setup() {
    const outerOpen = ref(false);
    const innerOpen = ref(false);
    const outerAnchor = ref<HTMLElement | null>(null);
    const innerAnchor = ref<HTMLElement | null>(null);
    return () => (
      <div>
        <button ref={outerAnchor} type="button" class="outer-toggle" onClick={() => (outerOpen.value = !outerOpen.value)}>
          outer
        </button>
        <HkPopover
          modelValue={outerOpen.value}
          onUpdate:modelValue={(v: boolean) => (outerOpen.value = v)}
          anchorRef={outerAnchor.value}
          title="outer"
        >
          <button ref={innerAnchor} type="button" class="inner-toggle" onClick={() => (innerOpen.value = !innerOpen.value)}>
            inner
          </button>
          <HkPopover
            modelValue={innerOpen.value}
            onUpdate:modelValue={(v: boolean) => (innerOpen.value = v)}
            anchorRef={innerAnchor.value}
            title="inner"
          >
            <div class="inner-body">inner content</div>
          </HkPopover>
        </HkPopover>
      </div>
    );
  },
});

function mountHost() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(Host);
  app.mount(container);
  apps.push({ app, container });
  return container;
}

describe("HkPopover outside-click shield vs nested layers", () => {
  it("marks its teleported host as a popout layer", async () => {
    const c = mountHost();
    c.querySelector<HTMLButtonElement>(".outer-toggle")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await nextTick();
    await nextTick();
    const hosts = [...document.body.querySelectorAll("[data-hk-popout-layer]")];
    expect(hosts.length).toBeGreaterThanOrEqual(1);
  });

  it("a click inside a nested popout does not dismiss the ancestor", async () => {
    const c = mountHost();
    // Open both layers.
    c.querySelector<HTMLButtonElement>(".outer-toggle")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await nextTick();
    await nextTick();
    // The outer panel content (including the inner toggle) teleports to
    // body — query there, not in the host container.
    document.body
      .querySelector<HTMLButtonElement>(".inner-toggle")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await nextTick();
    const innerBody = document.body.querySelector<HTMLElement>(".inner-body")!;
    expect(innerBody, "inner layer teleported to body").toBeTruthy();
    // The nested click: NOT a backdrop dismissal for the outer popover.
    innerBody.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await new Promise((r) => setTimeout(r, 60));
    expect(document.body.querySelector(".inner-body")).toBeTruthy();
    expect(document.body.querySelector(".outer-toggle")).toBeTruthy(); // outer panel content
  });

  it("a true outside click still dismisses the ancestor", async () => {
    const c = mountHost();
    c.querySelector<HTMLButtonElement>(".outer-toggle")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await nextTick();
    await nextTick();
    expect(document.body.querySelector(".inner-toggle")).toBeTruthy();
    // A click on plain body (no layer, no anchor): the classic dismissal.
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    await new Promise((r) => setTimeout(r, 60));
    expect(document.body.querySelector(".inner-toggle")).toBeNull();
  });
});
