import { describe, expect, it, afterEach } from "vitest";
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
    // The pane is an HkScrollContainer: the scroller is its viewport
    // (the root only clips), so the reset contract is read there.
    const pane = container.querySelector<HTMLElement>(".hk-settings__pane")!;
    const viewport = pane.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    expect(viewport).toBeTruthy();
    viewport.scrollTop = 500;
    const items = container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    items[1].click();
    await nextTick();
    await nextTick();
    scrolled.value = viewport.scrollTop === 0;
    expect(scrolled.value).toBe(true);
    unmount();
  });

  it("renders the rail and the pane as HkScrollContainers (overlay scrollbar contract)", () => {
    const { container, unmount } = mount(Host);
    // Scroll ownership (2026-10-27): the native thin bars are gone and the
    // shared overlay chrome draws instead — pinned at the source because
    // happy-dom cannot exercise the cascade that hides the native bar.
    const rail = container.querySelector(".hk-settings__rail")!;
    const pane = container.querySelector(".hk-settings__pane")!;
    expect(rail.classList.contains("hk-scroll-container")).toBe(true);
    expect(pane.classList.contains("hk-scroll-container")).toBe(true);
    expect(rail.querySelector(".hk-scroll-container-viewport")).toBeTruthy();
    expect(pane.querySelector(".hk-scroll-container-viewport")).toBeTruthy();
    // The rail stays a navigation landmark through the `as` prop. Without
    // a navLabel the landmark is unnamed (the fixture passes none) — the
    // positive naming contract is its own case below.
    expect(rail.tagName).toBe("NAV");
    expect(rail.getAttribute("aria-label")).toBeNull();
    // The rail opts into the selection edge hint, so its root mirrors the
    // sensed data-selection-beyond state (happy-dom's zero rects read as
    // beyond-band — the pin is that the attribute exists at all). The
    // pane never senses selection: the hint is rail-only by design.
    expect(rail.hasAttribute("data-selection-beyond")).toBe(true);
    expect(pane.hasAttribute("data-selection-beyond")).toBe(false);
    unmount();
  });

  it("lands a provided navLabel on the rail landmark (attr fallthrough)", () => {
    // The rail is an HkScrollContainer rendered `as="nav"`: the accessible
    // name travels through the component's attribute fallthrough onto the
    // container root — the machinery this refactor introduced, so pin it.
    const Named = defineComponent({
      setup() {
        return () => (
          <HSettingsBody sections={SECTIONS.slice(0, 2)} navLabel="Settings sections">
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Named);
    const rail = container.querySelector(".hk-settings__rail")!;
    expect(rail.tagName).toBe("NAV");
    expect(rail.getAttribute("aria-label")).toBe("Settings sections");
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

  it("re-anchors the shell vocabulary into the viewports (scroll ownership)", () => {
    // Scroll ownership (2026-10-27): the paddings/gaps moved into the
    // scroll containers' viewports so the overlay tracks hug the regions'
    // border edges — the paired-class rules are the contract's home.
    expect(scss).toContain("&__rail.hk-scroll-container > .hk-scroll-container-viewport {");
    expect(scss).toContain("&__pane.hk-scroll-container > .hk-scroll-container-viewport {");
    // The regions themselves must NOT scroll natively any more — scoped
    // to their own blocks, not the whole file (a future rule elsewhere
    // may legitimately want overflow-y: auto).
    for (const region of ["&__rail {", "&__pane {"]) {
      const start = scss.indexOf(region);
      expect(start, `${region} block located`).toBeGreaterThan(-1);
      const block = scss.slice(start, scss.indexOf("}", start));
      expect(block, `${region} must not scroll natively`).not.toContain("overflow-y");
    }
    // The dialog inset lives inside the pane's viewport, not on the root.
    expect(scss).toContain("& > .hk-scroll-container-viewport {\n    padding-right: var(--space-28);");
  });

  it("keeps the flush-edge margin width-correct (desktop var, mobile hard-coded)", () => {
    // The desktop margin cancels the var-chained body padding; the mobile
    // arm must exist because HkModal hard-codes 1rem under 768px without
    // the var — dropping it over-cancels by 8px and clips the whole
    // overlay track out of the phone sheet (R2 2026-10-27).
    expect(scss).toContain("margin-right: calc(-1 * var(--hk-modal-padding-body, 1.5rem));");
    const hostBlock = scss.slice(scss.indexOf(".hk-settings-host .hk-settings__pane {"));
    expect(hostBlock).toContain("@media (max-width: 767px) {\n    margin-right: -1rem;\n  }");
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

describe("phone shell (rail → top tab strip, 2026-10-28 user direction)", () => {
  const originalWidth = window.innerWidth;

  const setWidth = (w: number) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: w,
    });
    window.dispatchEvent(new Event("resize"));
  };

  afterEach(() => setWidth(originalWidth));

  it("renders the top strip instead of the rail under the mobile breakpoint", () => {
    setWidth(390);
    const { container, unmount } = mount(Host);
    // The rail is gone; the strip carries every section as a trigger and
    // the shell marks the column layout for the SCSS.
    expect(container.querySelector(".hk-settings__rail")).toBeNull();
    expect(container.querySelector(".hk-settings")!.hasAttribute("data-phone")).toBe(true);
    const triggers = container.querySelectorAll<HTMLButtonElement>(
      ".hk-settings__topnav .hk-tabs-trigger",
    );
    expect(triggers).toHaveLength(3);
    expect(triggers[0].textContent).toContain("Language");
    // Icons ride one notch up with the strip (18 vs the rail's 16).
    expect(triggers[0].querySelector(".hk-tabs-trigger-icon svg")).toBeTruthy();
    expect(container.querySelector('[data-test="pane-language"]')).toBeTruthy();
    unmount();
  });

  it("switches sections from the strip and reports selection", async () => {
    setWidth(390);
    const { container, unmount } = mount(Host);
    const triggers = container.querySelectorAll<HTMLButtonElement>(
      ".hk-settings__topnav .hk-tabs-trigger",
    );
    triggers[1].click();
    await nextTick();
    expect(container.querySelector('[data-test="pane-network"]')).toBeTruthy();
    expect(triggers[1].getAttribute("aria-selected")).toBe("true");
    // The strip's pill semantics: inactive triggers carry "false", not
    // the attribute's absence.
    expect(triggers[0].getAttribute("aria-selected")).toBe("false");
    unmount();
  });

  it("never activates a disabled section from the strip", async () => {
    setWidth(390);
    const { container, unmount } = mount(Host);
    const triggers = container.querySelectorAll<HTMLButtonElement>(
      ".hk-settings__topnav .hk-tabs-trigger",
    );
    expect(triggers[2].disabled).toBe(true);
    triggers[2].click();
    await nextTick();
    expect(container.querySelector('[data-test="pane-language"]')).toBeTruthy();
    expect(triggers[2].getAttribute("aria-selected")).toBe("false");
    unmount();
  });

  it("flips live when the viewport crosses the breakpoint", async () => {
    // Start desktop: the rail is the nav.
    const { container, unmount } = mount(Host);
    expect(container.querySelector(".hk-settings__rail")).toBeTruthy();
    expect(container.querySelector(".hk-settings__topnav")).toBeNull();
    setWidth(390);
    await nextTick();
    expect(container.querySelector(".hk-settings__topnav")).toBeTruthy();
    expect(container.querySelector(".hk-settings__rail")).toBeNull();
    // …and back.
    setWidth(1024);
    await nextTick();
    expect(container.querySelector(".hk-settings__rail")).toBeTruthy();
    expect(container.querySelector(".hk-settings__topnav")).toBeNull();
    unmount();
  });

  it("lands navLabel on the strip's tablist", () => {
    setWidth(390);
    const Named = defineComponent({
      setup() {
        return () => (
          <HSettingsBody sections={SECTIONS.slice(0, 2)} navLabel="Settings sections">
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Named);
    const list = container.querySelector(".hk-settings__topnav .hk-tabs-list");
    expect(list).toBeTruthy();
    expect(list!.getAttribute("role")).toBe("tablist");
    expect(list!.getAttribute("aria-label")).toBe("Settings sections");
    unmount();
  });

  it("never shows a disabled-first section as selected (either nav)", async () => {
    // R2 2026-10-28: the landing default is the first USABLE key — a
    // disabled-first host must not open on the dead entry, and the phone
    // strip must not frame it aria-selected while the desktop rail
    // highlights nothing.
    const LockedFirst = defineComponent({
      setup() {
        return () => (
          <HSettingsBody
            sections={[
              { key: "locked", label: "Locked", disabled: true },
              { key: "network", label: "Network", icon: Globe },
            ]}
          >
            {{
              locked: () => <div data-test="pane-locked" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsBody>
        );
      },
    });
    // Desktop: the rail never marks the dead entry active.
    const desktop = mount(LockedFirst);
    const railItems = desktop.container.querySelectorAll<HTMLButtonElement>(".hk-settings__rail-item");
    expect(railItems[0].classList.contains("is-active")).toBe(false);
    expect(railItems[1].classList.contains("is-active")).toBe(true);
    desktop.unmount();
    // Phone: the strip's dead trigger stays unselected; the usable one
    // carries the selection and its pane renders.
    setWidth(390);
    const phone = mount(LockedFirst);
    const triggers = phone.container.querySelectorAll<HTMLButtonElement>(
      ".hk-settings__topnav .hk-tabs-trigger",
    );
    expect(triggers[0].getAttribute("aria-selected")).toBe("false");
    expect(triggers[1].getAttribute("aria-selected")).toBe("true");
    expect(phone.container.querySelector('[data-test="pane-network"]')).toBeTruthy();
    phone.unmount();
  });

  it("round-trips strip picks to a bound section prop (controlled contract)", async () => {
    // The pane follows internal state, so a deleted update:section emit
    // would be invisible to an unbound host — pin the controlled half.
    setWidth(390);
    const section = ref("language");
    const Controlled = defineComponent({
      setup() {
        return () => (
          <HSettingsBody
            sections={SECTIONS.slice(0, 2)}
            section={section.value}
            onUpdate:section={(v: string) => (section.value = v)}
          >
            {{
              language: () => <div data-test="pane-language" />,
              network: () => <div data-test="pane-network" />,
            }}
          </HSettingsBody>
        );
      },
    });
    const { container, unmount } = mount(Controlled);
    const triggers = container.querySelectorAll<HTMLButtonElement>(
      ".hk-settings__topnav .hk-tabs-trigger",
    );
    triggers[1].click();
    await nextTick();
    expect(section.value).toBe("network");
    unmount();
  });

  it("pins the phone layout contract in the SCSS source", () => {
    // happy-dom cannot exercise the cascade: pin the column flip, the
    // gap, the centering and the one-notch-up sizing at the source. The
    // assertions read INSIDE the &[data-phone] block — several of these
    // declarations also exist elsewhere in the sheet, and a bare
    // toContain would keep passing after the phone rule dies (R2).
    const scss = readFileSync("src/components/HkSettingsDialog.scss", "utf8");
    const phoneBlock = scss.slice(
      scss.indexOf("&[data-phone] {"),
      scss.indexOf("Dialog host"),
    );
    expect(phoneBlock).toContain("flex-direction: column;");
    expect(phoneBlock).toContain("gap: var(--space-12);");
    expect(phoneBlock).toContain("> .hk-settings__topnav {");
    expect(phoneBlock).toContain("justify-content: center;");
    expect(phoneBlock).toContain("padding: var(--space-6) var(--space-14);");
    expect(phoneBlock).toContain("font-size: var(--text-base);");
  });
});
