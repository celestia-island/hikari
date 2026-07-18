import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/toast.scss";
import { useToast } from "../composables/useToast";

export default defineComponent({
  name: "HkToast",
  setup() {
    const { toasts } = useToast();

    return () => (
      <div class="hikari-toast-container">
        {toasts.value.map((toast) => (
          <div key={toast.id} class={["hikari-toast", `hikari-toast--${toast.type}`]}>
            {toast.message}
          </div>
        ))}
      </div>
    );
  },
});
