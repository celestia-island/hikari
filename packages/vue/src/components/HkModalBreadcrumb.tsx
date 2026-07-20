import { computed, defineComponent, onBeforeUnmount, ref, Teleport, watch } from "vue";
import { usePopupManager } from "../runtime/usePopupManager";
import { useReportedTransition } from "../composables/useReportedTransition";
import { scheduleEvery } from "../runtime/animationBus";
import "./HkModalBreadcrumb.scss";

export default defineComponent({
  name: "HkModalBreadcrumb",
  setup() {
    const manager = usePopupManager();

    const modalEntries = computed(() => {
      const entries: { id: string; zIndex: number; title?: string }[] = [];
      for (const [, entry] of manager.registry.value) {
        if (entry.kind === "modal") {
          entries.push({ id: entry.id, zIndex: entry.zIndex, title: entry.title });
        }
      }
      return entries.sort((a, b) => a.zIndex - b.zIndex);
    });

    const visible = computed(() => modalEntries.value.length > 1);

    const segments = computed(() =>
      modalEntries.value.map((m, i) => ({
        label: m.title || `Layer ${i + 1}`,
        current: i === modalEntries.value.length - 1,
      })),
    );

    const topPx = ref(24);
    function resyncTop() {
      const app = document.getElementById("app");
      if (!app) return;
      const appTop = parseFloat(getComputedStyle(app).top) || 0;
      const header = app.querySelector(".hk-glass-header") as HTMLElement | null;
      const headerH = header ? header.getBoundingClientRect().height : 48;
      topPx.value = appTop + headerH / 2;
    }

    const ENTER_ANIM_MS = 150;
    const enterAnim = useReportedTransition(ENTER_ANIM_MS);
    let handle: ReturnType<typeof scheduleEvery> | null = null;
    watch(
      visible,
      (v) => {
        if (v) {
          resyncTop();
          enterAnim.run();
          if (!handle) handle = scheduleEvery(resyncTop, 1000);
          window.addEventListener("resize", resyncTop);
        } else {
          enterAnim.cancel();
          if (handle) {
            handle.disconnect();
            handle = null;
          }
          window.removeEventListener("resize", resyncTop);
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      if (handle) handle.disconnect();
      window.removeEventListener("resize", resyncTop);
    });

    return () =>
      visible.value ? (
        <Teleport to="body">
          <div
            class="hk-modal-breadcrumb"
            aria-live="polite"
            style={{ top: `${topPx.value}px` }}
          >
            {segments.value.map((seg, i) => (
              <span key={i} class="hk-modal-breadcrumb-crumb">
                {i > 0 && (
                  <svg
                    class="hk-modal-breadcrumb-sep"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
                <span
                  class={[
                    "hk-modal-breadcrumb-item",
                    seg.current && "hk-modal-breadcrumb-item-current",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {seg.label}
                </span>
              </span>
            ))}
          </div>
        </Teleport>
      ) : null;
  },
});
