/** True when running inside the native shell's webview (a Tauri window
 *  today; the detection reads the Tauri runtime marker, but the name is
 *  shell-generic — `isNative`, 2026-10-28 user direction). */
export function isNative(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
