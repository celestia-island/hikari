import { describe, expect, it, vi } from "vitest";

import { useOrientationLock } from "./useOrientationLock";

describe("useOrientationLock", () => {
  it("reports unsupported without the API and resolves lock to false", async () => {
    const orig = (screen as { orientation?: ScreenOrientation }).orientation;
    Object.defineProperty(screen, "orientation", { configurable: true, value: undefined });
    try {
      const { supported, lockLandscape } = useOrientationLock();
      expect(supported).toBe(false);
      expect(await lockLandscape()).toBe(false);
    } finally {
      Object.defineProperty(screen, "orientation", { configurable: true, value: orig });
    }
  });

  it("locks landscape through the API; a refusal resolves false", async () => {
    const orig = (screen as { orientation?: ScreenOrientation }).orientation;
    const lock = vi.fn(async () => {});
    const unlock = vi.fn(async () => {});
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: { lock, unlock },
    });
    try {
      const api = useOrientationLock();
      expect(api.supported).toBe(true);
      expect(await api.lockLandscape()).toBe(true);
      expect(lock).toHaveBeenCalledWith("landscape");
      await api.unlock();
      expect(unlock).toHaveBeenCalled();
      lock.mockRejectedValue(new DOMException("denied"));
      expect(await api.lockLandscape(), "a refusal is a false, never a throw").toBe(false);
    } finally {
      Object.defineProperty(screen, "orientation", { configurable: true, value: orig });
    }
  });
});
