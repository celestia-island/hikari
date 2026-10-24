/**
 * Central window-chrome guard — the title bar's modal-open policy.
 *
 * While ANY modal-kind window (HkModal and every dialog composed on it)
 * is on screen, the host's window caption bar must stop being a
 * launcher: user direction 2026-10-24 pins the policy to "the drag
 * surface and the caption buttons stay alive, everything else in the
 * bar is dead" — nav switches, hamburger buttons and custom caption
 * actions opened the wrong surfaces underneath a veil too easily, and
 * a click meant for the veil kept landing on bar controls that only
 * LOOKED covered on hosts whose chrome loses the stacking race (see
 * the HkTitleBar doc for the stacking contract).
 *
 * The policy is opt-out per control, not per bar: a window may keep
 * specific caption actions clickable while it is open (an "open
 * settings" gear that must survive its own confirm dialog, say) by
 * listing their HkTitleBar `customActions` ids in HkModal's
 * `keepCaptionActions`. The guard publishes the UNION of the live
 * windows' lists, so stacked windows each re-allow what they need.
 *
 * Mechanism: a module-level reactive counter + allowlist set. Windows
 * push on open (surface mounted) and pop on close (surface left);
 * HkTitleBar reads the published state and flips into its guarded
 * rendering (`data-chrome-guarded`, disabled custom actions). The
 * counter survives stacked windows (two open modals close one at a
 * time) and absorbs unmount-without-close through HkModal's
 * onBeforeUnmount safety pop.
 */

import { computed, ref } from "vue";

const depth = ref(0);
const keepIds = ref<ReadonlySet<string>>(new Set());

/** One entry per live guarded window, in push order — pop removes by
 *  identity so a late unmount pops exactly what its open pushed. */
const liveKeepLists: string[][] = [];

function rebuildKeepUnion(): void {
  const union = new Set<string>();
  for (const list of liveKeepLists) {
    for (const id of list) union.add(id);
  }
  keepIds.value = union;
}

/**
 * Register an open window. `keep` lists HkTitleBar `customActions` ids
 * that must stay clickable while this window is open. Every push needs
 * exactly one matching {@link popChromeGuard} (or an unmount safety
 * pop) or the bar stays guarded forever.
 *
 * Server renders no-op: an SSR pass of an open modal would push with no
 * unmount hooks ever running, leaking the guard into every later
 * HkTitleBar render of the same process. The guard is an interaction
 * policy — there is nothing for a server to publish.
 */
export function pushChromeGuard(keep: readonly string[] = []): void {
  if (typeof document === "undefined") return;
  liveKeepLists.push([...keep]);
  depth.value += 1;
  rebuildKeepUnion();
}

/**
 * Release one open window. Pops the MOST RECENT push with an identical
 * allowlist (open/close pairs bracket the same list), keeping the
 * accounting honest when interleaved windows use different lists.
 */
export function popChromeGuard(keep: readonly string[] = []): void {
  if (typeof document === "undefined") return;
  const wanted = [...keep];
  for (let i = liveKeepLists.length - 1; i >= 0; i -= 1) {
    const candidate = liveKeepLists[i];
    if (
      candidate.length === wanted.length &&
      candidate.every((id, index) => id === wanted[index])
    ) {
      liveKeepLists.splice(i, 1);
      depth.value = Math.max(0, depth.value - 1);
      rebuildKeepUnion();
      return;
    }
  }
  // Unmatched pop (double-close, host bug): floor at zero and leave the
  // union alone rather than corrupting the live lists.
  depth.value = Math.max(0, depth.value - 1);
}

/** True while at least one guarded window is open. */
const chromeGuardActive = computed(() => depth.value > 0);

/**
 * The published guard state for chrome components: `active` flips the
 * bar's guarded rendering, `keep` is the live union of caption-action
 * ids that stay clickable. Frozen computed refs — read `.value` (the
 * refs stay unwrapped and reassignable through a reactive() wrapper,
 * which is exactly what a publish channel must not be).
 */
export const chromeGuard = Object.freeze({
  active: chromeGuardActive,
  keep: computed(() => keepIds.value),
});
