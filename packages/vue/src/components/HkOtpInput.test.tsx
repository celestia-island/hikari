import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { HkOtpInput } from "./HkOtpInput";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface Harness {
  container: HTMLElement;
  model: { value: string };
  cells: () => HTMLInputElement[];
  emitted: () => string[];
  /** Paste text into one cell through a real ClipboardEvent. */
  paste: (index: number, text: string) => void;
  rendered: () => string[];
  texts: () => string[];
}

function mountOtp(props: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const model = ref(String(props.modelValue ?? ""));
  const updates: string[] = [];
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkOtpInput, {
          ...props,
          modelValue: model.value,
          "onUpdate:modelValue": (v: string) => {
            updates.push(v);
            model.value = v;
          },
        });
    },
  });
  const app = createApp(Wrapper);
  app.mount(container);
  mounts.push({ app, container });

  const cells = () => Array.from(container.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
  const emitted = () => updates.slice();

  return {
    container,
    model,
    cells,
    emitted,
    rendered: () => cells().map((c) => c.value),
    texts: () => cells().map((c) => c.value),
    paste: (index: number, text: string) => {
      const dt = new DataTransfer();
      dt.setData("text", text);
      cells()[index]!.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    },
  };
}

afterEach(() => {
  while (mounts.length > 0) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

describe("HkOtpInput structure", () => {
  it("renders one single-character cell per length", async () => {
    const otp = mountOtp();
    await nextTick();
    expect(otp.cells()).toHaveLength(6);
    expect(otp.cells()[0]!.getAttribute("maxlength")).toBe("1");
    expect(otp.container.querySelector(".hk-otp")!.getAttribute("class")).toContain("hk-otp-md");
  });

  it("honors a custom cell count", async () => {
    const otp = mountOtp({ length: 4 });
    await nextTick();
    expect(otp.cells()).toHaveLength(4);
  });

  it("names the row as one group for assistive tech", async () => {
    const otp = mountOtp({ ariaLabel: "验证码" });
    await nextTick();
    const group = otp.container.querySelector(".hk-otp")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-label")).toBe("验证码");
    // Per-cell names stay positional and default without caller effort.
    expect(otp.cells()[0]!.getAttribute("aria-label")).toBe("Digit 1");
    expect(otp.cells()[5]!.getAttribute("aria-label")).toBe("Digit 6");
  });

  it("lets the caller rename the cells", async () => {
    const otp = mountOtp({ cellAriaLabel: (i: number) => `第 ${i} 位` });
    await nextTick();
    expect(otp.cells()[2]!.getAttribute("aria-label")).toBe("第 3 位");
  });

  it("advertises one-time-code on the first cell only", async () => {
    const otp = mountOtp();
    await nextTick();
    expect(otp.cells()[0]!.getAttribute("autocomplete")).toBe("one-time-code");
    expect(otp.cells()[0]!.getAttribute("inputmode")).toBe("numeric");
    expect(otp.cells()[1]!.getAttribute("autocomplete")).toBe("off");
  });

  it("opens the split slot only when the row divides evenly", async () => {
    const even = mountOtp({ separated: true });
    await nextTick();
    expect(even.container.querySelectorAll(".hk-otp-gap")).toHaveLength(1);
    // The slot sits between cell 3 and cell 4 — the "123 456" shape.
    const children = Array.from(even.container.querySelector(".hk-otp")!.children);
    expect(children[3]!.classList.contains("hk-otp-gap")).toBe(true);

    const odd = mountOtp({ separated: true, length: 5 });
    await nextTick();
    expect(odd.container.querySelectorAll(".hk-otp-gap")).toHaveLength(0);
  });

  it("announces errors and describes the row with the hint", async () => {
    const errored = mountOtp({ error: "验证码不正确" });
    await nextTick();
    expect(errored.container.querySelector(".hk-otp")!.classList.contains("hk-otp-error")).toBe(true);
    expect(errored.cells()[0]!.getAttribute("aria-invalid")).toBe("true");
    const alert = errored.container.querySelector(".hk-otp-error-msg")!;
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("验证码不正确");

    const hinted = mountOtp({ hint: "6 位数字", ariaLabel: "code" });
    await nextTick();
    const group = hinted.container.querySelector(".hk-otp")!;
    const hint = hinted.container.querySelector(".hk-otp-hint")!;
    expect(group.getAttribute("aria-describedby")).toBe(hint.id);
    expect(hint.id).not.toBe("");
  });

  it("keeps an explicit id and points the label at it", async () => {
    const otp = mountOtp({ id: "mfa-code", label: "验证码" });
    await nextTick();
    expect(otp.cells()[0]!.id).toBe("mfa-code");
    const label = otp.container.querySelector("label.hk-otp-label")!;
    expect(label.getAttribute("for")).toBe("mfa-code");
    expect(label.textContent).toContain("验证码");
  });

  it("forwards host attributes to the cells", async () => {
    const otp = mountOtp({ "data-testid": "otp", autocomplete: "off" });
    await nextTick();
    expect(otp.cells()[0]!.getAttribute("data-testid")).toBe("otp");
    expect(otp.cells()[3]!.getAttribute("data-testid")).toBe("otp");
    // A host-supplied attribute lands after ours: it wins.
    expect(otp.cells()[0]!.getAttribute("autocomplete")).toBe("off");
  });
});

describe("HkOtpInput typing", () => {
  it("composes the code and advances the caret", async () => {
    const otp = mountOtp();
    await nextTick();
    const cells = otp.cells();
    cells[0]!.value = "1";
    cells[0]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("1");
    expect(document.activeElement).toBe(cells[1]);

    cells[1]!.value = "2";
    cells[1]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("12");
    expect(document.activeElement).toBe(cells[2]);
  });

  it("drops characters the field does not accept", async () => {
    const otp = mountOtp();
    await nextTick();
    const cells = otp.cells();
    cells[0]!.value = "a";
    cells[0]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("");
    expect(cells[0]!.value).toBe("");
  });

  it("accepts letters when alphanumeric is on", async () => {
    const otp = mountOtp({ alphanumeric: true, length: 4 });
    await nextTick();
    const cells = otp.cells();
    cells[0]!.value = "a";
    cells[0]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("a");
    expect(cells[0]!.getAttribute("inputmode")).toBe("text");
    expect(cells[0]!.hasAttribute("maxlength")).toBe(false);
  });

  it("spreads a multi-character input (autofill, IME) across the row", async () => {
    const otp = mountOtp();
    await nextTick();
    const cells = otp.cells();
    cells[0]!.value = "1234";
    cells[0]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("1234");
    expect(document.activeElement).toBe(cells[4]);
  });

  it("fires complete once the row fills, and not again while it stays full", async () => {
    const onComplete = vi.fn();
    const otp = mountOtp({ onComplete });
    await nextTick();
    const cells = otp.cells();
    for (let i = 0; i < 6; i += 1) {
      cells[i]!.value = String(i + 1);
      cells[i]!.dispatchEvent(new Event("input"));
      await nextTick();
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");

    // Editing one cell of a full code must not re-fire the event: the
    // host would submit twice for one keystroke.
    cells[2]!.value = "9";
    cells[2]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(otp.model.value).toBe("129456");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("auto-submits on the filling keystroke only", async () => {
    const submit = vi.fn();
    const otp = mountOtp({ autoSubmit: true, submitOnEnter: submit, length: 4 });
    await nextTick();
    const cells = otp.cells();
    for (let i = 0; i < 4; i += 1) {
      cells[i]!.value = String(i + 1);
      cells[i]!.dispatchEvent(new Event("input"));
      await nextTick();
    }
    expect(submit).toHaveBeenCalledTimes(1);
    expect(otp.model.value).toBe("1234");
  });

  it("submits on Enter", async () => {
    const submit = vi.fn();
    const otp = mountOtp({ submitOnEnter: submit });
    await nextTick();
    otp.cells()[0]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe("HkOtpInput editing", () => {
  it("steps back and clears the previous cell on an empty-cell Backspace", async () => {
    const otp = mountOtp({ modelValue: "12" });
    await nextTick();
    const cells = otp.cells();
    cells[2]!.focus();
    await nextTick();
    cells[2]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(otp.model.value).toBe("1");
    expect(otp.rendered().slice(0, 3)).toEqual(["1", "", ""]);
    expect(document.activeElement).toBe(cells[1]);
  });

  it("clears the current cell in place when it holds a character", async () => {
    const otp = mountOtp({ modelValue: "123" });
    await nextTick();
    const cells = otp.cells();
    cells[1]!.focus();
    await nextTick();
    cells[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(otp.model.value).toBe("13");
    expect(document.activeElement).toBe(cells[1]);
  });

  it("deletes forward without shifting the remaining digits", async () => {
    const otp = mountOtp({ modelValue: "123456" });
    await nextTick();
    const cells = otp.cells();
    cells[1]!.focus();
    cells[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(otp.model.value).toBe("13456");
  });

  it("walks the row with the arrow keys and Home/End", async () => {
    const otp = mountOtp({ modelValue: "123456" });
    await nextTick();
    const cells = otp.cells();
    cells[2]!.focus();
    const press = (key: string) =>
      cells[2]!.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );

    press("ArrowLeft");
    expect(document.activeElement).toBe(cells[1]);
    cells[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(cells[2]);
    press("Home");
    expect(document.activeElement).toBe(cells[0]);
    press("End");
    expect(document.activeElement).toBe(cells[5]);
  });

  it("selects the current glyph so the next keystroke replaces it", async () => {
    const otp = mountOtp({ modelValue: "123" });
    await nextTick();
    const cell = otp.cells()[0]!;
    cell.focus();
    await nextTick();
    expect(cell.selectionStart).toBe(0);
    expect(cell.selectionEnd).toBe(1);
  });

  it("leaves no highlighted glyph behind when the row auto-completes", async () => {
    // Regression: the 6th keystroke advanced the focus onto its own
    // (occupied) cell with the caret expanded, so the last digit rendered
    // selected and the next keystroke replaced it instead of being a
    // no-op / starting an edit the user did not ask for.
    const otp = mountOtp();
    await nextTick();
    const cells = otp.cells();
    for (let i = 0; i < 6; i += 1) {
      cells[i]!.value = String(i + 1);
      cells[i]!.dispatchEvent(new Event("input"));
      await nextTick();
    }
    const tail = cells[5]!;
    expect(document.activeElement).toBe(tail);
    expect(tail.selectionStart).toBe(tail.selectionEnd);
  });

  it("keeps an ordinary advance free of a selection too", async () => {
    const otp = mountOtp();
    await nextTick();
    const cells = otp.cells();
    cells[0]!.value = "1";
    cells[0]!.dispatchEvent(new Event("input"));
    await nextTick();
    expect(document.activeElement).toBe(cells[1]);
    expect(cells[1]!.selectionStart).toBe(cells[1]!.selectionEnd);
  });
});

describe("HkOtpInput paste", () => {
  it("distributes a pasted code from the focused cell", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.cells()[0]!.focus();
    otp.paste(0, "123456");
    await nextTick();
    expect(otp.model.value).toBe("123456");
    expect(otp.rendered().join("")).toBe("123456");
  });

  it("strips the separators SMS clients ship with", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.paste(0, "123 456");
    await nextTick();
    expect(otp.model.value).toBe("123456");
  });

  it("keeps only the accepted characters of a noisy paste", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.paste(0, "code: 12-34-56");
    await nextTick();
    expect(otp.model.value).toBe("123456");
  });

  it("truncates a paste longer than the row", async () => {
    const otp = mountOtp({ length: 4 });
    await nextTick();
    otp.paste(0, "12345678");
    await nextTick();
    expect(otp.model.value).toBe("1234");
  });

  it("fills forward from the paste cell and truncates what overruns", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.paste(4, "5678");
    await nextTick();
    // Only cells 5 and 6 exist after the paste point: the clipboard is
    // consumed left to right, so its tail is what gets dropped. (Nothing
    // is shifted into earlier cells — a paste fills forward, it never
    // rewrites characters the user did not touch.)
    expect(otp.model.value).toBe("56");
    expect(otp.rendered()).toEqual(["", "", "", "", "5", "6"]);
  });

  it("replaces the whole row when a full-length code lands on the first cell", async () => {
    const otp = mountOtp({ modelValue: "999999" });
    await nextTick();
    otp.paste(0, "123456");
    await nextTick();
    expect(otp.model.value).toBe("123456");
  });

  it("leaves a paste with nothing usable to the browser", async () => {
    const otp = mountOtp();
    await nextTick();
    const dt = new DataTransfer();
    dt.setData("text", "no digits here");
    const event = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    otp.cells()[0]!.dispatchEvent(event);
    await nextTick();
    expect(event.defaultPrevented).toBe(false);
    expect(otp.model.value).toBe("");
  });
});

describe("HkOtpInput external value", () => {
  it("mirrors a caller-driven modelValue into the cells", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.model.value = "987654";
    await nextTick();
    expect(otp.rendered()).toEqual(["9", "8", "7", "6", "5", "4"]);

    // The retry path: the host clears the code after a rejected attempt.
    otp.model.value = "";
    await nextTick();
    expect(otp.rendered()).toEqual(["", "", "", "", "", ""]);
  });

  it("truncates an over-long external value to the row", async () => {
    const otp = mountOtp({ length: 4 });
    await nextTick();
    otp.model.value = "123456";
    await nextTick();
    expect(otp.rendered()).toEqual(["1", "2", "3", "4"]);
  });

  it("drops stranded characters when the row shrinks", async () => {
    // One mounted instance whose `length` shrinks under it (a host that
    // flips 6 → 4 must not leave two characters living in removed cells).
    const container = document.createElement("div");
    document.body.appendChild(container);
    const len = ref(6);
    const App = defineComponent({
      setup() {
        return () => h(HkOtpInput, { length: len.value, modelValue: "123456" });
      },
    });
    const app = createApp(App);
    app.mount(container);
    mounts.push({ app, container });
    await nextTick();
    expect(container.querySelectorAll(".hk-otp-cell")).toHaveLength(6);

    len.value = 4;
    await nextTick();
    const cells = Array.from(container.querySelectorAll<HTMLInputElement>(".hk-otp-cell"));
    expect(cells).toHaveLength(4);
    expect(cells.map((c) => c.value)).toEqual(["1", "2", "3", "4"]);
  });

  it("autofocuses the first empty cell", async () => {
    const otp = mountOtp({ autofocus: true, modelValue: "12" });
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(otp.cells()[2]);
  });

  it("stays inert while disabled or readonly", async () => {
    const disabled = mountOtp({ disabled: true });
    await nextTick();
    expect(disabled.cells()[0]!.disabled).toBe(true);
    expect(disabled.container.querySelector(".hk-otp")!.classList.contains("hk-otp-disabled")).toBe(true);

    const readonly = mountOtp({ readonly: true });
    await nextTick();
    expect(readonly.cells()[0]!.readOnly).toBe(true);
  });

  it("spreads an emitted code into the cells the test can read back", async () => {
    const otp = mountOtp();
    await nextTick();
    otp.paste(0, "424242");
    await nextTick();
    expect(otp.emitted()).toContain("424242");
    expect(otp.texts().join("")).toBe("424242");
  });
});
