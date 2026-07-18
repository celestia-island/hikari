import { computed, onMounted, onUnmounted, ref } from "vue";

type BreakpointKey = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const breakpointValues: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

const isServer = typeof window === "undefined";

export function useBreakpoint() {
  if (isServer) {
    const fallbackWidth = ref(1024);
    const current = computed<BreakpointKey>(() => "lg");
    const isMobile = computed(() => false);
    const isTablet = computed(() => false);
    const isDesktop = computed(() => true);
    const isAbove = (_bp: BreakpointKey) => computed(() => true);
    const isBelow = (_bp: BreakpointKey) => computed(() => false);
    return { width: fallbackWidth, current, isMobile, isTablet, isDesktop, isAbove, isBelow };
  }

  const width = ref(window.innerWidth);

  function handleResize() {
    width.value = window.innerWidth;
  }

  onMounted(() => {
    window.addEventListener("resize", handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", handleResize);
  });

  const current = computed<BreakpointKey>(() => {
    const w = width.value;
    if (w >= 1536) return "2xl";
    if (w >= 1280) return "xl";
    if (w >= 1024) return "lg";
    if (w >= 768) return "md";
    if (w >= 640) return "sm";
    return "xs";
  });

  const isMobile = computed(() => width.value < 768);
  const isTablet = computed(() => width.value >= 768 && width.value < 1024);
  const isDesktop = computed(() => width.value >= 1024);

  const isAbove = (bp: BreakpointKey) =>
    computed(() => width.value >= breakpointValues[bp]);
  const isBelow = (bp: BreakpointKey) =>
    computed(() => width.value < breakpointValues[bp]);

  return { width, current, isMobile, isTablet, isDesktop, isAbove, isBelow };
}
