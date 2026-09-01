import { useReportedTransition, type ReportedTransitionTrack } from "./useReportedTransition";

/**
 * Standard wiring between an overlay surface's CSS enter/leave
 * transitions and the unified animation context.
 *
 * Every popup/modal surface in hikari animates open/close through CSS
 * transitions on a Vue `<Transition>`. The animation context
 * (`runtime/animationBus.ts`) only knows about those transitions when
 * somebody REPORTS them — otherwise the bus considers itself idle while
 * a pure-CSS transition is still running, and coordination (reduced
 * motion, performance suspension, JS-driven choreography that must
 * outlive the CSS fade) breaks.
 *
 * This composable turns the HkPopover bookkeeping pattern into one
 * reusable shape so every surface reports identically:
 *
 * ```tsx
 * const surf = useSurfaceTransition(300);
 * <Transition name="hk-…" appear {...surf.hooks()}>
 * ```
 *
 * Multi-layer surfaces (scrim + panel, overlay + content) report on
 * separate named tracks so each layer's report is armed/cancelled
 * independently: `surf.hooks("scrim")`, `surf.hooks("panel")`.
 */

export interface SurfaceTransitionHooks {
  onBeforeEnter(): void;
  onAfterEnter(): void;
  onBeforeLeave(): void;
  onAfterLeave(): void;
  /** A cancelled transition must release its report like a finished
   *  one — otherwise the track stays armed until the duration cron
   *  self-heals (advisory over-reporting, ≤ duration window). */
  onEnterCancelled(): void;
  onLeaveCancelled(): void;
}

export interface SurfaceTransition {
  /**
   * A Vue `<Transition>` hook set bound to one named track. Spread it
   * onto the Transition (or merge the individual hooks with your own
   * after-enter/after-leave logic — call the hook's method first so
   * the report is cancelled even if your logic throws).
   */
  hooks(key?: string): SurfaceTransitionHooks;
  /** Raw reported-transition track for custom arming. */
  track(key?: string): ReportedTransitionTrack;
}

export function useSurfaceTransition(durationMs: number): SurfaceTransition {
  const reported = useReportedTransition(durationMs);

  return {
    track(key?: string): ReportedTransitionTrack {
      return reported.track(key ?? "");
    },
    hooks(key?: string): SurfaceTransitionHooks {
      const t = () => reported.track(key ?? "");
      return {
        onBeforeEnter: () => { t().run(); },
        onAfterEnter: () => { t().cancel(); },
        onBeforeLeave: () => { t().run(); },
        onAfterLeave: () => { t().cancel(); },
        onEnterCancelled: () => { t().cancel(); },
        onLeaveCancelled: () => { t().cancel(); },
      };
    },
  };
}
