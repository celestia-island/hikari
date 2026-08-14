import { defineComponent, ref, watch } from "vue";

export const PCountdownDigit = defineComponent({
  name: "HkCountdownDigit",
  props: {
    value: { type: Number, default: 0 },
  },
  setup(props) {
    const prevValue = ref(props.value);
    const key = ref(0);
    const oldDigit = ref(String(props.value));
    const newDigit = ref(String(props.value));

    watch(
      () => props.value,
      (next, old) => {
        if (next !== old) {
          oldDigit.value = String(old);
          newDigit.value = String(next);
          key.value++;
        }
      },
    );

    return () => (
      <span
        class="plana-countdown-digit"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0",
          fontVariantNumeric: "tabular-nums",
          height: "1em",
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        <span
          key={key.value}
          class="plana-countdown-digit-slot"
          style={{
            position: "relative",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            height: "1em",
            width: "1ch",
          }}
        >
          <span
            class="plana-flip-out"
            style={{
              display: "block",
              lineHeight: 1,
              animation: "plana-flip-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
            }}
          >
            {oldDigit.value}
          </span>
          <span
            class="plana-flip-in"
            style={{
              display: "block",
              lineHeight: 1,
              position: "absolute",
              inset: 0,
              animation: "plana-flip-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
            }}
          >
            {newDigit.value}
          </span>
        </span>
        <span
          style={{
            fontSize: "0.75em",
            opacity: 0.6,
            fontWeight: 400,
          }}
        >
          s
        </span>
        <style>{`
          @keyframes plana-flip-out {
            0%   { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-1em); opacity: 0; }
          }
          @keyframes plana-flip-in {
            0%   { transform: translateY(1em); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </span>
    );
  },
});
