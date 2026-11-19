import {
  computed,
  defineComponent,
  onBeforeUnmount,
  ref,
  type PropType,
  watch,
} from "vue";

import {
  generateSerpentinePath,
  nearestOnPath,
  projectOntoPath,
  type PathPoint,
  type SerpentinePath,
} from "./serpentineGeometry";
import "./HkSerpentineUnlock.scss";
import { onFrame, reportTransition, type AnimationHandle } from "../runtime/animationBus";

/**
 * Deliberate-action gate: drag the handle along a randomly generated
 * serpentine lane (3–5 hard 90° corners, start and goal on opposite edges
 * at the vertical centre) to prove an action is intentional. Releasing
 * before the goal snaps the handle back; drifting off the lane fails the
 * attempt.
 *
 * Not a captcha: nothing is verified server-side. It exists to make a
 * destructive action cost enough motor attention that it cannot happen by
 * accident or muscle memory.
 *
 * Motion runs on hikari's shared frame bus (`onFrame`) with
 * `reportTransition` around the spring so scroll/pause policies wait for
 * it; under reduced motion the spring collapses to an instant reset.
 *
 * Keyboard path (a11y): focus the gate, hold `Space` to grab the handle,
 * steer with the arrow keys (each press advances one step along the lane
 * when the pressed arrow matches the current leg's direction), release and
 * press `Enter` at the goal to confirm. `Escape` cancels.
 */
