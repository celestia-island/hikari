import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkThemeToggle } from "./HkThemeToggle";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface Mounted {
  container: HTMLElement;
  openCustomize: () => number;
}

function mountToggle(externalCustomize: boolean): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let openCount = 0;
  const app = createApp({
    render: () =>
      h(HkThemeToggle, {
        externalCustomize,
        "onOpen-customize": () => {
          openCount += 1;
        },
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, openCustomize: () => openCount };
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

function openMenu(container: HTMLElement): void {
  const arrow = container.querySelector(
    '.s-theme-toggle-btn[data-variant="arrow"]',
  ) as HTMLButtonElement | null;
  arrow!.click();
}

function paletteButton(): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll<HTMLButtonElement>(".s-theme-menu .s-theme-item-btn")].find(
    (b) => b.textContent?.includes("Customize"),
  );
  return btn!;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkThemeToggle external customization", () => {
  it("emits open-customize and keeps the dialog closed when externalCustomize is true", async () => {
    const { container, openCustomize } = mountToggle(true);
    await settle();

    openMenu(container);
    await settle();

    paletteButton().click();
    await settle();

    expect(openCustomize()).toBe(1);
    // The internal dialog is never rendered in external mode.
    expect(document.body.querySelector(".s-scheme-dialog")).toBeNull();
  });

  it("opens the built-in dialog when externalCustomize defaults to false", async () => {
    const { container, openCustomize } = mountToggle(false);
    await settle();

    openMenu(container);
    await settle();

    paletteButton().click();
    await settle();

    expect(openCustomize()).toBe(0);
    expect(document.body.querySelector(".s-scheme-dialog")).toBeTruthy();
  });
});
