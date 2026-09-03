import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";

/**
 * HkModal headerLead slot contract tests:
 * - the named slot renders inside .hk-modal-header BEFORE the title
 * - absent the slot, no new DOM appears (backward compat)
 * (Existing HkModal tests keep the title/closable/back-guard coverage.)
 */
const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

interface Harness {
  container: HTMLElement;
  header: HTMLElement | null;
}

async function mountModal(
  props: Record<string, unknown>,
  slots: Record<string, unknown> = {},
): Promise<Harness> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const open = ref(true);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkModal, {
          ...props,
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
        }, slots);
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  return {
    container,
    header: document.querySelector(".hk-modal-header"),
  };
}

describe("HkModal headerLead slot", () => {
  it("renders the lead content before the modal title", async () => {
    const { header } = await mountModal(
      { title: "Session" },
      { headerLead: () => h("span", { class: "lead-x", "data-test": "ring" }, "LEAD") },
    );
    expect(header).not.toBeNull();
    const lead = header?.querySelector(".hk-modal-header-lead");
    expect(lead).not.toBeNull();
    expect(lead?.querySelector(".lead-x")?.textContent).toBe("LEAD");
    const children = header ? Array.from(header.children) : [];
    expect(children[0]?.classList.contains("hk-modal-header-lead")).toBe(true);
    expect(children[1]?.classList.contains("hk-modal-title")).toBe(true);
    expect(children[1]?.textContent).toBe("Session");
  });

  it("keeps the close button as the last header child", async () => {
    const { header } = await mountModal(
      { title: "Session", closable: true },
      { headerLead: () => h("span", "LEAD") },
    );
    const children = header ? Array.from(header.children) : [];
    const last = children[children.length - 1];
    expect(last?.classList.contains("hk-modal-close")).toBe(true);
  });

  it("adds no new DOM when the slot is absent", async () => {
    const { header } = await mountModal({ title: "Session" });
    expect(header).not.toBeNull();
    expect(header?.querySelector(".hk-modal-header-lead")).toBeNull();
    const children = header ? Array.from(header.children) : [];
    expect(children[0]?.classList.contains("hk-modal-title")).toBe(true);
  });

  it("shows the header for a title-less modal carrying only headerLead", async () => {
    const { header } = await mountModal(
      { title: undefined, closable: false },
      { headerLead: () => h("span", "LEAD") },
    );
    expect(header).not.toBeNull();
    expect(header?.querySelector(".hk-modal-header-lead")).not.toBeNull();
  });
});
