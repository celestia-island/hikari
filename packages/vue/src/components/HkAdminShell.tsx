import { defineComponent, ref } from "vue";
import { HDrawer, HScrollContainer, useBreakpoint } from "@celestia-island/hikari";
import { provideActionBar } from "../composables/useActionBar";

export const HkAdminShell = defineComponent({
  name: "HkAdminShell",
  props: {
    sidebarCollapsed: { type: Boolean, default: false },
    sidebarWidth: { type: String, default: "224px" },
    mobileBreakpoint: { type: Number, default: 768 },
    footerHeight: { type: String, default: "var(--s-footer-height)" },
    navTitle: { type: String, default: "Navigation" },
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
    const { isDesktop } = useBreakpoint();
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
              title={props.navTitle}
              panelClass={props.drawerPanelClass}
            >
              {/* The drawer body carries the nav; a `userPanel` slot rides
                  the drawer footer (identity + account actions) so mobile
                  gets the same content the desktop user menu exposes.
                  `inDrawer` lets the sidebar slot fill the drawer width. */}
              {{
                default: () =>
                  slots.sidebar?.({ collapsed: false, onNavigate: closeSidebar, inDrawer: true }),
                footer: slots.userPanel
                  ? () => <div>{slots.userPanel!()}</div>
                  : undefined,
              }}
            </HDrawer>
          )}
        </div>

        {slots.footer && (
          <footer class="s-status-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40 }}>
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
