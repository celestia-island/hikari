import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

  it("renders no methods block, ever (the slot is retired)", () => {
    // The alternative-methods block is GONE from the card (2026-11-26
    // grammar): the wrapper would otherwise render HkAuthCard's padded,
    // top-margined `.s-auth-methods` wrapper as empty dead space under
    // the form — and no consumer can pass the slot anymore.
    // MUT:signin-methods-slot-return (re-adding the slot renders the
    // band again and this goes red).
    const c = mount(h(HkSignInCard, { title: "T" }));
    expect(c.querySelector(".s-auth-methods")).toBeNull();
  });

  // ── Account-first mode (passwordField: false) ─────────────────────────

  it("omits the password field entirely in account-first mode", () => {
    const c = mount(h(HkSignInCard, { title: "T", passwordField: false }));
    expect(usernameField(c)).toBeTruthy();
    expect(passwordField(c)).toBeNull();
    // No hidden input may survive either: a password-type field on a form
    // that never carries a password would still trip credential-manager
    // save prompts.
    expect(c.querySelector('input[type="password"]')).toBeNull();
  });

  it("submits with an empty password once only the account name is typed", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", passwordField: false, onSubmit }));
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    // Empty username still gates the submit.
    expect(btn.getAttribute("disabled")).not.toBeNull();
    typeInto(usernameField(c), "demiurge");
    await Promise.resolve();
    expect(btn.getAttribute("disabled")).toBeNull(); // no password expected
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith("demiurge", "");
  });

  it("does not submit on Enter with an empty username in account-first mode", async () => {
    const onSubmit = vi.fn();
    const c = mount(h(HkSignInCard, { title: "T", passwordField: false, onSubmit }));
    usernameField(c).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("seeds the username field from initialUsername", () => {
    const c = mount(
      h(HkSignInCard, { title: "T", passwordField: false, initialUsername: "  demiurge " }),
    );
    expect((usernameField(c) as HTMLInputElement).value).toBe("  demiurge ");
    // And the seeded name alone satisfies the submit guard.
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    expect(btn.getAttribute("disabled")).toBeNull();
  });

  it("keeps the password guard when passwordField is unset (default true)", () => {
    const c = mount(h(HkSignInCard, { title: "T", initialUsername: "demiurge" }));
    const btn = c.querySelector(".hk-btn-primary") as HTMLElement;
    expect(btn.getAttribute("disabled")).not.toBeNull(); // password still empty
  });

  it("renders the footer block EXACTLY ONCE per card in shell mode", () => {
    // The bare-mode extraction (2026-11) once rendered the wrapper div
    // in BOTH the credential fragment and HkAuthCard's own slot — a
    // standalone card with a slot showed two .s-auth-footer blocks (R3
    // of the extraction PR caught it live).
    // MUT:r1487-double-blocks (rendering the block in shell mode too
    // makes the count 2).
    const c = mount(
      h(HkSignInCard, { title: "T" }, {
        footer: () => h("div", { class: "f-row" }, "f"),
      }),
    );
    expect(c.querySelectorAll(".s-auth-methods")).toHaveLength(0);
    expect(c.querySelectorAll(".s-auth-footer")).toHaveLength(1);
    expect(c.querySelectorAll(".f-row")).toHaveLength(1);
  });

  it("carries its own column rhythm at any nesting depth (spacing regression pin)", () => {
    // 2026-11-24 user report: the username field and the submit button
    // sat GLUED together on every HkLoginFlow surface — the stable-shell
    // refactor moved the form inside the inner transition container, so
    // the `.s-auth-form > form` sibling gap no longer reached it. The
    // class travels with the form; the stylesheet pin below keeps the
    // rule that grants it.
    // MUT:r-spacing-class-drop (removing the class from credentialBody's
    // form, or the `.s-auth-credentials` arm from the rule, leaves the
    // bare-fragment form gap-less — both halves redden).
    const bare = mount(
      h(HkSignInCard, { bare: true }, { footer: () => h("div", "f") }),
    );
    const bareForm = bare.querySelector("form")!;
    expect(bareForm.classList.contains("s-auth-credentials")).toBe(true);
    const shell = mount(h(HkSignInCard, { title: "T" }));
    expect(
      shell.querySelector("form")!.classList.contains("s-auth-credentials"),
    ).toBe(true);

    const here = dirname(fileURLToPath(import.meta.url));
    const scss = readFileSync(join(here, "../styles/admin-tokens.scss"), "utf-8");
    const rule = scss.match(/\.s-auth-form > form,\s*\.s-auth-form > \*,\s*\.s-auth-credentials\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "the credentials rhythm rule must keep its class arm").toBeTruthy();
    expect(rule).toContain("gap: var(--space-16, 1rem)");
  });

  it("renders no footer wrapper at all when no footer slot was passed (dead-space guard)", () => {
    // The dead-space rule: a footer-less card must leave the wrapper
    // band absent (and the retired methods band stays gone).
    // MUT:r1487-footer-dead-space (unconditional footer forwarding
    // renders an empty .s-auth-footer band here).
    const c = mount(h(HkSignInCard, { title: "T" }));
    expect(c.querySelector(".s-auth-footer")).toBeNull();
    expect(c.querySelector(".s-auth-methods")).toBeNull();
  });

  it("renders the footer block exactly once in BARE mode too", () => {
    const c = mount(
      h(HkSignInCard, { bare: true }, {
        footer: () => h("div", { class: "f-row" }, "f"),
      }),
    );
    // No HkAuthCard exists in bare mode — the fragment owns the block.
    expect(c.querySelectorAll(".s-auth-card")).toHaveLength(0);
    expect(c.querySelectorAll(".s-auth-methods")).toHaveLength(0);
    expect(c.querySelectorAll(".s-auth-footer")).toHaveLength(1);
  });
});
