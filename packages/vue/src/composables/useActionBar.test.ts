import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import {
  orderActionRegistrations,
  PageActionSlot,
  provideActionBar,
  useActionBar,
  type ActionBarRegistration,
} from "./useActionBar";

/**
 * The unified action bar's registration contract, exercised through real
 * mounts (no mock of the module under test; repo convention: raw
 * createApp + container queries, no @vue/test-utils dependency):
 * - a descendant's setActions/setCenter render into the layout's slots;
 * - the registration is per-component-scope — unmounting the registering
 *   view clears its registrations so a stale page's refresh button or
 *   filter group can never linger under the next page (the property the
 *   whole header-chrome design leans on);
 * - canonical slots render by rank regardless of registration order;
 *   customs stuff right-to-left (first-registered = rightmost);
 * - the identity guard keeps a leaving view's dispose from wiping the
 *   entering view's chrome (the crossfade instant).
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountApp(content: () => unknown) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ setup: () => content });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function makeView(tag: string, slot: string) {
  return defineComponent({
    name: `View-${tag}`,
    setup() {
      const bar = useActionBar();
      bar.setActions(() => [h("button", { class: `reg-action reg-${tag}` }, tag)], slot);
      return () => h("div", { class: `view-body view-${tag}` }, "view");
    },
  });
}

function makeCenterView(tag: string) {
  return defineComponent({
    name: `CenterView-${tag}`,
    setup() {
      const bar = useActionBar();
      bar.setCenter(() => [h("nav", { class: `reg-center reg-center-${tag}` }, tag)]);
      return () => h("div", { class: `view-body view-${tag}` }, "view");
    },
  });
}

function makeLayout(views: () => unknown[]) {
  return defineComponent({
    name: "Layout",
    setup() {
      const bar = provideActionBar();
      return () => [
        h("div", { class: "layout-actions" }, bar.actions.value.flatMap((r) => r())),
        views(),
        h("div", { class: "layout-center" }, bar.center.value?.() ?? []),
      ];
    },
  });
}

async function mountWithViews(views: () => unknown[]) {
  const container = mountApp(() => h(makeLayout(views)));
  await nextTick();
  return container;
}

function registeredButtons(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".layout-actions .reg-action")).map(
    (b) => b.textContent ?? "",
  );
}

describe("useActionBar", () => {
  it("renders a descendant's registered actions and centre group", async () => {
    // Built ONCE outside the render fn — a component created per render
    // remounts (and re-registers) on every layout update, the infinite
    // register/update loop, not the contract under test.
    const view = makeView("refresh", PageActionSlot.Refresh);
    const centerView = makeCenterView("filter");
    const container = await mountWithViews(() => [h(view), h(centerView)]);
    expect(container.querySelector(".layout-actions .reg-action")?.textContent).toBe("refresh");
    expect(container.querySelector(".layout-center .reg-center")?.textContent).toBe("filter");
    // The view body renders too — the probes mirror, never replace.
    expect(container.querySelector(".view-body")).not.toBeNull();
  });

  it("leaves both slots empty when the view registers nothing", async () => {
    const bare = defineComponent({
      name: "BareView",
      setup: () => () => h("div", { class: "view-body" }, "view"),
    });
    const container = await mountWithViews(() => [h(bare)]);
    expect(container.querySelector(".layout-actions .reg-action")).toBeNull();
    expect(container.querySelector(".layout-center .reg-center")).toBeNull();
  });

  it("clears the registrations when the registering view unmounts", async () => {
    const show = ref(true);
    // Built ONCE outside the render fn: a component created per render
    // would remount (and re-register) on every layout update — an
    // infinite register/update loop, not the contract under test.
    const view = makeView("refresh", PageActionSlot.Refresh);
    const centerView = makeCenterView("filter");
    const container = await mountWithViews(() =>
      show.value ? [h(view), h(centerView)] : [],
    );
    expect(container.querySelector(".layout-actions .reg-action")).not.toBeNull();
    expect(container.querySelector(".layout-center .reg-center")).not.toBeNull();

    // The page switches: the view unmounts and its chrome must go with
    // it — both slots, not just the actions.
    show.value = false;
    await nextTick();
    expect(container.querySelector(".layout-actions .reg-action")).toBeNull();
    expect(container.querySelector(".layout-center .reg-center")).toBeNull();
  });

  it("renders one page's several affordances in SLOT order, not call order", async () => {
    // The composition contract: a page registering its filter trigger
    // and then its refresh gets [filter][refresh] left-to-right — and
    // one that registers refresh first and create last still gets the
    // canonical rank order [create][filter][refresh].
    const view = defineComponent({
      name: "DualView",
      setup() {
        const bar = useActionBar();
        bar.setActions(
          () => [h("button", { class: "reg-action reg-filter" }, "filter")],
          PageActionSlot.Filter,
        );
        bar.setActions(
          () => [h("button", { class: "reg-action reg-refresh" }, "refresh")],
          PageActionSlot.Refresh,
        );
        return () => h("div", { class: "view-body" }, "view");
      },
    });
    const container = await mountWithViews(() => [h(view)]);
    expect(registeredButtons(container)).toEqual(["filter", "refresh"]);
  });

  it("places a late-registered create LEFTMOST (rank beats call order)", async () => {
    const view = defineComponent({
      name: "LateCreateView",
      setup() {
        const bar = useActionBar();
        bar.setActions(
          () => [h("button", { class: "reg-action reg-refresh" }, "refresh")],
          PageActionSlot.Refresh,
        );
        bar.setActions(
          () => [h("button", { class: "reg-action reg-create" }, "create")],
          PageActionSlot.Create,
        );
        return () => h("div", { class: "view-body" }, "view");
      },
    });
    const container = await mountWithViews(() => [h(view)]);
    expect(registeredButtons(container)).toEqual(["create", "refresh"]);
  });

  it("is a silent no-op outside any layout provider", async () => {
    // Views render in tests (and anywhere without a layout) without a
    // provider: registering must neither throw nor render anything.
    const container = mountApp(() => h(makeView("refresh", PageActionSlot.Refresh)));
    await nextTick();
    expect(container.querySelector(".reg-action")).toBeNull();
    expect(container.querySelector(".view-body")).not.toBeNull();
  });

  it("keeps the SURVIVING registration when an overlapped view unmounts (identity guard)", async () => {
    // The crossfade property the whole header design leans on: during a
    // page transition the entering and leaving views are alive at the
    // same instant, so the entering view registers OVER the leaving one
    // and then the leaving one disposes. The per-scope clear must fire
    // only for ITS OWN renderer — an unconditional clear would wipe the
    // entering page's chrome the moment the leaving view unmounts.
    const showA = ref(true);
    const showB = ref(true);
    const viewA = makeView("a", "custom");
    const viewB = makeView("b", "custom");
    const container = await mountWithViews(() => [
      showA.value ? h(viewA) : null,
      showB.value ? h(viewB) : null,
    ]);
    // Both alive (the crossfade instant): registrations are ADDITIVE —
    // both pages' buttons render. Both declare the CUSTOM slot, so the
    // stuffing rule orders them right-to-left: first-registered (a) is
    // RIGHTMOST → visual order [b, a].
    expect(registeredButtons(container)).toEqual(["b", "a"]);

    // The LEAVING view (a — registered first) unmounts after b took
    // over: b's chrome must survive a's disposal (the identity guard —
    // an unconditional clear here wipes the entering page's header).
    showA.value = false;
    await nextTick();
    expect(registeredButtons(container)).toEqual(["b"]);

    // Then b leaves too: only now does the slot go empty.
    showB.value = false;
    await nextTick();
    expect(registeredButtons(container)).toEqual([]);
  });

  it("keeps the SURVIVING centre when an overlapped view unmounts (centre identity guard)", async () => {
    // setCenter's dispose must clear only when ITS OWN renderer is
    // still the current one — a later view's centre must survive the
    // earlier view's unmount.
    const showA = ref(true);
    const showB = ref(true);
    const centerA = makeCenterView("a");
    const centerB = makeCenterView("b");
    const container = await mountWithViews(() => [
      showA.value ? h(centerA) : null,
      showB.value ? h(centerB) : null,
    ]);
    // B registered last — B owns the centre slot now.
    expect(container.querySelector(".layout-center .reg-center")?.textContent).toBe("b");

    showA.value = false;
    await nextTick();
    expect(container.querySelector(".layout-center .reg-center")?.textContent).toBe("b");

    showB.value = false;
    await nextTick();
    expect(container.querySelector(".layout-center .reg-center")).toBeNull();
  });
});

describe("orderActionRegistrations (slot ranks + right-to-left customs)", () => {
  function reg(slot: string, seq: number): ActionBarRegistration {
    return { renderer: () => [], slot, seq };
  }

  it("orders the canonical slots by rank regardless of registration order", () => {
    const out = orderActionRegistrations([
      reg("refresh", 0),
      reg("custom-x", 1),
      reg("filter", 2),
      reg("create", 3),
    ]);
    expect(out.map((r) => r.slot)).toEqual(["create", "filter", "refresh", "custom-x"]);
  });

  it("ranks the window slot right of the refresh, left of customs", () => {
    // The secondary-window opener is canonical:
    // [create][filter][search][refresh][window] — regardless of the
    // order the page registered them in.
    const out = orderActionRegistrations([
      reg("window", 0),
      reg("refresh", 1),
      reg("search", 2),
      reg("custom-x", 3),
      reg("filter", 4),
      reg("create", 5),
    ]);
    expect(out.map((r) => r.slot)).toEqual([
      "create",
      "filter",
      "search",
      "refresh",
      "window",
      "custom-x",
    ]);
  });

  it("stuffs customs right-to-left: the FIRST-registered custom is rightmost", () => {
    // The customs zone grows LEFTWARD (user rule 2026-10-11): the right
    // edge takes the first arrival, later customs land to its left.
    const out = orderActionRegistrations([
      reg("create", 0),
      reg("first", 1),
      reg("second", 2),
      reg("third", 3),
    ]);
    expect(out.map((r) => r.slot)).toEqual(["create", "third", "second", "first"]);
  });

  it("keeps same-slot registrations stable by sequence", () => {
    const out = orderActionRegistrations([reg("create", 5), reg("create", 2)]);
    expect(out.map((r) => r.seq)).toEqual([2, 5]);
  });
});
