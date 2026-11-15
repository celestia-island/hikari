// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

/**
 * useOrientationLock — request landscape for the remote-control
 * fullscreen posture (2026-11-15 user direction: 自动触发横屏).
 *
 * The Screen Orientation API only honours `lock()` while the document
 * holds a fullscreen element — callers therefore lock on entering the
 * session-pane fullscreen and unlock on exit. Engines without the API
 * (iOS Safari) resolve `lock()` to false: the host shows its
 * "rotate the phone" hint instead, never a silent dead control.
 */
export function useOrientationLock() {
  const orientation = typeof screen !== "undefined" && "orientation" in screen
    ? (screen as Screen & { orientation?: ScreenOrientation }).orientation
    : undefined;
  const supported = typeof orientation?.lock === "function";

  async function lockLandscape(): Promise<boolean> {
    if (!supported || !orientation) return false;
    try {
      await orientation.lock("landscape");
      return true;
    } catch {
      // Not in fullscreen, engine refused, or the platform ignores it.
      return false;
    }
  }

  async function unlock(): Promise<void> {
    try {
      await orientation?.unlock?.();
    } catch {
      /* unlocking an unlocked orientation is a no-op at worst */
    }
  }

  return { supported, lockLandscape, unlock };
}
