import { defineComponent } from "vue";

export default defineComponent({
  name: "HkLocalePickerPopup",
  props: {
    open: { type: Boolean, default: false },
    triggerRef: { type: Object as () => HTMLElement | null, default: null },
  },
  emits: ["update:open", "select"],
  setup() {
    return () => null;
  },
});
