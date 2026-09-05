import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useClipboardWithToast } from "./useClipboard";

// `navigator.clipboard` does not exist under happy-dom — install a
// controllable stub and restore whatever was there before.
let writeText: ReturnType<typeof vi.fn>;
const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

beforeEach(() => {
  writeText = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  });
  document.execCommand = originalExecCommand;
});

describe("useClipboardWithToast", () => {
  it("toasts the localized default message and resolves true on success", async () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    const { copy } = useClipboardWithToast(toast);

    const ok = await copy("secret");

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("secret");
    expect(toast.success).toHaveBeenCalledWith("Copied");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("prefers the per-call message, then the call-site default thunk", async () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    const { copy } = useClipboardWithToast(toast, () => "site default");

    await copy("a", "per call");
    await copy("b");

    expect(toast.success).toHaveBeenNthCalledWith(1, "per call");
    expect(toast.success).toHaveBeenNthCalledWith(2, "site default");
  });

  it("toasts the localized failure message when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    // The base composable falls back to a textarea + execCommand path;
    // force that fallback to fail too so the error toast fires.
    document.execCommand = vi.fn(() => false) as unknown as typeof document.execCommand;

    const toast = { success: vi.fn(), error: vi.fn() };
    const { copy } = useClipboardWithToast(toast);

    const ok = await copy("secret");

    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Copy failed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
