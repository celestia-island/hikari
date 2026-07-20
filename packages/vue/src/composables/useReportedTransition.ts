import { onUnmounted } from "vue";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { reportTransition, type AnimationHandle } from "../runtime/animationBus";

export interface ReportedTransitionTrack {
  run(): void;
  cancel(): void;
}

export interface ReportedTransition extends ReportedTransitionTrack {
  track(key: string): ReportedTransitionTrack;
}

export function useReportedTransition(durationMs: number): ReportedTransition {
  interface TrackState {
    handle: AnimationHandle | null;
    timer: CronHandle | null;
  }
  const tracks = new Map<string, TrackState>();
  const MAIN_TRACK_KEY = "";

  function getTrack(key: string): TrackState {
    let t = tracks.get(key);
    if (!t) {
      t = { handle: null, timer: null };
      tracks.set(key, t);
    }
    return t;
  }

  function cancelTrack(key: string) {
    const t = tracks.get(key);
    if (!t) return;
    t.timer?.disconnect();
    t.timer = null;
    t.handle?.disconnect();
    t.handle = null;
  }

  function runTrack(key: string) {
    const t = getTrack(key);
    t.timer?.disconnect();
    t.timer = null;
    t.handle?.disconnect();
    t.handle = reportTransition(durationMs);
    t.timer = scheduleCronAfter(() => {
      t.timer = null;
      t.handle?.disconnect();
      t.handle = null;
    }, durationMs);
  }

  function cancelAll() {
    for (const key of tracks.keys()) cancelTrack(key);
  }

  onUnmounted(cancelAll);

  return {
    run: () => runTrack(MAIN_TRACK_KEY),
    cancel: () => cancelTrack(MAIN_TRACK_KEY),
    track(key: string): ReportedTransitionTrack {
      return {
        run: () => runTrack(key),
        cancel: () => cancelTrack(key),
      };
    },
  };
}
