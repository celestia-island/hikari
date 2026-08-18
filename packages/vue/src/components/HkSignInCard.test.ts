import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import { HkSignInCard } from "./HkSignInCard";

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
});

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The username field is the first text input inside the card. */
function usernameField(c: HTMLElement) {
  return c.querySelector('input[name="signin-username"]') as HTMLInputElement;
}

function passwordField(c: HTMLElement) {
  return c.querySelector('input[name="signin-password"]') as HTMLInputElement;
}

describe("HkSignInCard", () => {
  it("renders the auth-card shell with title, subtitle and both fields", () => {
    const c = mount(h(HkSignInCard, { title: "Sign in", subtitle: "Continue" }));
    expect(c.querySelector(".s-auth-card")).toBeTruthy();
    expect(c.querySelector(".s-auth-title")?.textContent).toBe("Sign in");
    expect(c.querySelector(".s-auth-subtitle")?.textContent).toBe("Continue");
    expect(usernameField(c)).toBeTruthy();
    expect(passwordField(c)).toBeTruthy();
  });

  it("emits submit with the credentials and trims the username", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", onSubmit }));
    typeInto(usernameField(c), "  langyo  ");
    typeInto(passwordField(c), "secret");
    await Promise.resolve();
    // The block button submits: find it and click.
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith("langyo", "secret");
  });

  it("never emits submit while either field is empty", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", onSubmit }));
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    expect(btn.getAttribute("disabled")).not.toBeNull(); // empty guard disables the button
    typeInto(usernameField(c), "langyo");
    await Promise.resolve();
    expect(btn.getAttribute("disabled")).not.toBeNull(); // password still empty
    btn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("gates on the external loading prop", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", loading: true, onSubmit }));
    typeInto(usernameField(c), "langyo");
    typeInto(passwordField(c), "secret");
    await Promise.resolve();
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    expect(btn.getAttribute("disabled")).not.toBeNull();
    btn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("honors the hard disabled prop even with valid credentials", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", disabled: true, onSubmit }));
    typeInto(usernameField(c), "langyo");
    typeInto(passwordField(c), "secret");
    await Promise.resolve();
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    expect(btn.getAttribute("disabled")).not.toBeNull();
    btn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits on Enter from the username field", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", onSubmit }));
    typeInto(usernameField(c), "langyo");
    typeInto(passwordField(c), "secret");
    await Promise.resolve();
    usernameField(c).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith("langyo", "secret");
  });

  it("renders a logo image from logoSrc", () => {
    const c = mount(h(HkSignInCard, { title: "T", logoSrc: "/logo.webp" }));
    const img = c.querySelector(".s-auth-header img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/logo.webp");
  });

  it("renders top slot content above the form but outside it", () => {
    const c = mount(
      h(HkSignInCard, { title: "T" }, { top: () => h("div", { id: "top-slot" }, "tabs") }),
    );
    const top = c.querySelector("#top-slot") as HTMLElement;
    expect(top).toBeTruthy();
    // The top slot must not be inside the <form> — tab clicks must never
    // trigger a submit.
    expect(top.closest("form")).toBeNull();
    // And it sits above the credential fields.
    const form = c.querySelector("form") as HTMLElement;
    expect(
      top.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("overrides the username type and placeholder", () => {
    const c = mount(
      h(HkSignInCard, {
        title: "T",
        usernameType: "email",
        usernamePlaceholder: "name@example.com",
      }),
    );
    const field = usernameField(c);
    expect(field.getAttribute("type")).toBe("email");
    expect(field.getAttribute("placeholder")).toBe("name@example.com");
  });

  it("keeps the locale username placeholder by default", () => {
    const c = mount(h(HkSignInCard, { title: "T" }));
    expect(usernameField(c).getAttribute("placeholder")).toBeTruthy();
  });
});
