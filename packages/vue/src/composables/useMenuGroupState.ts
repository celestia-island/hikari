import { inject, provide, shallowRef, type InjectionKey } from "vue";

/**
 * HkMenu sidebar GROUP fold, lifted above the shell's sidebar crossfade
 * (known-live-issues #43, 2026-10-31).
 *
 * THE DEFECT this closes: HkSidebarRailSwap hands the rail and full
 * densities to the content through a keyed crossfade, and a keyed swap
 * MOUNTS THE ENTERING GENERATION FRESH — that is the tab-panel contract,
 * kept on purpose (it is what freezes the leaving copy at its own width).
 * A sidebar slot holding an HkMenu therefore builds a NEW HkMenu instance
 * per generation, and 0.55.239 kept the group fold in instance-local
 * refs: a group collapsed in the rail came back expanded in the peek (or
 * in the expanded sidebar), directly contradicting what HkMenu's own
 * `collapsed` prop documents ("a group collapsed in the rail is still
 * collapsed after a peek/expand"). Measured on chest with its own source
 * and only the hikari version swapped: 0.55.236 kept the fold (2 rows,
 * `aria-expanded="false"`), 0.55.239 lost it (5 rows, `true`).
 *
 * THE FIX: HkFaceShell provides ONE stable fold store from ITS setup —
 * above the swap, hence identical for every generation the swap mounts —
 * and HkMenu injects it optionally. Whichever generation is live reads
 * and writes the same instance, so the user's word survives an arbitrary
 * number of remounts with no host-side change and no new prop.
 *
 * The store holds the USER'S word only (`true` = they opened the group,
 * `false` = they closed it; absent = untouched). HkMenu's per-instance
 * auto-expansion seed (the group holding the active row) stays local and
 * is re-derived on every mount, consulted only for keys the user has not
 * touched — an instance-local default must never outrank a shared
 * decision, which is exactly the resurrection this issue was about.
 *
 * `provide`/`inject` (not a module-level singleton): two independent
 * shells on one page must not share a fold, and a standalone HkMenu (no
 * shell at all) must keep the instance-local behavior it has always had.
 * The ITEM KEY is the shared identity inside one shell, so two grouped
 * menus mounted in the same shell share one key space — name their group
 * keys distinctly (they already name destinations, so this is the
 * natural convention).
 */

/** The fold store a shell provides above its sidebar swap. */
export interface MenuGroupState {
  /** The user's word on a group: `true` opened, `false` closed,
   *  `undefined` untouched (the menu's own defaults still apply). Reading
   *  it inside a render tracks the ref, so a toggle re-renders every live
   *  consumer of the store. */
  get(key: string): boolean | undefined;
  /** Record the user's word for a group. */
  set(key: string, expanded: boolean): void;
}

const MENU_GROUP_STATE_KEY: InjectionKey<MenuGroupState> = Symbol("hk-menu-group-state");

/** Provide the shell's shared fold store (HkFaceShell calls this once per
 *  shell, from setup, ABOVE the sidebar slot). */
export function provideMenuGroupState(): MenuGroupState {
  // shallowRef + a fresh Map per write: Set/Map mutations through a
  // `ref` are only reactive when the collection itself is the reactive
  // probe; replacing the map makes the update unambiguous for every
  // consumer (render reads, watchers) and keeps the previous snapshot
  // immutable while a leaving generation still renders against it.
  const choices = shallowRef<ReadonlyMap<string, boolean>>(new Map());
  const state: MenuGroupState = {
    get: (key) => choices.value.get(key),
    set: (key, expanded) => {
      const next = new Map(choices.value);
      next.set(key, expanded);
      choices.value = next;
    },
  };
  provide(MENU_GROUP_STATE_KEY, state);
  return state;
}

/** The shell-provided fold store, or `null` when there is none (a
 *  standalone HkMenu — it keeps its instance-local folded sets). */
export function useMenuGroupState(): MenuGroupState | null {
  return inject(MENU_GROUP_STATE_KEY, null);
}
