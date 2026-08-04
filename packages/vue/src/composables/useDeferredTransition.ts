import { nextTick, onMounted, ref } from "vue";

/** Mount-then-double-nextTick animation gate (upstreamed from shittim-chest). */
export function useDeferredTransition() {
  const animated = ref(false);

  onMounted(() => {
    nextTick(() => {
      nextTick(() => {
        animated.value = true;
      });
    });
  });

  return { animated };
}
