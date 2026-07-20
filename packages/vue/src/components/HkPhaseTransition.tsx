import { defineComponent, Transition, type PropType, type VNode } from "vue";

import "./HkPhaseTransition.scss";

export interface PhaseState {
  type: string;
  [key: string]: unknown;
}

export default defineComponent({
  name: "HkPhaseTransition",
  props: {
    state: {
      type: Object as PropType<PhaseState>,
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => {
      const state = props.state;
      const slotFn = slots[state.type];
      if (!slotFn) return null;

      const vnode = slotFn(state);
      const key = state.type + JSON.stringify(
        Object.entries(state)
          .filter(([k]) => k !== "type")
          .map(([k, v]) => `${k}:${String(v)}`),
      );

      return (
        <Transition name="hk-phase" mode="out-in" appear>
          <div key={key} class="hk-phase-content">
            {vnode}
          </div>
        </Transition>
      );
    };
  },
});
