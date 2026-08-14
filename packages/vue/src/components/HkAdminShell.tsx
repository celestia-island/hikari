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
  },
  setup(props, { slots }) {
    const { isDesktop } = useBreakpoint();
    const sidebarOpen = ref(false);

    const actionBar = provideActionBar();

    const toggleHamburger = () => {
      sidebarOpen.value = !sidebarOpen.value;
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
            <HScrollContainer class="flex-1 p-6 min-h-0">
              {slots.content?.()}
            </HScrollContainer>
          </main>

          {!isDesktop.value && (
            <HDrawer
              modelValue={sidebarOpen.value}
              onUpdate:modelValue={(v: boolean) => (sidebarOpen.value = v)}
              side="left"
              size="280px"
              title={props.navTitle}
            >
              {slots.sidebar?.({ collapsed: false, onNavigate: closeSidebar })}
            </HDrawer>
          )}
        </div>

        {slots.footer && (
          <footer class="s-status-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40 }}>
            {slots.footer()}
          </footer>
        )}

        {slots.overlays}
      </div>
    );
  },
});
