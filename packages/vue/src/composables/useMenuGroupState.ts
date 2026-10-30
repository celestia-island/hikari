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
 * THE FIX: whoever holds the rail chrome provides ONE stable fold store
 * from ITS setup, ABOVE the swap — hence identical for every generation
 * the swap mounts — and HkMenu injects it optionally. Both holders do it:
 * HkFaceShell unconditionally, and a standalone `HkSidebar collapsible`
 * when it finds no store above it (inject-then-provide; a sidebar nested
 * in a shell inherits the shell's, so one nav keeps ONE fold). Whichever
 * generation is live reads and writes the same instance, so the user's
 * word survives an arbitrary number of remounts with no host-side change
 * and no new prop.
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
 *
 * HOSTS THAT OWN THE SLOT THEMSELVES (chest's console, 2026-10-31): a
 * slot's component parent is the component that DEFINED it, so a
 * provide inside HkFaceShell does NOT reach content the host writes for
 * the shell's sidebar slot — the host is that content's parent and the
 * shell is only its DOM/CSS host (measured: chest's grouped nav lost the
 * fold on 0.55.240 while the shell's own slot content kept it). Such a
 * host starts the chain at its own setup level with
 * provideMenuGroupState (one call, ABOVE the swap — the page component
 * survives a density flip). HkMenu's inject then finds it through the
 * host, and every generation the swap mounts shares it.
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

/** Provide a rail-chrome holder's fold store (HkFaceShell calls this
 *  unconditionally; HkSidebar calls it when no store is above it). Call it
 *  from setup, ABOVE the sidebar swap. */
export function provideMenuGroupState(): MenuGroupState {
  // shallowRef + a fresh Map per write: an in-place Set/Map mutation is a
  // reactive collection write only through Vue's collection handlers, and
  // it makes every consumer read a collection that is being changed under
  // it. Replacing the map gives exactly one unambiguous change per user
  // action and no partially updated fold. NOTE, measured (mount/unmount
  // counters plus the mid-dissolve case in HkFaceShell.rail.test.tsx): a
  // crossfade's LEAVING generation is unmounted at the flip moment itself —
  // only the DOM it rendered is kept for the dissolve — so a store write
  // cannot reach it at all. The immutability is about the LIVE consumers;
  // it is not a snapshot held on the dead copy's behalf.
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