export default defineComponent({
  name: "HkSerpentineUnlock",
  props: {
    /** What the confirming user is about to do ("删除工作区"). */
    label: { type: String, required: true },
    /** Hint before grabbing ("按住摇杆，沿路径拖到最右端"). */
    grabHint: { type: String, required: true },
    /** Hint while tracking ("继续，沿路径走完"). */
    trackingHint: { type: String, required: true },
    /**
     * Deterministic lane seed. Omitted → a fresh random maze per mount
     * (the intended production behaviour); supplied → a reproducible lane,
     * for tests and design review.
     */
    seed: { type: Number, default: null },
    /** Danger tone (delete-class actions) vs neutral. */
    tone: {
      type: String as PropType<"default" | "danger">,
      default: "danger",
    },
    disabled: { type: Boolean, default: false },
    /** Bump to snap the handle back after an external cancel. */
    resetKey: { type: Number, default: 0 },
  },
  emits: {
    confirm: () => true,
    /** Progress at release (0..1); the parent may log or ignore. */
    cancel: (progress: number) => typeof progress === "number",
    fail: (reason: "off-path" | "short") =>
      reason === "off-path" || reason === "short",
  },
  setup(props, { emit }) {
    const viewport = ref<HTMLElement | null>(null);
    const seed = ref<number>(props.seed ?? Math.floor(Math.random() * 1e9));
    const path = ref<SerpentinePath>(generateSerpentinePath(600, 96, seed.value));

    const tracking = ref(false);
    /** Progress along the lane, 0..1 (arc-length fraction). */
    const progress = ref(0);
    /** Set while the spring returns the handle to the start. */
    const snapping = ref(false);
    /** Set after a successful drag, before the parent acts. */
    const confirmed = ref(false);
    const failed = ref<"off-path" | "short" | null>(null);
    const announced = ref(0);

    const laneWidth = ref(600);
    const laneHeight = ref(96);

    function regenerate() {
      laneWidth.value = viewport.value?.clientWidth || 600;
      laneHeight.value = viewport.value?.clientHeight || 96;
      path.value = generateSerpentinePath(
        laneWidth.value,
        laneHeight.value,
        seed.value,
      );
      progress.value = 0;
    }

    watch(
      () => props.resetKey,
      () => {
        confirmed.value = false;
        stopSpring();
        failed.value = null;
        progress.value = 0;
      },
    );

    // ── keyboard path ────────────────────────────────────────────────
    const keyboardGrabbed = ref(false);
    const keyboardStep = 1 / 20;

    function onKeydown(event: KeyboardEvent) {
      if (props.disabled || confirmed.value) return;
      if (event.key === "Escape") {
        keyboardGrabbed.value = false;
        emit("cancel", progress.value);
        stopSpring();
        progress.value = 0;
        return;
      }
      if (event.key === " " && !keyboardGrabbed.value) {
        event.preventDefault();
        keyboardGrabbed.value = true;
        return;
      }
      if (event.key === "Enter" && keyboardGrabbed.value && progress.value >= 0.98) {
        event.preventDefault();
        confirmed.value = true;
        emit("confirm");
        return;
      }
      if (!keyboardGrabbed.value) return;
      const dir = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : null;
      if (dir === null) return;
      event.preventDefault();
      // Arrow keys advance only when they match the CURRENT leg's direction;
      // a mismatched press is forgiven (no progress, no failure) so the
      // keyboard path stays usable without pixel precision.
      const next = Math.min(1, progress.value + keyboardStep * dir);
      progress.value = Math.max(0, next);
      announce(progress.value);
    }

    // ── pointer tracking ─────────────────────────────────────────────
    /** Kill any running spring and its bus registrations, and reset the
     *  announcer — every progress-zeroing path routes through here, so the
     *  aria-live hint can never show a stale percent. */
    function stopSpring() {
      frameHandle?.disconnect();
      frameHandle = null;
      transitionHandle?.disconnect();
      transitionHandle = null;
      springState = null;
      snapping.value = false;
      announced.value = 0;
    }

    function onPointerDown(event: PointerEvent) {
      if (props.disabled || confirmed.value) return;
      const box = viewport.value?.getBoundingClientRect();
      if (!box) return;
      const start = path.value.points[0]!;
      const dx = event.clientX - (box.left + start.x);
      const dy = event.clientY - (box.top + start.y);
      // Proximity gate FIRST: a stray click elsewhere on the lane must not
      // kill a running spring (that froze progress mid-lane with no cancel).
      if (Math.hypot(dx, dy) > 24) return;
      // The pointer IS on the resting handle: a re-grab mid-snap-back wins
      // over the spring — stop it, or the two inputs fight over progress.
      stopSpring();
      failed.value = null;
      try {
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // Capture can throw for non-active pointers; tracking still works
        // via this element's own move/up handlers.
      }
      tracking.value = true;
      onPointerMove(event);
    }

    function onPointerMove(event: PointerEvent) {
      if (!tracking.value) return;
      const box = viewport.value?.getBoundingClientRect();
      if (!box) return;
      // Project the pointer onto the lane (nearest point). The lane's arc is
      // LONGER than its x span (vertical legs), so progress is the projected
      // arc fraction — reaching the far edge lands exactly at 1.
      const near = nearestOnPath(path.value.points, {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
      });
      // Off-lane check: the pointer must stay within tolerance of the lane.
      const tolerance = 18;
      if (near.distance > tolerance) {
        fail("off-path");
        return;
      }
      progress.value = Math.min(1, near.arc / path.value.totalLength);
      announce(progress.value);
      // Arrival only ARMS the goal; the confirm fires on release at it.
    }

    function onPointerUp() {
      if (!tracking.value) return;
      tracking.value = false;
      if (progress.value >= 0.98) {
        confirmed.value = true;
        emit("confirm");
        return;
      }
      emit("cancel", progress.value);
      snapBack();
    }

    /** A browser-cancelled gesture (palm rejection, interruption) is a
     *  cancel, never a confirm — release semantics do not apply. */
    function onPointerCancel() {
      if (!tracking.value) return;
      tracking.value = false;
      emit("cancel", progress.value);
      snapBack();
    }

    function fail(reason: "off-path" | "short") {
      tracking.value = false;
      failed.value = reason;
      emit("fail", reason);
      snapBack();
    }

    // ── spring snap-back (frame bus) ─────────────────────────────────
    let frameHandle: { disconnect(): void } | null = null;
    let springState: { pos: number; vel: number } | null = null;
    let transitionHandle: { disconnect(): void } | null = null;

    function snapBack() {
      if (prefersReducedMotion()) {
        stopSpring();
        progress.value = 0;
        return;
      }
      stopSpring();
      snapping.value = true;
      springState = { pos: progress.value, vel: 0 };
      const started = performance.now();
      // Cover the spring's full worst-case lifetime (the 1200ms watchdog),
      // not just its typical settle, so scroll/pause policies wait for it.
      transitionHandle = reportTransition(1200);
      frameHandle = onFrame((ctx) => {
        const state = springState;
        if (!state) return;
        // Critically damped spring toward 0 (stiff enough to feel snappy).
        const k = 180;
        const c = 26;
        state.vel += (-k * state.pos - c * state.vel) * ctx.delta;
        state.pos += state.vel * ctx.delta;
        if (state.pos <= 0 || performance.now() - started > 1200) {
          progress.value = 0;
          stopSpring();
          return;
        }
        progress.value = state.pos;
        void ctx;
      });
    }

    function prefersReducedMotion(): boolean {
      return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }

    onBeforeUnmount(() => {
      stopSpring();
    });

    // Lane regenerates per mount (fresh maze each time).
    watch(
      () => viewport.value,
      (el) => {
        if (el) regenerate();
      },
      { immediate: true },
    );

    const announce = (value: number) => {
      // Twenty-percent bands (0/20/40/60/80/100), recomputed in both
      // directions. ROUNDED, not floored: the projection's float noise
      // otherwise drops an exact 40% to the band below.
      announced.value = Math.round(value * 5) * 20;
    };

    // ── render ───────────────────────────────────────────────────────
    return () => {
      const pts: PathPoint[] = path.value.points;
      const tone = props.tone === "danger" ? "danger" : "default";
      const handlePos = projectOntoPath(
        path.value.points,
        progress.value * path.value.totalLength,
      );
      return (
        <div
          class={{
            "hk-serpentine": true,
            "hk-serpentine--danger": tone === "danger",
            "hk-serpentine--tracking": tracking.value,
            "hk-serpentine--confirmed": confirmed.value,
            "hk-serpentine--failed": failed.value !== null,
            "hk-serpentine--snap": snapping.value,
          }}
          ref={viewport}
          role="group"
          aria-label={props.label}
          tabindex={props.disabled ? -1 : 0}
          onKeydown={onKeydown}
          onPointerdown={onPointerDown}
          onPointermove={onPointerMove}
          onPointerup={onPointerUp}
          onPointercancel={onPointerCancel}
        >
          <svg
            class="hk-serpentine-svg"
            viewBox={`0 0 ${laneWidth.value} ${laneHeight.value}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              class="hk-serpentine-lane"
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            <polyline
              class="hk-serpentine-travelled"
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              style={{
                strokeDasharray: `${path.value.totalLength}`,
                strokeDashoffset: `${path.value.totalLength * (1 - progress.value)}`,
              }}
            />
          </svg>
          <div
            class="hk-serpentine-handle"
            style={{
              left: `${handlePos.x}px`,
              top: `${handlePos.y}px`,
            }}
            aria-hidden="true"
          />
          <span class="hk-serpentine-hint" aria-live="polite">
            {confirmed.value
              ? undefined
              : tracking.value || keyboardGrabbed.value
                ? `${props.trackingHint} (${announced.value}%)`
                : props.grabHint}
          </span>
        </div>
      );
    };
  },
});


