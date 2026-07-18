import { ref, onMounted, onUnmounted } from "vue";

type Breakpoint = "sm" | "md" | "lg" | "xl";

const breakpoints: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function useBreakpoint() {
  const current = ref<Breakpoint>("md");

  function update() {
    const width = window.innerWidth;
    if (width >= breakpoints.xl) current.value = "xl";
    else if (width >= breakpoints.lg) current.value = "lg";
    else if (width >= breakpoints.md) current.value = "md";
    else current.value = "sm";
  }

  function isUp(bp: Breakpoint) {
    return window.innerWidth >= breakpoints[bp];
  }

  function isDown(bp: Breakpoint) {
    return window.innerWidth < breakpoints[bp];
  }

  onMounted(() => {
    update();
    window.addEventListener("resize", update);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", update);
  });

  return { current, isUp, isDown };
}
