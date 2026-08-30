import { defineComponent, ref, type PropType, type VNode } from "vue";
import { Camera, ExternalLink, Languages, LogOut, Menu } from "lucide-vue-next";
import { HBadge, HButton, HPopover, HSpinner } from "@celestia-island/hikari";
import { useI18n } from "../i18n/context";

export interface LocaleOption {
  code: string;
  label: string;
}

export const HkAdminHeader = defineComponent({
  name: "HkAdminHeader",
  props: {
    /** Optional context title — empty (the default) hides the node
     *  entirely, for layouts whose pages carry their own in-page title
     *  (the HPageHeader convention). */
    title: { type: String, default: "" },
    showHamburger: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    actions: { type: Array as PropType<VNode[]>, default: () => [] },
    username: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    userGroups: { type: Array as PropType<{ id: string; name: string }[]>, default: () => [] },
    /** What the avatar trigger does:
     *  - "menu"   (default, desktop): toggle the user dropdown popover
     *    (identity, avatar edit, language, logout).
     *  - "drawer" (mobile): emit `avatarClick` so the shell opens its nav
     *    drawer, whose `userPanel` footer carries the same user content.
     *    The username stays hidden in this mode — the identity block
     *    lives in the drawer, so a header username would read as a
     *    duplicated stray control. */
    avatarAction: { type: String as PropType<"menu" | "drawer">, default: "menu" },
    /** Placeholder row shown while the identity is still loading (a
     *  fetchUser race on hard refresh) — the action items stay hidden
     *  until there is an identity to act on. */
    signingInLabel: { type: String, default: undefined },
    /** Pending-state escape hatch: typically wired to logout (clears
     *  cookies and returns to the login page) when the network wedges
     *  the session restore and the user wants to break out manually. */
    onForceSignOut: { type: Function, default: undefined },
    forceSignOutLabel: { type: String, default: undefined },
    showEmergencyStop: { type: Boolean, default: false },
    emergencyStopActive: { type: Boolean, default: false },
    emergencyStopActiveLabel: { type: String, default: "" },
    emergencyStopActiveTitle: { type: String, default: "" },
    emergencyStopLabel: { type: String, default: "" },
    emergencyStopTitle: { type: String, default: "" },
    emergencyStopLoading: { type: Boolean, default: false },
    avatarMenuLabel: { type: String, default: undefined },
    /** Accessible label for the avatar trigger button. */
    avatarTriggerLabel: { type: String, default: undefined },
    localeMenuLabel: { type: String, default: undefined },
    logoutLabel: { type: String, default: undefined },
    adminGroupLabel: { type: String, default: undefined },
    /** "Go to frontend" menu row (external-face link, rendered directly
     *  above logout). Hidden unless a label is provided — admin-only
     *  panels without a consumer-facing face simply omit the prop and
     *  keep the menu at avatar/language/logout. */
    goToFrontendLabel: { type: String, default: undefined },
  },
  emits: {
    logout: () => true,
    goToFrontend: () => true,
    hamburger: () => true,
    avatarClick: () => true,
    emergencyStop: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const userMenuOpen = ref(false);
    const userTriggerRef = ref<HTMLElement>();
    const avatarModalOpen = ref(false);
    const avatarFailed = ref(false);
    const localeMenuOpen = ref(false);
    const localeTriggerRef = ref<HTMLElement | null>(null);

    function onAvatarClick(e: MouseEvent) {
      e.stopPropagation();
      if (props.avatarAction === "drawer") {
        emit("avatarClick");
        return;
      }
      userMenuOpen.value = !userMenuOpen.value;
    }

    return () => (
      <header
        class={[
          "s-glass-header",
          props.compact ? "px-4 gap-2" : "px-6 gap-3",
        ]}
      >
        {props.showHamburger && (
          <HButton
            variant="ghost"
            size="sm"
            onClick={() => emit("hamburger")}
          >
            <Menu size={20} class="w-5 h-5" />
          </HButton>
        )}

        <div ref={userTriggerRef} class="flex items-center gap-2 min-w-0">
          <button
            class={[
              "w-7 h-7 rounded-full overflow-hidden shrink-0 cursor-pointer transition-opacity relative group p-0 border-0",
              props.avatarUrl
                ? ""
                : "bg-primary/10 border-2 border-primary/15 hover:border-primary/30",
            ]}
            aria-label={props.avatarTriggerLabel ?? t("hikari::adminHeader.avatarTrigger", "Account menu")}
            aria-haspopup={props.avatarAction === "drawer" ? "dialog" : "menu"}
            aria-expanded={props.avatarAction === "menu" ? userMenuOpen.value : undefined}
            onClick={onAvatarClick}
          >
            {props.avatarUrl && !avatarFailed.value ? (
              <img
                src={props.avatarUrl}
                alt={props.username}
                class="w-full h-full object-cover"
                onError={() => { avatarFailed.value = true; }}
              />
            ) : (
              <span class="text-xs font-bold text-primary/70">
                {props.username?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
            {props.avatarAction === "menu" && (
              <div class="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={10} class="text-white" />
              </div>
            )}
          </button>
          {props.avatarAction === "menu" && (
            <span class="text-sm font-semibold text-text truncate max-w-[8rem]">
              {props.username}
            </span>
          )}
        </div>

        <HPopover
          modelValue={userMenuOpen.value}
          onUpdate:modelValue={(v: boolean) => {
            userMenuOpen.value = v;
            // Closing the outer menu must also close the locale submenu,
            // or it stays orphaned for the next open.
            if (!v) localeMenuOpen.value = false;
          }}
          placement="bottom-start"
          anchorRef={userTriggerRef.value ?? null}
          class="w-56"
          sheetOnMobile
        >
          {/* Empty identity (fetchUser race on a hard refresh): render a
              single subtle placeholder row instead of the action items —
              "Change Avatar"/"Logout" floating above no identity read as a
              broken menu. The force-sign-out escape hatch lets the user
              break out of a wedged session restore. */}
          {!props.username && !props.userEmail ? (
            <div>
              <div class="s-user-header s-user-header--pending">
                <HSpinner size="sm" />
                <div class="s-user-header-email">{props.signingInLabel ?? t("hikari::adminHeader.signingIn", "Signing in…")}</div>
              </div>
              <button
                class="s-popup-menu-item"
                onClick={() => props.onForceSignOut?.()}
              >
                <LogOut size={14} />
                {props.forceSignOutLabel ?? t("hikari::adminHeader.forceSignOut", "Sign out")}
              </button>
            </div>
          ) : (
            <div>
              {/* Identity header FIRST — nickname, login email, permission
                  badges — so every account surface reads identically. */}
              <div class="s-user-header">
                {props.username && <div class="s-user-header-name">{props.username}</div>}
                {props.userEmail && <div class="s-user-header-email">{props.userEmail}</div>}
                {props.userGroups && props.userGroups.length > 0 && (
                  <div class="s-user-header-groups">
                    {props.userGroups.map((g: { id: string; name: string }) => (
                      <HBadge
                        key={g.id}
                        variant={g.name === "Administrators" ? "error" : "primary"}
                        size="sm"
                      >
                        {g.name === "Administrators"
                          ? (props.adminGroupLabel ?? t("hikari::adminHeader.adminGroup", "Administrators"))
                          : g.name}
                      </HBadge>
                    ))}
                  </div>
                )}
              </div>
              <button
                class="s-popup-menu-item"
                onClick={() => {
                  userMenuOpen.value = false;
                  avatarModalOpen.value = true;
                }}
              >
                <Camera size={14} />
                {props.avatarMenuLabel ?? t("hikari::adminHeader.avatar", "Avatar")}
              </button>
              {/* The language trigger owns the locale anchor: the ref sits
                  on the BUTTON itself (not a wrapper div) so the picker
                  popup anchors to it instead of falling back to inline
                  rendering. The ref OBJECT is passed through the slot —
                  reading .value here would freeze null from the first
                  render before the ref attached. */}
              <button
                ref={localeTriggerRef}
                class="s-popup-menu-item"
                onClick={() => (localeMenuOpen.value = !localeMenuOpen.value)}
              >
                <Languages size={14} />
                {props.localeMenuLabel ?? t("hikari::adminHeader.language", "Language")}
              </button>
              {slots["locale-picker"]?.({
                open: localeMenuOpen.value,
                onUpdateOpen: (v: boolean) => {
                  localeMenuOpen.value = v;
                  if (!v) userMenuOpen.value = false;
                },
                triggerRef: localeTriggerRef,
              })}
              {slots["user-menu-extra"]?.()}
              {/* Frontend link — mirrors the drawer user panel's
                  "go to frontend" row (same icon/position: directly
                  above logout). Opt-in via the label prop so admin-only
                  panels keep the menu at avatar/language/logout. */}
              {props.goToFrontendLabel ? (
                <button
                  class="s-popup-menu-item"
                  onClick={() => {
                    userMenuOpen.value = false;
                    emit("goToFrontend");
                  }}
                >
                  <ExternalLink size={14} />
                  {props.goToFrontendLabel}
                </button>
              ) : null}
              <button
                class="s-popup-menu-item"
                onClick={() => {
                  userMenuOpen.value = false;
                  emit("logout");
                }}
              >
                <LogOut size={14} />
                {props.logoutLabel ?? t("hikari::adminHeader.logout", "Logout")}
              </button>
            </div>
          )}
        </HPopover>

        {/* The page title lives INSIDE each page in the HPageHeader
            convention (big title left, tool buttons right). The bar
            renders an optional context title only when one is given —
            empty hides the node, keeping the bar to identity + theme
            controls. */}
        {props.title && (
          <h2 class="text-sm font-semibold text-text truncate min-w-0">
            {props.title}
          </h2>
        )}
        <div class="ml-auto flex items-center gap-1.5 shrink-0">
          {props.showEmergencyStop && (
            <button
              class={[
                "px-3 py-1 rounded-md text-xs font-bold border transition-all",
                props.emergencyStopLoading ? "opacity-50 cursor-wait" : "cursor-pointer",
                props.emergencyStopActive
                  ? "bg-red-600 text-white border-red-700 animate-pulse"
                  : "bg-red-600/10 text-red-500 border-red-500/40 hover:bg-red-600/25",
              ]}
              disabled={props.emergencyStopLoading}
              title={props.emergencyStopActive
                ? props.emergencyStopActiveTitle
                : props.emergencyStopTitle}
              onClick={() => emit("emergencyStop")}
            >
              {props.emergencyStopActive
                ? props.emergencyStopActiveLabel
                : props.emergencyStopLabel}
            </button>
          )}
          {slots["emergency-stop-extra"]?.()}
          {(props.actions || []).map((vnode, i) => (
            <span key={i} class="flex items-center gap-1">
              {vnode}
            </span>
          ))}
          {slots["theme-toggle"]?.()}
        </div>

        {slots["avatar-modal"]?.({
          open: avatarModalOpen.value,
          onUpdateOpen: (v: boolean) => { avatarModalOpen.value = v; },
        })}
      </header>
    );
  },
});
