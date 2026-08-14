import { watch } from "vue";

/** Structural title holder — accepts any Vue `Ref`/`ComputedRef` from the
 *  consumer regardless of which vue copy resolved it (monorepo sibling
 *  linking can produce dual vue type identities). */
export interface TitleRef {
  value: string;
}

export function useRouteTitle(
  siteName: string,
  currentRoute: TitleRef,
  routeMap: Record<string, string>,
  t: (key: string, fallback?: string) => string,
): void {
  watch(() => currentRoute.value, (route) => {
    const key = routeMap[route];
    if (key) {
      document.title = `${t(key)} \u2014 ${siteName}`;
    } else {
      document.title = siteName;
    }
  }, { immediate: true });
}

export function usePageTitle(
  pageTitle: TitleRef,
  siteName: string,
): void {
  watch(() => pageTitle.value, (title) => {
    if (title) {
      document.title = `${title} \u2014 ${siteName}`;
    } else {
      document.title = siteName;
    }
  }, { immediate: true });
}
