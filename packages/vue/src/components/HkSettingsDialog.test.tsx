import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compile } from "sass";
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
    // The pane HOST is the scroll container; its viewport is the
    // scroller — the reset goes through the container's exposed
    // scrollTo handle, landing on the viewport.
    const pane = container.querySelector<HTMLElement>(".hk-settings__pane")!;
    const viewport = pane.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    viewport.scrollTop = 500;
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    items[1].click();
    await nextTick();
    await nextTick();
    expect(viewport.scrollTop).toBe(0);
    unmount();
  });

  it("renders the rail and pane as HkScrollContainers, the rail with the selection hint", async () => {
    // Scroll ownership (2026-10-21): both shell scrollers are hikari
    // HkScrollContainers (overlay-scrollbar contract) — the hosts keep
    // the shell BEM classes, their viewports scroll. The rail opts into
    // the selection edge hint, so its root mirrors the sensed
    // data-selection-beyond state (happy-dom's zero rects read as
    // "beyond both" — the pin is that the attribute exists at all).
    const { container, unmount } = mount(Host);
    const rail = container.querySelector<HTMLElement>(".hk-settings__rail")!;
    expect(rail.tagName).toBe("NAV");
    expect(rail.classList.contains("hk-scroll-container")).toBe(true);
    expect(rail.hasAttribute("data-selection-beyond")).toBe(true);
    // Rail entries sit INSIDE the rail's viewport (the scroller).
    expect(rail.querySelector(".hk-scroll-container-viewport .hk-settings__rail-item")).toBeTruthy();
    const pane = container.querySelector<HTMLElement>(".hk-settings__pane")!;
    expect(pane.classList.contains("hk-scroll-container")).toBe(true);
    expect(pane.querySelector(".hk-scroll-container-viewport")).toBeTruthy();
    // The pane never senses selection (the hint is rail-only).
    expect(pane.hasAttribute("data-selection-beyond")).toBe(false);
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

  it("anchors the scroll anatomy on the viewports, not the hosts (compiled)", () => {
    // Scroll ownership (2026-10-21): the rail/pane hosts became
    // HkScrollContainer hosts — the hosts stopped being their own
    // scrollers (no overflow-y, no gap/padding on the host rules) while
    // the viewport children took the column layout, the gaps and the
    // paddings whose home moved inside them, and the modal host's
    // canceled content inset sits on the viewport so the overlay track
    // still hugs the window edge. Pinned on the COMPILED sheet so SCSS
    // nesting cannot hide a regression.
    const css = compile("src/components/HkSettingsDialog.scss", { style: "expanded" }).css
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const rail = css.match(/\.hk-settings__rail\s*\{([^}]*)\}/)![0];
    expect(rail).toContain("width: 10.5rem");
    expect(rail).toContain("border-right");
    expect(rail).not.toMatch(/overflow|gap:|padding/);

    const railVp = css.match(/\.hk-settings__rail > \.hk-scroll-container-viewport\s*\{([^}]*)\}/)![0];
    expect(railVp).toContain("display: flex");
    expect(railVp).toContain("flex-direction: column");
    expect(railVp).toContain("gap: var(--space-2)");
    expect(railVp).toContain("padding: var(--space-4) var(--space-12) var(--space-4) 0");

    const pane = css.match(/\.hk-settings__pane\s*\{([^}]*)\}/)![0];
    expect(pane).not.toMatch(/overflow|gap:|padding/);
    const paneVp = css.match(/\.hk-settings__pane > \.hk-scroll-container-viewport\s*\{([^}]*)\}/)![0];
    expect(paneVp).toContain("display: flex");
    expect(paneVp).toContain("gap: var(--space-16)");

    // Modal host: the negative margin stays on the host; the content
    // inset it cancels lives INSIDE the viewport (desktop var plus the
    // <768px fallback, each exactly once).
    const hostPane = css.match(/\.hk-settings-host \.hk-settings__pane\s*\{([^}]*)\}/)![0];
    expect(hostPane).toContain("margin-right: calc(-1 * var(--hk-modal-padding-body, 1.5rem))");
    // No padding DECLARATION on the host (the var name above carries
    // the substring "padding" — the pin is about declarations).
    expect(hostPane).not.toMatch(/padding(-[a-z]+)?\s*:/);
    expect(css).toContain(".hk-settings-host .hk-settings__pane > .hk-scroll-container-viewport");
    expect(css.match(/padding-right:\s*var\(--space-28\)/g)).toHaveLength(1);
    expect(css.match(/padding-right:\s*var\(--space-20\)/g)).toHaveLength(1);
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
