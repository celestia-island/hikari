import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkModal from "./HkModal";

/**
 * HkModal footerLead slot contract tests:
 * - the named slot renders inside .hk-modal-footer BEFORE the action buttons,
 *   wrapped in .hk-modal-footer-lead, with the band marked .hk-modal-footer--lead
 * - the band still renders with ONLY a footerLead (no footerActions) — a lead
 *   alone must not vanish with the actions
 * - absent the slot, no new DOM appears (backward compat)
 * - the explicit `footer` slot keeps precedence over footerLead + footerActions
 *   (existing full-custom contract unchanged)
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
  footer: HTMLElement | null;
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
      // A FRESH slots object per Wrapper render: updateSlots mutates the
      // slots object it is handed (deleting keys absent from a later
      // sibling mount's shape), and a shared literal would lose footerLead
      // on re-render.
      return () =>
        h(HkModal, {
          ...props,
          modelValue: open.value,
          "onUpdate:modelValue": (v: boolean) => { open.value = v; },
        }, { ...slots });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  // HkModal teleports to body and sibling test files in this worker can
  // leave their own modals behind — scope to the NEWEST mounted footer
  // instead of the document-first match.
  const footers = document.querySelectorAll(".hk-modal-footer");
  return {
    container,
    footer: footers.length ? (footers[footers.length - 1] as HTMLElement) : null,
  };
}

describe("HkModal footerLead slot", () => {
  it("renders the lead before the action buttons inside the band", async () => {
    const { footer } = await mountModal(
      {
        title: "Config",
        footerActions: [{ label: "Add", variant: "primary" }],
      },
      { footerLead: () => h("button", { class: "lead-jump", "data-test": "jump" }, "JUMP") },
    );
    expect(footer).not.toBeNull();
    expect(footer?.classList.contains("hk-modal-footer--lead")).toBe(true);
    const lead = footer?.querySelector(".hk-modal-footer-lead");
    expect(lead).not.toBeNull();
    expect(lead?.querySelector(".lead-jump")?.textContent).toBe("JUMP");

    const children = footer ? Array.from(footer.children) : [];
    expect(children[0]?.classList.contains("hk-modal-footer-lead")).toBe(true);
    expect(children.length).toBe(2);
    expect(children[1]?.textContent).toBe("Add");
  });

  it("keeps the band alive with ONLY a footerLead and no actions", async () => {
    const { footer } = await mountModal(
      { title: "Config" },
      { footerLead: () => h("button", { class: "lead-jump" }, "JUMP") },
    );
    expect(footer).not.toBeNull();
    expect(footer?.classList.contains("hk-modal-footer--lead")).toBe(true);
    expect(footer?.querySelector(".hk-modal-footer-lead")).not.toBeNull();
    // No action buttons — the only children are the lead wrapper.
    const children = footer ? Array.from(footer.children) : [];
    expect(children).toHaveLength(1);
  });

  it("adds no lead DOM and no band when both lead and actions are absent", async () => {
    const { footer } = await mountModal({ title: "Config" });
    expect(footer).toBeNull();
  });

  it("the explicit footer slot keeps precedence over footerLead and actions", async () => {
    const { footer } = await mountModal(
      {
        title: "Config",
        footerActions: [{ label: "Add" }],
      },
      {
        footer: () => h("div", { class: "custom-footer" }, "CUSTOM"),
        footerLead: () => h("button", { class: "lead-jump" }, "JUMP"),
      },
    );
    expect(footer).not.toBeNull();
    expect(footer?.classList.contains("hk-modal-footer--lead")).toBe(false);
    expect(footer?.querySelector(".custom-footer")?.textContent).toBe("CUSTOM");
    expect(footer?.querySelector(".hk-modal-footer-lead")).toBeNull();
    expect(footer?.textContent).not.toContain("Add");
  });
});
