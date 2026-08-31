import { computed, defineComponent, onBeforeUnmount, ref, Teleport, watch } from "vue";
import { usePopupManager, type PopupEntry } from "../runtime/usePopupManager";
import { useI18n } from "../i18n/context";
import { useReportedTransition } from "../composables/useReportedTransition";
import { scheduleEvery } from "../runtime/animationBus";
import "./HkModalBreadcrumb.scss";

/** Window kinds always participate in the stack: modals and drawers block
 *  the page on every form factor, desktop and mobile alike. */
const WINDOW_KINDS: ReadonlySet<string> = new Set(["modal", "drawer"]);

export default defineComponent({
  name: "HkModalBreadcrumb",
  props: {
    appRootId: { type: String, default: "app" },
    headerSelector: { type: String, default: ".hk-glass-header" },
    headerFallbackHeight: { type: Number, default: 48 },
  },
  setup(props) {
    const manager = usePopupManager();
    const { t } = useI18n();

    /** Which entries the strip navigates. Windows (modal/drawer) always;
     *  dropdown-kind surfaces only while they BLOCK like a window — the
     *  mobile bottom sheet a menu/popover becomes when viewport space
     *  forces it bottom-up. An anchored desktop popover/menu is a
     *  non-blocking hidden level: it never appears here, because it is
     *  not a window the user moves between, just a temporary attachment
     *  to the surface below. */
    const stackEntries = computed<PopupEntry[]>(() => {
      const entries: PopupEntry[] = [];
      for (const [, entry] of manager.registry.value) {
        if (WINDOW_KINDS.has(entry.kind) || entry.blocking) {
          entries.push(entry);
        }
      }
      return entries.sort((a, b) => a.zIndex - b.zIndex);
    });

    const visible = computed(() => stackEntries.value.length > 1);

    /** Every layer must carry a real, i18n-resolved name — the popup
     *  manager dev-warns on untitled registrations. The generic labels
     *  below are localized last resorts for production, never a bare
     *  "Layer N": an unnamed window reads as a window, an unnamed sheet
     *  reads as a menu. */
    const segments = computed(() =>
      stackEntries.value.map((entry, i) => ({
        label:
          entry.title ||
          (entry.kind === "dropdown"
            ? t("hikari::modal.unnamedSheet", "Menu")
            : t("hikari::modal.unnamedWindow", "Window")),
        current: i === stackEntries.value.length - 1,
      })),
    );

    const topPx = ref(24);
    function resyncTop() {
      const app = document.getElementById(props.appRootId);
      if (!app) return;
      const appTop = parseFloat(getComputedStyle(app).top) || 0;
      const header = app.querySelector(props.headerSelector) as HTMLElement | null;
      const headerH = header ? header.getBoundingClientRect().height : props.headerFallbackHeight;
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
          <nav
            class="hk-modal-breadcrumb"
            aria-label={t("hikari::modal.stackLabel", "Window layers")}
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
          </nav>
        </Teleport>
      ) : null;
  },
});
