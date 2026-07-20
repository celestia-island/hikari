import { inject, provide, type InjectionKey, type Ref } from "vue";

export interface ScrollWindowContext {
  scrollRoot: Ref<HTMLElement | null>;
  overscanScreens: number;
}

const SCROLL_WINDOW_KEY: InjectionKey<ScrollWindowContext> = Symbol("scroll-window");

export function provideScrollWindow(
  scrollRoot: Ref<HTMLElement | null>,
  overscanScreens = 1,
): ScrollWindowContext {
  const ctx: ScrollWindowContext = { scrollRoot, overscanScreens };
  provide(SCROLL_WINDOW_KEY, ctx);
  return ctx;
}

export function useScrollWindow(): ScrollWindowContext | null {
  return inject(SCROLL_WINDOW_KEY, null);
}
