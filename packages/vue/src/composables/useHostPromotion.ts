/**
 * Reference-counted host-position promotion, shared by every composable
 * that needs a positioned positioning context (the overlay scrollbar and
 * the overview ruler). A module-private WeakMap per composable is the
 * exact accident this exists to prevent: ruler A's detach stripping the
 * positioning out from under a still-live scrollbar B on the same host.
 *
 * Contract:
 *   - `promoteHost(host)` counts the caller and returns its release;
 *   - the FIRST caller on a static/empty-position host sets
 *     `position: relative`; every later caller (whatever the computed
 *     position now is) is still counted;
 *   - the LAST release restores the PRE-ATTACH inline position — unless a
 *     consumer re-styled the host after attach (their style wins; the
 *     saved value stays dead).
 */

const promotedParents = new WeakMap<HTMLElement, { count: number; saved: string }>();

export function promoteHost(host: HTMLElement): () => void {
  let entry = promotedParents.get(host);
  if (!entry) {
    entry = { count: 0, saved: host.style.position };
    promotedParents.set(host, entry);
  }
  entry.count += 1;
  const computedPosition = getComputedStyle(host).position;
  if (entry.count === 1 && (computedPosition === "static" || computedPosition === "")) {
    host.style.position = "relative";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = promotedParents.get(host);
    if (!current || current !== entry) return;
    entry.count -= 1;
    if (entry.count <= 0) {
      // Only undo OUR promotion: if a consumer re-positioned the host
      // after attach, their inline style wins and the saved value stays
      // dead (presence-gated, per R4b).
      if (host.style.position === "relative") host.style.position = entry.saved;
      promotedParents.delete(host);
    }
  };
}
