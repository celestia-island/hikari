import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HkCookieConsent } from "./HkCookieConsent";

const STORAGE_KEY = "hikari-cookies-accepted";

/** Stub the runtime timezone the component's Europe check reads. */
function stubTimezone(tz: string | undefined) {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () =>
      ({
        resolvedOptions: () => ({ timeZone: tz }),
      }) as unknown as Intl.DateTimeFormat,
  );
}

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountConsent() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkCookieConsent) });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.body.innerHTML = "";
  localStorage.removeItem(STORAGE_KEY);
  vi.restoreAllMocks();
});

describe("HkCookieConsent", () => {
  it("renders nothing outside Europe before any choice is stored", async () => {
    stubTimezone("Asia/Shanghai");
    const container = mountConsent();
    await nextTick();
    expect(container.querySelector(".s-cookie-consent")).toBeNull();
    expect(container.querySelector(".s-cookie-consent-icon")).toBeNull();
  });

  it("shows the notice text and OK button in a Europe timezone with no stored choice", async () => {
    stubTimezone("Europe/Berlin");
    const container = mountConsent();
    await nextTick();
    const notice = container.querySelector<HTMLElement>(".s-cookie-consent");
    expect(notice, "notice span renders").toBeTruthy();
    expect(notice!.textContent).toContain("This site uses cookies.");
    const ok = container.querySelector<HTMLButtonElement>(".s-cookie-consent-ok");
    expect(ok, "OK button renders").toBeTruthy();
    expect(ok!.textContent).toBe("OK");
  });

  it("accepting stores the flag and collapses to the cookie icon", async () => {
    stubTimezone("Europe/Paris");
    const container = mountConsent();
    await nextTick();
    container.querySelector<HTMLButtonElement>(".s-cookie-consent-ok")!.click();
    await nextTick();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(container.querySelector(".s-cookie-consent")).toBeNull();
    expect(container.querySelector("svg.s-cookie-consent-icon")).toBeTruthy();
  });
});
