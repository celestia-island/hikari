import { afterEach, describe, expect, it } from "vitest";
import { h, nextTick } from "vue";

import { HkMessageBox } from "./HkMessageBox";

function confirmButton(): HTMLButtonElement {
  const btn = document.body.querySelector<HTMLButtonElement>(".hk-message-box-confirm");
  expect(btn, "confirm button renders").toBeTruthy();
  return btn!;
}

function cancelButton(): HTMLButtonElement {
  const btns = [...document.body.querySelectorAll<HTMLButtonElement>(".hk-message-box-actions button")]
    .filter((b) => !b.classList.contains("hk-message-box-confirm"));
  expect(btns.length, "cancel button renders").toBeGreaterThan(0);
  return btns[0]!;
}

function messageText(): string {
  return document.body.querySelector(".hk-message-box-text")?.textContent ?? "";
}

async function flush() {
  await nextTick();
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(async () => {
  // Resolve any box still open, then wait for the leave transition +
  // cleanup timer to fully unmount the host app.
  for (const btn of [...document.body.querySelectorAll<HTMLButtonElement>(".hk-message-box-confirm")]) {
    btn.click();
  }
  const deadline = Date.now() + 2500;
  while (
    (document.body.querySelector(".hk-message-box-confirm") ||
      document.body.querySelector(".hk-modal-root")) &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  document.body.innerHTML = "";
});

describe("HkMessageBox", () => {
  it("confirm resolves true on Confirm and false on Cancel", async () => {
    const first = HkMessageBox.confirm({ message: "Delete the file?" });
    await flush();
    expect(messageText()).toBe("Delete the file?");
    confirmButton().click();
    await expect(first).resolves.toBe(true);
    await flush();

    const second = HkMessageBox.confirm({ message: "Delete the file?" });
    await flush();
    cancelButton().click();
    await expect(second).resolves.toBe(false);
  });

  it("danger tone paints the confirm button in the danger variant", async () => {
    const pending = HkMessageBox.confirm({ message: "Erase everything", tone: "danger" });
    await flush();
    expect(confirmButton().className).toContain("hk-btn-danger");
    confirmButton().click();
    await expect(pending).resolves.toBe(true);
  });

  it("alert has a single action and resolves on dismissal", async () => {
    const pending = HkMessageBox.alert({ message: "All done", tone: "success" });
    await flush();
    expect(document.body.querySelectorAll(".hk-message-box-actions button")).toHaveLength(1);
    confirmButton().click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("prompt resolves the typed value, null on cancel", async () => {
    const first = HkMessageBox.prompt({ message: "Pick a name", prompt: { value: "draft" } });
    await flush();
    const input = document.body.querySelector<HTMLInputElement>(".hk-message-box-prompt input");
    expect(input, "prompt field renders").toBeTruthy();
    expect(input!.value).toBe("draft");
    input!.value = "renamed";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    confirmButton().click();
    await expect(first).resolves.toBe("renamed");
    await flush();

    const second = HkMessageBox.prompt({ message: "Pick a name", prompt: {} });
    await flush();
    cancelButton().click();
    await expect(second).resolves.toBeNull();
  });

  it("prompt renders the configured field variant and affixes", async () => {
    const pending = HkMessageBox.prompt({
      message: "Set a passphrase",
      prompt: {
        type: "password",
        placeholder: "hunter2",
        prefix: () => h("span", { class: "prompt-prefix-probe" }, "P"),
      },
    });
    await flush();
    const input = document.body.querySelector<HTMLInputElement>(".hk-message-box-prompt input");
    expect(input?.getAttribute("type")).toBe("password");
    expect(input?.getAttribute("placeholder")).toBe("hunter2");
    expect(document.body.querySelector(".prompt-prefix-probe")?.textContent).toBe("P");
    confirmButton().click();
    await expect(pending).resolves.toBe("");
  });

  it("prompt validate hook blocks confirmation and shows the error", async () => {
    const pending = HkMessageBox.prompt({
      message: "Set a name",
      prompt: {
        validate: (v) => (v.trim() ? undefined : "Name is required"),
      },
    });
    await flush();
    // Empty value + strict validator → the confirm is blocked, the box
    // stays open and the error is visible.
    confirmButton().click();
    await flush();
    expect(document.body.querySelector(".hk-message-box-prompt")).toBeTruthy();
    expect(document.body.querySelector(".hk-message-box-prompt")?.textContent).toContain(
      "Name is required",
    );
    // Typing clears the error; a valid value then confirms.
    const input = document.body.querySelector<HTMLInputElement>(".hk-message-box-prompt input")!;
    input.value = "ok-name";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    confirmButton().click();
    await expect(pending).resolves.toBe("ok-name");
  });

  it("custom button labels override the i18n defaults", async () => {
    const pending = HkMessageBox.confirm({
      message: "Proceed?",
      confirmText: "Yes, go",
      cancelText: "Nope",
    });
    await flush();
    expect(confirmButton().textContent).toBe("Yes, go");
    expect(cancelButton().textContent).toBe("Nope");
    confirmButton().click();
    await expect(pending).resolves.toBe(true);
  });
});
