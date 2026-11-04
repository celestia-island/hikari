import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";

import HkModelCard from "./HkModelCard";

/**
 * HkModelCard anatomy + state guards.
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountCard(
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {},
): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Wrapper = defineComponent({
    setup() {
      return () => h(HkModelCard, props, slots);
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  const root = container.querySelector<HTMLElement>(".hk-model-card");
  expect(root, ".hk-model-card renders").toBeTruthy();
  return root!;
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
});

describe("HkModelCard anatomy", () => {
  it("renders the top lane with title and actions content", () => {
    const root = mountCard(
      {},
      {
        title: () => h("span", { class: "t" }, "GLM 5.3"),
        actions: () => h("button", { class: "a" }, "on"),
      },
    );
    expect(root.querySelector(".hk-model-card-top")).toBeTruthy();
    expect(root.querySelector(".hk-model-card-leading .t")?.textContent).toBe("GLM 5.3");
    expect(root.querySelector(".hk-model-card-actions .a")).toBeTruthy();
  });

  it("collapses caption and footer when their slots are empty", () => {
    const root = mountCard({}, { title: () => h("span", "m") });
    expect(root.querySelector(".hk-model-card-caption")).toBeNull();
    expect(root.querySelector(".hk-model-card-footer")).toBeNull();
  });

  it("renders caption and footer lanes when they carry content", () => {
    const root = mountCard(
      {},
      {
        title: () => h("span", "m"),
        caption: () => "zai",
        footer: () => h("span", { class: "f" }, "200.0k"),
      },
    );
    expect(root.querySelector(".hk-model-card-caption")?.textContent).toBe("zai");
    expect(root.querySelector(".hk-model-card-footer .f")?.textContent).toBe("200.0k");
  });

  it("treats a comment-placeholder slot (consumer v-if) as empty", () => {
    const show = ref(false);
    const root = mountCard(
      {},
      {
        title: () => h("span", "m"),
        caption: () => (show.value ? h("span", "shown") : null),
      },
    );
    // A null-render slot produces only the comment placeholder — the
    // caption lane must collapse, not render an empty row.
    expect(root.querySelector(".hk-model-card-caption")).toBeNull();
  });

  it("treats a fragment of dead v-if comments as empty (the JSX <>{cond && …}</> shape)", () => {
    const show = ref(false);
    const slotsOf = () => ({
      title: () => h("span", "m"),
      // The compiled shape of a consumer's conditional footer is a
      // Fragment vnode whose children are dead comment placeholders —
      // the guard must recurse into it, not stop at the Fragment.
      footer: () => (<>{show.value && <span class="live" />}</>),
    });
    // All-dead fragment → the footer lane collapses.
    expect(mountCard({}, slotsOf()).querySelector(".hk-model-card-footer")).toBeNull();
    // A fragment with live content still renders its lane.
    show.value = true;
    const live = mountCard({}, slotsOf());
    expect(live.querySelector(".hk-model-card-footer .live")?.textContent).toBe("");
  });
});

describe("HkModelCard state attributes", () => {
  it("lands the tier as data-tier", () => {
    expect(mountCard({ tier: "deep" }, {}).dataset.tier).toBe("deep");
    expect(mountCard({ tier: "normal" }, {}).dataset.tier).toBe("normal");
    expect(mountCard({ tier: "basic" }, {}).dataset.tier).toBe("basic");
  });

  it("an absent tier lands no data-tier at all", () => {
    expect(mountCard({}, {}).hasAttribute("data-tier")).toBe(false);
  });

  it("hoverable is the default and drops out when disabled", () => {
    expect(mountCard({}, {}).hasAttribute("data-hoverable")).toBe(true);
    expect(mountCard({ disabled: true }, {}).hasAttribute("data-hoverable")).toBe(false);
    expect(mountCard({ hoverable: false }, {}).hasAttribute("data-hoverable")).toBe(false);
  });

  it("disabled lands the dim marker, interactive lands its marker", () => {
    expect(mountCard({ disabled: true }, {}).hasAttribute("data-disabled")).toBe(true);
    expect(mountCard({ interactive: true }, {}).hasAttribute("data-interactive")).toBe(true);
    // interactive + disabled: the dim wins, the clickability marker goes.
    expect(mountCard({ interactive: true, disabled: true }, {}).hasAttribute("data-interactive")).toBe(false);
  });
});

describe("HkModelCard interaction", () => {
  it("emits click with the native event", () => {
    let seen: MouseEvent | null = null;
    const root = mountCard(
      { onClick: (e: MouseEvent) => (seen = e) },
      { title: () => h("span", "m") },
    );
    root.querySelector<HTMLElement>(".hk-model-card-leading")!.click();
    expect(seen).toBeInstanceOf(MouseEvent);
  });
});
