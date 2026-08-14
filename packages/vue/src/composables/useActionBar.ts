import { inject, onScopeDispose, provide, ref, type VNode } from "vue";

/**
 * Unified page action bar.
 *
 * A layout (`AdminLayout`, `ChatLayout`) calls `provideActionBar()` once and
 * renders `actions.value` somewhere in its header. Any descendant view then
 * registers its own top-bar buttons (refresh, add, search, …) via
 * `useActionBar().setActions(() => [...])` in its setup — the header updates
 * reactively.
 *
 * Registration is **per-component-scope**: when the registering view unmounts
 * (e.g. switching the chat surface between report review and node overview),
 * its actions are automatically cleared so a stale button can't linger from
 * the previous page. This is what lets different pages "own" the top-right
 * area cleanly, mirroring the admin panel.
 *
 * **Why a render function, not VNodes?** VNodes are single-use: once Vue
 * patches them into the DOM, re-using the same VNode object on the next
 * render cycle causes event handlers to silently detach (the click works
 * the first time but not after a re-render). Storing a function that returns
 * fresh VNodes ensures each render cycle gets a clean set with intact
 * event handlers.
 */

/** A function that produces fresh VNodes for the action bar on each render. */
export type ActionBarRenderer = () => VNode[];

interface ActionBarContext {
  actions: ReturnType<typeof ref<ActionBarRenderer | null>>;
}

const KEY = Symbol("action-bar");

export function provideActionBar() {
  const ctx: ActionBarContext = { actions: ref<ActionBarRenderer | null>(null) };
  provide(KEY, ctx);
  return ctx;
}

export function useActionBar() {
  const ctx = inject<ActionBarContext | null>(KEY, null);
  if (!ctx) {
    // No provider (e.g. outside any layout) — return a no-op.
    return {
      setActions: (_renderer: ActionBarRenderer) => {},
      clearActions: () => {},
    };
  }
  return {
    setActions: (renderer: ActionBarRenderer) => {
      ctx.actions.value = renderer;
      // Auto-clear when this view's effect scope dies so buttons never
      // outlive the page that registered them.
      onScopeDispose(() => {
        if (ctx.actions.value === renderer) {
          ctx.actions.value = null;
        }
      });
    },
    clearActions: () => {
      ctx.actions.value = null;
    },
    actions: ctx.actions,
  };
}
