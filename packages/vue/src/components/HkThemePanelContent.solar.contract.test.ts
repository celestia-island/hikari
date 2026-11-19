/**
 * HkThemePanelContent × solar editor wiring (2026-11-19 user direction):
 * the strategy card retires from hosts' mode-extra strips; the AUTO
 * option of the color-mode group carries the entry instead — a
 * hover-revealed ⋯ action plus a right-click menu item, both opening
 * the built-in HkSolarLocationEditor. The entry is DELIBERATELY HIDDEN
 * outside auto mode (非 auto 直接隐藏), and applying fires
 * `solar-applied` for the host's toast.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

import { HkThemePanelContent } from "./HkThemePanelContent";
import HkContextMenuProvider from "./HkContextMenuProvider";
import { setLocale } from "../i18n/context";
import {
  setSolarLocationStrategy,
  setSolarManualLocation,
  resetSolarIpInsight,
} from "../theme/useSolarTime";
import { useTheme } from "../theme/useTheme";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** nextTick + a real macrotask + nextTick — the tab strip's swap
 *  transitions resolve through a ~1ms fallback timer, so assertions
 *  that follow any option/cell change need the extra window (same
 *  grammar HkThemeToggle.test uses). */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await nextTick();
}

function resetEngineState(): void {
  setSolarLocationStrategy("timezone");
  setSolarManualLocation(null);
  resetSolarIpInsight();
  // The entry only exists in AUTO ("system"); every case starts there.
  useTheme().setMode("system");
}

interface HostOptions {
  solarEditor: boolean;
  onSolarApplied?: () => void;
}

function mountPanel(options: HostOptions): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Host = defineComponent({
    name: "SolarPanelHost",
    setup() {
      return () =>
        h(HkContextMenuProvider, null, {
          default: () =>
            h(HkThemePanelContent, {
              externalCustomize: true,
              solarEditor: options.solarEditor,
              onSolarApplied: options.onSolarApplied,
            }),
        });
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

const solarAction = () =>
  document.querySelector<HTMLElement>('[data-test="hk-tabs-action-system-solar"]');

beforeEach(() => {
  resetEngineState();
});

afterEach(() => {
  for (const { app } of mounts.splice(0)) app.unmount();
  document
    .querySelectorAll(".hk-select-popout, .hk-select-sheet-panel, .hk-modal")
    .forEach((el) => el.remove());
});

describe("HkThemePanelContent solar editor entry", () => {
  it("mounts the ⋯ action on the AUTO option only when the prop asks for it", () => {
    const withProp = mountPanel({ solarEditor: true });
    expect(solarAction()).toBeTruthy();
    withProp.remove();
    for (const { app } of mounts.splice(0)) app.unmount();

    const withoutProp = mountPanel({ solarEditor: false });
    expect(solarAction()).toBeNull();
    withoutProp.remove();
  });

  it("hides the entry entirely outside auto mode (非 auto 直接隐藏)", async () => {
    const container = mountPanel({ solarEditor: true });
    expect(solarAction()).toBeTruthy();
    useTheme().setMode("light");
    await settle();
    expect(solarAction()).toBeNull();
    // No dead right-click either: the trigger carries no binding.
    const trigger = container.querySelector<HTMLElement>(".hk-tabs-trigger")!;
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 6, clientY: 6 });
    trigger.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(false);
  });

  it("the ⋯ action opens the built-in editor; applying fires solar-applied", async () => {
    const applied = vi.fn();
    const container = mountPanel({ solarEditor: true, onSolarApplied: applied });
    await setLocale("zh-Hans");
    await nextTick();
    solarAction()!.click();
    await settle();
    // The extracted editor's modal is in the document.
    expect(document.querySelector(".hk-solar-editor")).toBeTruthy();
    // Apply (IP strategy — no manual pane involvement, engine-visible).
    const apply = Array.from(document.querySelectorAll<HTMLElement>(".hk-modal-footer button"))
      .find((b) => b.textContent?.includes("应用"));
    expect(apply).toBeTruthy();
    apply!.click();
    await settle();
    expect(applied).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".hk-solar-editor")).toBeNull();
    await setLocale("en");
  });

  it("right-click on AUTO opens the same editor through the context menu", async () => {
    mountPanel({ solarEditor: true });
    await setLocale("zh-Hans");
    await nextTick();
    const trigger = document.querySelector<HTMLElement>(".hk-tabs-trigger")!;
    trigger.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    await settle();
    const row = Array.from(document.querySelectorAll<HTMLElement>(".hk-menu-row"))
      .find((r) => r.textContent?.includes("配置日照位置"));
    expect(row).toBeTruthy();
    row!.click();
    await settle();
    expect(document.querySelector(".hk-solar-editor")).toBeTruthy();
    await setLocale("en");
  });
});
