import { computed, defineComponent, ref } from "vue";
import { HDrawer, HScrollContainer, useBreakpoint } from "@celestia-island/hikari";
import { provideActionBar } from "../composables/useActionBar";
import { useI18n } from "../i18n/context";

export const HkAdminShell = defineComponent({
  name: "HkAdminShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "224px" },
    /** Viewport width at which the desktop layout takes over (below it
     *  the nav collapses into the mobile drawer). Defaults to the shared
     *  1024px "lg" breakpoint; lower it (e.g. 768) for tablet-friendly
     *  admins that keep the sidebar at md widths. */
    mobileBreakpoint: { type: Number, default: 1024 },
    footerHeight: { type: String, default: "var(--s-footer-height)" },
    navTitle: { type: String, default: undefined },
    /** Extra class for the mobile nav drawer's panel — lets consumers zero
     *  nested paddings so drawer nav rows and a `userPanel` footer share
     *  one left edge. */
    drawerPanelClass: { type: String, default: undefined },
    /** Content-area padding (inside the scroll viewport). Padding is
     *  applied to an inner wrapper rather than the scroll container so
     *  card box-shadows are never clipped at the viewport edges. */
    contentPadding: { type: String, default: "1.5rem" },
  },
  setup(props, { slots }) {
    const { t } = useI18n();
    const { width: viewportWidth } = useBreakpoint();
    const isDesktop = computed(() => viewportWidth.value >= props.mobileBreakpoint);
    const sidebarOpen = ref(false);

    const actionBar = provideActionBar();

    const toggleHamburger = () => {
      sidebarOpen.value = !sidebarOpen.value;
    };

    const openSidebar = () => {
      sidebarOpen.value = true;
    };

    const closeSidebar = () => {
      sidebarOpen.value = false;
    };

    return () => (
      <div class="flex flex-col h-full w-full overflow-hidden">
        {slots.header && (
          <div style={{ flexShrink: 0 }}>
            {slots.header({
              isDesktop: isDesktop.value,
              showHamburger: !isDesktop.value,
              compact: !isDesktop.value,
              actions: actionBar.actions.value ? actionBar.actions.value() : [],
              onHamburger: toggleHamburger,
              // Lets a header trigger (e.g. the avatar in "drawer" action
              // mode) open the mobile nav drawer directly.
              onOpenDrawer: openSidebar,
            })}
          </div>
        )}

        <div class="flex flex-1 min-h-0" style={{ paddingBottom: props.footerHeight }}>
          {isDesktop.value && !props.sidebarCollapsed && slots.sidebar && (
            <aside
              style={{
                width: props.sidebarWidth,
                flexShrink: 0,
                borderRight: "1px solid var(--border-faint, rgb(var(--color-border) / 10%))",
                background: "rgb(var(--color-surface))",
                overflow: "hidden",
              }}
            >
              {slots.sidebar({ collapsed: false, onNavigate: closeSidebar })}
            </aside>
          )}
          <main class="flex-1 flex flex-col min-w-0 min-h-0">
            <HScrollContainer class="flex-1 min-h-0">
              {/* Padding lives INSIDE the scroll viewport (an inner
                  wrapper) so card box-shadows are not clipped at the
                  viewport edges. */}
              <div style={{ padding: props.contentPadding }}>{slots.content?.()}</div>
            </HScrollContainer>
          </main>

          {!isDesktop.value && (
            <HDrawer
              modelValue={sidebarOpen.value}
              onUpdate:modelValue={(v: boolean) => (sidebarOpen.value = v)}
              side="left"
              size="280px"
              title={props.navTitle ?? t("hikari::adminShell.navTitle", "Navigation")}
              panelClass={props.drawerPanelClass}
            >
              {/* The drawer body carries the nav; a `userPanel` slot rides
                  the drawer footer (identity + account actions) so mobile
                  gets the same content the desktop user menu exposes.
                  `inDrawer` lets the sidebar slot fill the drawer width.
                  The userPanel receives `onNavigate` (closes the drawer)
                  so its action rows — e.g. "go to frontend", which swaps
                  the whole layout underneath — can dismiss the drawer
                  instead of leaving it hovering over the new page. */}
              {{
                default: () =>
                  slots.sidebar?.({ collapsed: false, onNavigate: closeSidebar, inDrawer: true }),
                footer: slots.userPanel
                  ? () => slots.userPanel!({ onNavigate: closeSidebar })
                  : undefined,
              }}
            </HDrawer>
          )}
        </div>

        {slots.footer && (
          <footer class="s-status-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, // Footer band (was a bare 40 — the pre-band chrome value).
            zIndex: "var(--z-footer, 110)" }}>
            {slots.footer()}
          </footer>
        )}

        {/* Scoped slots are functions — rendering the slot itself instead of
            calling it would stringify the compiled withCtx source into a text
            node (normalizeVNode String()s non-vnode children). */}
        {slots.overlays?.()}
      </div>
    );
  },
});
