import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type Ref } from "vue";

import HkPopover from "./HkPopover";

/**
 * HkPopover Escape precedence (the same class as HkModal 0.55.295 and the
 * HkDrawer / HkImageLightbox siblings).
 *
 * The popover panel hosts the consumer's DEFAULT SLOT, so it is a
 * composition surface: a control inside it may consume Escape first
 * (HkRangeRibbon resetting a brushed range, a date-picker trigger, a tag
 * search). The popover must honour that consumption instead of closing the
 * panel underneath the control. Its own consumption is unchanged — when it
 * does close it still preventDefaults and still does not stopPropagation.
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body
    .querySelectorAll(".hk-popover-panel, .hk-popover-scrim")
    .forEach((el) => el.remove());
});

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

interface Setup {
  open: Ref<boolean>;
  emitted: boolean[];
  panel: () => HTMLElement | null;
  owner: () => HTMLElement | null;
}

function mountPopover(options: { closeOnEscape?: boolean } = {}): Setup {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const open = ref(true);
  const emitted: boolean[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkPopover as never, {
          modelValue: open.value,
          title: "probe",
          closeOnEscape: options.closeOnEscape ?? true,
          "onUpdate:modelValue": (v: boolean) => { emitted.push(v); open.value = v; },
        }, {
          default: () => h("div", {
            class: "escape-owner",
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === "Escape") e.preventDefault();
            },
          }, "nested control"),
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  return {
    open,
    emitted,
    panel: () => document.body.querySelector<HTMLElement>(".hk-popover-panel"),
    owner: () => document.body.querySelector<HTMLElement>(".hk-popover-panel .escape-owner"),
  };
}

describe("HkPopover Escape precedence", () => {
  it("lets a nested slot control own Escape", async () => {
    const s = mountPopover();
    await settle();
    const owner = s.owner();
    expect(owner, "the slot control renders inside the panel").not.toBeNull();

    // `cancelable: true` is load-bearing: preventDefault() on a
    // non-cancelable synthetic event is a no-op, and the popover would then
    // close as if nothing had consumed the key.
    owner!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await settle();

    expect(s.emitted, "a consumed Escape must not close the popover").toEqual([]);
    expect(s.open.value).toBe(true);
    expect(s.panel(), "the panel stays mounted").not.toBeNull();
  });

  it("a bare Escape still closes, is consumed, and is not stopPropagation'd", async () => {
    const s = mountPopover();
    await settle();
    const panel = s.panel();
    expect(panel, "the panel renders").not.toBeNull();

    const bare = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    let propagatedToDocument = false;
    const onDocumentKeydown = () => {
      propagatedToDocument = true;
    };
    document.addEventListener("keydown", onDocumentKeydown);
    try {
      panel!.dispatchEvent(bare);
    } finally {
      document.removeEventListener("keydown", onDocumentKeydown);
    }
    await settle();

    expect(s.emitted).toEqual([false]);
    expect(s.open.value).toBe(false);
    // The popover's own consumption, unchanged by the precedence guard.
    expect(bare.defaultPrevented, "the popover still consumes the key it acts on").toBe(true);
    expect(propagatedToDocument, "the popover still does not stopPropagation").toBe(true);
  });

  it("closeOnEscape=false never closes, bare or consumed", async () => {
    const s = mountPopover({ closeOnEscape: false });
    await settle();
    const owner = s.owner();
    const panel = s.panel();
    expect(owner, "the slot control renders inside the panel").not.toBeNull();
    expect(panel, "the panel renders").not.toBeNull();

    // A consumed Escape changes nothing either way. This also pins the
    // invariant that lets a future refactor hoist the defaultPrevented
    // guard above the closeOnEscape check safely: close() must stay gated
    // on the prop, and this case proves that gate is load-bearing.
    owner!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    await settle();

    const bare = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    panel!.dispatchEvent(bare);
    await settle();

    expect(s.emitted).toEqual([]);
    expect(s.open.value).toBe(true);
    expect(bare.defaultPrevented, "no close => no consumption").toBe(false);
  });
});
