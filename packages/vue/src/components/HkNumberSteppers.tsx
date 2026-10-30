import { defineComponent, onUnmounted, type PropType } from "vue";
import { ChevronDown, ChevronUp } from "lucide-vue-next";

import { scheduleAfter, scheduleEvery, type AnimationHandle } from "../runtime/animationBus";
import "./HkNumberSteppers.scss";

/** Shared stepper column for hikari's number fields (HkNumberInput and
 *  HkInput's number variant — type="number" / variant="number").
 *
 *  Extracted from HkNumberInput (2026-10-30) so the plain input can retire
 *  the browser-native spin buttons too: one lucide-drawn affordance
 *  (ChevronUp / ChevronDown) for every number field, replacing the
 *  hand-inlined polyline SVGs the dedicated component used to carry.
 *
 *  Interaction contract — the original HkNumberInput cadence, plus two
 *  hardening fixes:
 *  - click = one step; press-and-hold = 300ms arming delay, then a 50ms
 *    repeat, both scheduled on the shared animation bus so the hold
 *    cadence parks with the reduced-motion switch like every other
 *    JS-driven animation;
 *  - a hold that reached the repeat phase swallows its release click (the
 *    original delivered it as one extra step after a held run of repeats);
 *  - a hold dies the moment the host reports its direction bound dead
 *    (canUp/canDown flipping off mid-hold — the original kept the repeat
 *    entry alive on the bus after a clamped field hit its max);
 *  - non-primary buttons never arm the hold (the original intercepted
 *    right-clicks too), and leaving the button cancels a pending hold.
 *
 *  The buttons are tabindex=-1: keyboard users step through the field's
 *  native arrow keys (every host keeps real type="number" semantics) —
 *  the column is the pointer affordance on top. */
export default defineComponent({
  name: "HkNumberSteppers",
  emits: {
    /** Step intent — once per click, once per repeat tick while held. */
    step: (_dir: "up" | "down") => true,
  },
  props: {
    /** Bounds mirrored from the host field's min/max so a dead end renders
     *  greyed instead of silently ignoring clicks. */
    canUp: { type: Boolean, default: true },
    canDown: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
    /** Function ref for the host's width measurement — HkInput folds the
     *  column into its trailing affix reservation so centered text and the
     *  placeholder marquee never run underneath the buttons. */
    rootRef: {
      type: Function as PropType<(el: HTMLElement | null) => void>,
      default: undefined,
    },
  },
  setup(props, { emit }) {
    let holdDelay: AnimationHandle | null = null;
    let holdRepeat: AnimationHandle | null = null;
    /* Set by the FIRST repeat tick — the release click that follows a held
       run of steps must not add one more. */
    let holdRepeated = false;

    function step(dir: "up" | "down") {
      if (props.disabled) return;
      const blocked = dir === "up" ? !props.canUp : !props.canDown;
      if (blocked) {
        // The bound went dead under a live hold (a repeat stepped the field
        // onto its max) — release the hold instead of leaving the bus entry
        // running behind a disabled button no mouseup can reach.
        stopHold();
        return;
      }
      emit("step", dir);
    }

    function startHold(dir: "up" | "down") {
      stopHold();
      holdRepeated = false;
      // 300ms press threshold, then a 50ms repeat — both on the shared
      // animation bus (HkNumberInput's original cadence, kept verbatim).
      holdDelay = scheduleAfter(() => {
        holdDelay = null;
        holdRepeat = scheduleEvery(() => {
          holdRepeated = true;
          step(dir);
        }, 50);
      }, 300);
    }

    function stopHold() {
      holdDelay?.disconnect();
      holdDelay = null;
      holdRepeat?.disconnect();
      holdRepeat = null;
    }

    onUnmounted(stopHold);

    /* Created once per direction (not per render) so the div's ref handlers
       stay referentially stable — a per-render closure would make Vue detach
       and re-attach the ref on every patch. */
    function pressHandlers(dir: "up" | "down") {
      return {
        onMousedown: (e: MouseEvent) => {
          e.preventDefault();
          if (e.button !== 0) return;
          startHold(dir);
        },
        onMouseup: (e: MouseEvent) => {
          e.preventDefault();
          stopHold();
        },
        onMouseleave: () => stopHold(),
        onClick: (e: MouseEvent) => {
          e.preventDefault();
          if (holdRepeated) {
            holdRepeated = false;
            return;
          }
          step(dir);
        },
      };
    }

    const upHandlers = pressHandlers("up");
    const downHandlers = pressHandlers("down");

    function bindRoot(el: unknown) {
      props.rootRef?.((el as HTMLElement | null) ?? null);
    }

    return () => (
      <div
        class={["hk-number-input-steppers", `hk-number-input-steppers-${props.size}`]}
        ref={bindRoot}
      >
        <button
          type="button"
          class="hk-number-input-step hk-number-input-step-up"
          disabled={props.disabled || !props.canUp}
          tabindex={-1}
          {...upHandlers}
        >
          <ChevronUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="hk-number-input-step hk-number-input-step-down"
          disabled={props.disabled || !props.canDown}
          tabindex={-1}
          {...downHandlers}
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    );
  },
});
