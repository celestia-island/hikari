import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import { credentialAutocomplete } from "./credentialAutofill";
import HkInput from "../components/HkInput";
import { HkSignInCard } from "../components/HkSignInCard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

function setTauri(on: boolean) {
  const w = window as unknown as Record<string, unknown>;
  if (on) w.__TAURI_INTERNALS__ = { invoke: () => {} };
  else delete w.__TAURI_INTERNALS__;
}

describe("credentialAutocomplete policy", () => {
  it("keeps the browser defaults outside a Tauri webview", () => {
    setTauri(false);
    expect(credentialAutocomplete("username", "username")).toBe("username");
    expect(credentialAutocomplete("password", "current-password")).toBe("current-password");
    expect(credentialAutocomplete("password", "off")).toBe("off");
  });

  it("degrades to suppression tokens inside a Tauri webview", () => {
    setTauri(true);
    expect(credentialAutocomplete("username", "username")).toBe("off");
    // new-password is the one token the Chromium family respects for
    // suppressing saved-credential fill; plain "off" is ignored on login forms.
    expect(credentialAutocomplete("password", "current-password")).toBe("new-password");
    expect(credentialAutocomplete("password", "off")).toBe("new-password");
  });
});

describe("HkSignInCard credential fields", () => {
  it("renders standard tokens in the browser", () => {
    setTauri(false);
    const c = mount(h(HkSignInCard, { title: "t", onSubmit: () => {} }));
    const inputs = Array.from(c.querySelectorAll("input"));
    const username = inputs[0] as HTMLInputElement;
    const password = inputs.find((i) => i.type === "password") as HTMLInputElement;
    expect(username.autocomplete).toBe("username");
    expect(password.autocomplete).toBe("current-password");
  });

  it("renders suppression tokens inside a Tauri webview", () => {
    setTauri(true);
    const c = mount(h(HkSignInCard, { title: "t", onSubmit: () => {} }));
    const inputs = Array.from(c.querySelectorAll("input"));
    const username = inputs[0] as HTMLInputElement;
    const password = inputs.find((i) => i.type === "password") as HTMLInputElement;
    expect(username.autocomplete).toBe("off");
    expect(password.autocomplete).toBe("new-password");
  });

  it("lets an explicit prop override the policy in Tauri too", () => {
    setTauri(true);
    const c = mount(h(HkSignInCard, { title: "t", onSubmit: () => {}, usernameAutocomplete: "email" }));
    const username = c.querySelector("input") as HTMLInputElement;
    expect(username.autocomplete).toBe("email");
  });
});

describe("HkInput password variant credential field", () => {
  it("keeps the off default in the browser and degrades in Tauri", () => {
    setTauri(false);
    const browser = mount(h(HkInput, { modelValue: "", variant: "password" }));
    expect((browser.querySelector(".hk-pwd-input") as HTMLInputElement).autocomplete).toBe("off");

    setTauri(true);
    const tauri = mount(h(HkInput, { modelValue: "", variant: "password" }));
    expect((tauri.querySelector(".hk-pwd-input") as HTMLInputElement).autocomplete).toBe("new-password");
  });
});
