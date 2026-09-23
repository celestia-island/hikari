import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, reactive, ref } from "vue";

import { HkMfaVerifyCard, hkIsMfaFactor, hkPreferredMfaFactor } from "./HkMfaVerifyCard";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

/** Mount a render closure, returning its container. Reading reactive
 *  state INSIDE the closure keeps re-renders honest (a static vnode
 *  never updates, so prop-mutation tests need this shape). */
function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render });
  app.mount(container);
  mounts.push({ app, container });
  return { app, container };
}

/** The card instance's exposed handles (clearProof / focusPassword). */
function exposedOf(app: ReturnType<typeof createApp>): { clearProof: () => void } {
  const instance = app._instance?.subTree?.component as unknown as {
    exposed: { clearProof: () => void } | null;
  } | null;
  expect(instance?.exposed, "the card exposes its proof handles").toBeTruthy();
  return instance!.exposed!;
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

function pickerButtons(c: HTMLElement) {
  return Array.from(c.querySelectorAll<HTMLButtonElement>("button.hk-icon-group-item"));
}

function primaryButton(c: HTMLElement) {
  return c.querySelector(".hk-btn-primary") as HTMLButtonElement;
}

function buttonText(c: HTMLElement, text: string) {
  return Array.from(c.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
}

function otpCells(c: HTMLElement) {
  return Array.from(c.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
}

function flush() {
  // nextTick, deliberately NOT a setTimeout macrotask: in happy-dom the
  // re-arm assertions only settle deterministically on the microtask
  // queue the components themselves schedule on.
  return nextTick();
}

describe("hkPreferredMfaFactor", () => {
  it("follows the passkey > totp > sms ladder and keeps password last", () => {
    expect(hkPreferredMfaFactor(["password", "totp"])).toBe("totp");
    expect(hkPreferredMfaFactor(["sms", "totp"])).toBe("totp");
    expect(hkPreferredMfaFactor(["password", "sms"])).toBe("sms");
    expect(hkPreferredMfaFactor(["password"])).toBe("password");
  });

  it("returns null for nothing drivable and filters unknown kinds", () => {
    expect(hkPreferredMfaFactor([])).toBeNull();
    expect(hkPreferredMfaFactor(["eyes", "voice"])).toBeNull();
  });

  it("type-guards raw server strings", () => {
    expect(hkIsMfaFactor("totp")).toBe(true);
    expect(hkIsMfaFactor("iris")).toBe(false);
  });
});

describe("HkMfaVerifyCard", () => {
  it("renders the verify-account shell with the default factor's proof field", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], accountName: "demierge" }));
    expect(container.querySelector(".s-auth-card")).toBeTruthy();
    expect(container.querySelector(".s-auth-title")?.textContent).toBe("Verify account");
    // The account-aware subtitle carries the name (locale interpolation).
    expect(container.querySelector(".s-auth-subtitle")?.textContent).toContain("demierge");
    // totp is the default → six code cells, TOTP hint, no password field.
    expect(otpCells(container)).toHaveLength(6);
    expect(container.textContent).toContain("Enter the 6-digit TOTP code");
    expect(container.querySelector('input[name="mfa-verify-password"]')).toBeNull();
  });

  it("keeps the generic subtitle when no account name is given", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["totp"] }));
    expect(container.querySelector(".s-auth-subtitle")?.textContent)
      .toBe("This account requires an extra verification step");
  });

  it("prefers the ladder's head even when the server announces password first", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password", "totp"] }));
    expect(otpCells(container).length).toBe(6);
    expect(container.querySelector('input[name="mfa-verify-password"]')).toBeNull();
  });

  it("renders the password proof with a disabled submit until a password exists", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"] }));
    const field = container.querySelector('input[name="mfa-verify-password"]') as HTMLInputElement;
    expect(field).toBeTruthy();
    expect(otpCells(container)).toHaveLength(0);
    const submit = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Verify and sign in")) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("emits verify with the composed code once the row fills", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    // Typing a whole code into the first cell distributes it forward.
    typeInto(otpCells(container)[0]!, "123456");
    await flush();
    expect(primaryButton(container).disabled).toBe(false);
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("totp", "123456");
  });

  it("does not emit verify while the proof is incomplete", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    typeInto(otpCells(container)[0]!, "123");
    await flush();
    expect(primaryButton(container).disabled).toBe(true);
    primaryButton(container).click();
    await flush();
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("emits the password proof", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["password"], onVerify }));
    typeInto(
      container.querySelector('input[name="mfa-verify-password"]') as HTMLInputElement,
      "secret",
    );
    await flush();
    const submit = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Verify and sign in"))!;
    submit.click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("password", "secret");
  });

  it("emits an empty passkey proof and shows the retry hint only when passed", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["passkey"],
        onVerify,
        passkeyRetryHint: "try another entry",
      }));
    expect(container.textContent).toContain("Verify with Passkey");
    expect(container.querySelector(".hk-alert-warning")?.textContent).toContain("try another entry");
    expect(otpCells(container)).toHaveLength(0);
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("passkey", "");
  });

  it("omits the retry alert when no hint is passed", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["passkey"] }));
    expect(container.querySelector(".hk-alert-warning")).toBeNull();
  });

  it("pins the proven factor and switches to the step-two wording", async () => {
    const onVerify = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["totp", "sms"],
        proven: "totp",
        accountName: "demierge",
        onVerify,
      }));
    expect(container.querySelector(".s-auth-title")?.textContent).toBe("One more verification");
    const subtitle = container.querySelector(".s-auth-subtitle")?.textContent ?? "";
    expect(subtitle).toContain("TOTP authenticator app");
    expect(subtitle).toContain("demierge");
    // The proven entry stays visible, pinned disabled with the marker…
    const buttons = pickerButtons(container);
    expect(buttons).toHaveLength(2);
    const pinned = buttons.find((b) => b.getAttribute("data-marker") === "success")!;
    expect(pinned).toBeTruthy();
    expect(pinned.disabled).toBe(true);
    // …and the default selection moved on to the next ladder entry (sms:
    // separated shape + sms hint).
    await flush();
    expect(container.querySelector(".hk-otp-gap")).toBeTruthy();
    expect(container.textContent).toContain("Enter the 6-digit SMS code");
    // Proving the sms factor emits "sms", not the pinned totp.
    typeInto(otpCells(container)[0]!, "654321");
    await flush();
    primaryButton(container).click();
    await flush();
    expect(onVerify).toHaveBeenCalledWith("sms", "654321");
  });

  it("re-arms (selection + fields) when the proven factor arrives late", async () => {
    const onVerify = vi.fn();
    const state = reactive<{ proven?: string }>({});
    const { container } = mount(() =>
      h(HkMfaVerifyCard, {
        factors: ["totp", "sms"],
        proven: state.proven,
        onVerify,
      }));
    await nextTick(); // settle the first paint before feeding the row
    expect(otpCells(container)).toHaveLength(6); // totp selected first
    typeInto(otpCells(container)[0]!, "11");
    await nextTick();
    // Step two: totp now proven — the card must reselect AND clear the
    // half-typed code.
    state.proven = "totp";
    await nextTick();
    expect(container.querySelector(".hk-otp-gap")).toBeTruthy(); // sms now selected
    expect(otpCells(container).every((cell) => cell.value === "")).toBe(true);
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("wires the SMS resend and the back action", async () => {
    const onResend = vi.fn();
    const onBack = vi.fn();
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["sms"], onResend, onBack }));
    buttonText(container, "Resend code")!.click();
    await flush();
    expect(onResend).toHaveBeenCalledTimes(1);
    buttonText(container, "Back to sign in")!.click();
    await flush();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("omits the resend row outside the sms factor", () => {
    const { container } = mount(() => h(HkMfaVerifyCard, { factors: ["totp"] }));
    expect(buttonText(container, "Resend code")).toBeUndefined();
  });

  it("hides the picker entirely when nothing drivable is announced", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["iris-scan"] }));
    expect(pickerButtons(container)).toHaveLength(0);
    // Degenerate but alive: the card still renders its shell + actions.
    expect(container.querySelector(".s-auth-card")).toBeTruthy();
    expect(buttonText(container, "Back to sign in")).toBeTruthy();
  });

  it("clears the active proof through the exposed handle", async () => {
    const onVerify = vi.fn();
    const cardRef = ref<{ clearProof: () => void } | null>(null);
    const { app, container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["totp"], onVerify }));
    cardRef.value = exposedOf(app);
    // A PARTIAL code: a full one would autoSubmit mid-type and emit
    // before the clear ever runs.
    typeInto(otpCells(container)[0]!, "123");
    await flush();
    cardRef.value!.clearProof();
    await flush();
    expect(otpCells(container).every((cell) => cell.value === "")).toBe(true);
    primaryButton(container).click();
    await flush();
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("disables the actions while loading (the picker stays live)", () => {
    const { container } = mount(() =>
      h(HkMfaVerifyCard, { factors: ["passkey", "totp"], loading: true }));
    // The passkey submit + the back action are out of the user's hands;
    // the picker stays live — re-clicking the active factor is a radio
    // no-op, and chest's panel kept it enabled during verify too.
    expect(primaryButton(container).disabled).toBe(true);
    const back = buttonText(container, "Back to sign in") as HTMLButtonElement;
    expect(back.disabled).toBe(true);
  });
});
