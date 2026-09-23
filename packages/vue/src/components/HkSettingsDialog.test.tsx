import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { Languages, Globe } from "lucide-vue-next";
import {
  HkSettingsBody as HSettingsBody,
  HkSettingsDialog as HSettingsDialog,
  HkSettingsGroup as HSettingsGroup,
  HkSettingsHint as HSettingsHint,
  HkSettingsSub as HSettingsSub,
} from "./HkSettingsDialog";

function mount(component: ReturnType<typeof defineComponent>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp(component);
  app.mount(container);
  return { container, unmount: () => { app.unmount(); container.remove(); } };
}

const SECTIONS = [
  { key: "language", label: "Language", icon: Languages },
  { key: "network", label: "Network", icon: Globe },
  { key: "locked", label: "Locked", disabled: true },
];

const Host = defineComponent({
  setup() {
    const section = ref("language");
    return () => (
      <HSettingsBody sections={SECTIONS} v-model:section={section.value}
        onUpdate:section={(v: string) => (section.value = v)}>
        {{
          language: () => <div data-test="pane-language">lang pane</div>,
          network: () => <div data-test="pane-network">net pane</div>,
          locked: () => <div data-test="pane-locked">locked pane</div>,
        }}
      </HSettingsBody>
    );
  },
});

describe("HSettingsBody", () => {
  it("renders every rail entry and the first section's pane", () => {
    const { container, unmount } = mount(Host);
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("Language");
    expect(items[0].querySelector(".hk-settings__rail-icon svg")).toBeTruthy();
    // First section active by default (internal state, unbound prop).
    expect(items[0].classList.contains("is-active")).toBe(true);
    expect(container.querySelector('[data-test="pane-language"]')).toBeTruthy();
    expect(container.querySelector('[data-test="pane-network"]')).toBeNull();
    unmount();
  });

  it("switches the pane on rail click and reports aria-current", async () => {
    const { container, unmount } = mount(Host);
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    items[1].click();
    await nextTick();
    expect(container.querySelector('[data-test="pane-network"]')).toBeTruthy();
    expect(items[1].getAttribute("aria-current")).toBe("true");
    expect(items[0].getAttribute("aria-current")).toBeNull();
    unmount();
  });

  it("never activates a disabled entry", async () => {
    const { container, unmount } = mount(Host);
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    expect(items[2].disabled).toBe(true);
    items[2].click();
    await nextTick();
    // Still on the first section.
    expect(container.querySelector('[data-test="pane-language"]')).toBeTruthy();
    expect(items[2].classList.contains("is-active")).toBe(false);
    unmount();
  });

  it("restarts the pane scroll on section switch", async () => {
    const scrolled = ref(false);
    const Probe = defineComponent({
      setup() {
        const section = ref("language");
        return () => (
          <HSettingsBody
            sections={SECTIONS.slice(0, 2)}
            section={section.value}
            onUpdate:section={(v: string) => (section.value = v)}
          >
            {{
              language: () => <div style="height: 2000px">lang</div>,
              network: () => <div style="height: 2000px">net</div>,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Probe);
    const pane = container.querySelector<HTMLElement>(".hk-settings__pane")!;
    pane.scrollTop = 500;
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    items[1].click();
    await nextTick();
    await nextTick();
    scrolled.value = pane.scrollTop === 0;
    expect(scrolled.value).toBe(true);
    unmount();
  });

  it("honors an externally driven section change (deep-link landing)", async () => {
    const section = ref("language");
    const Deep = defineComponent({
      setup() {
        return () => (
          <HSettingsBody sections={SECTIONS.slice(0, 2)} section={section.value}>
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Deep);
    section.value = "network";
    await nextTick();
    expect(container.querySelector('[data-test="pane-network"]')).toBeTruthy();
    unmount();
  });
});

describe("HSettingsDialog", () => {
  it("hosts the shell inside an open HModal and lands on the bound section", async () => {
    const section = ref("network");
    const Dialog = defineComponent({
      setup() {
        return () => (
          <HSettingsDialog
            modelValue
            title="Settings"
            sections={SECTIONS.slice(0, 2)}
            section={section.value}
            onUpdate:section={(v: string) => (section.value = v)}
          >
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsDialog>
        );
      },
    });
    const { unmount } = mount(Dialog);
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
    // HkModal teleports to document.body — the shell lives there, not in
    // the mount container.
    const host = document.body.querySelector(".hk-settings-host");
    expect(host).toBeTruthy();
    expect(host!.querySelector(".hk-settings__rail")).toBeTruthy();
    // The bound section won over the default-first.
    expect(host!.querySelector('[data-test="pane-network"]')).toBeTruthy();
    unmount();
  });
});

describe("settings content vocabulary", () => {
  it("renders group / sub / hint with their titles", () => {
    const { container, unmount } = mount(
      defineComponent({
        setup() {
          return () => (
            <HSettingsGroup title="Network">
              <HSettingsSub title="Proxy">
                <HSettingsHint>Applies to every request.</HSettingsHint>
              </HSettingsSub>
            </HSettingsGroup>
          );
        },
      }),
    );
    expect(container.querySelector(".hk-settings-group-title")!.textContent).toBe("Network");
    expect(container.querySelector(".hk-settings-sub-title")!.textContent).toBe("Proxy");
    expect(container.querySelector(".hk-settings-hint")!.textContent)
      .toContain("Applies to every request");
    unmount();
  });

  it("renders a group without a title (untitled card)", () => {
    const { container, unmount } = mount(
      defineComponent({
        setup() {
          return () => h(HSettingsGroup, null, { default: () => "body" });
        },
      }),
    );
    expect(container.querySelector(".hk-settings-group-title")).toBeNull();
    unmount();
  });
});

describe("settings dialog SCSS host contract (source-level)", () => {
  // The stable-frame contract is three rules in the SCSS that happy-dom's
  // cascade-free environment cannot exercise behaviorally — pin them at
  // the source so a silent deletion turns this red (the R1 mutation-d
  // gap). Known-positive control: the base rail rule every variant
  // depends on.
  // vitest serves modules through its own scheme, so import.meta.url is
  // not a file URL here; the suite's cwd is packages/vue.
  const scss = readFileSync("src/components/HkSettingsDialog.scss", "utf8");

  it("self-check: the extractor sees a rule that exists", () => {
    // The shell rules are BEM-nested in the source (&__rail-item inside
    // .hk-settings) — the positive control matches the nested form.
    expect(scss).toContain("&__rail-item {");
  });

  it("pins the stable-frame host rules (idle modal scrollbar, flush edge)", () => {
    expect(scss).toContain(".hk-settings-host .hk-modal-body-inner {");
    expect(scss).toContain("height: var(--hk-settings-height, calc(70vh - 6.5rem));");
    expect(scss).toContain("margin-right: calc(-1 * var(--hk-modal-padding-body, 1.5rem));");
  });

  it("never activates a disabled section through a deep-linked prop", async () => {
    const Deep = defineComponent({
      setup() {
        return () => (
          <HSettingsBody sections={SECTIONS} section="locked">
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
              locked: () => <div data-test="pane-locked" />,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Deep);
    await nextTick();
    // The disabled key did not win: first usable section shows, the
    // locked pane never renders, its rail entry stays grey.
    expect(container.querySelector('[data-test="pane-language"]')).toBeTruthy();
    expect(container.querySelector('[data-test="pane-locked"]')).toBeNull();
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    expect(items[2].classList.contains("is-active")).toBe(false);
    unmount();
  });
});
