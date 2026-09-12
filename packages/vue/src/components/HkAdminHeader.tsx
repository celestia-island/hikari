import { computed, defineComponent, ref, type PropType, type VNode } from "vue";
import { Camera, ExternalLink, Languages, LogOut, Menu } from "lucide-vue-next";
import { HBadge, HButton, HSpinner } from "@celestia-island/hikari";
import { useI18n } from "../i18n/context";
import HkMenu, { type HkMenuItem } from "./HkMenu";

export interface LocaleOption {
  code: string;
  label: string;
}

export const HkAdminHeader = defineComponent({
  name: "HkAdminHeader",
  props: {
    /** Page title rendered beside the avatar — the view the console is
     *  currently ON (dashboard, providers, …). The signed-in nickname
     *  deliberately does NOT go here: identity lives in the dropdown's
     *  identity block, the bar labels WHERE you are. Empty hides the
     *  node; long titles truncate. */
    title: { type: String, default: "" },
    showHamburger: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    actions: { type: Array as PropType<VNode[]>, default: () => [] },
    /** Signed-in identity. Drives the avatar fallback letter, the
     *  dropdown identity block and the pending-state branch — it is
     *  never rendered as bar text (the title slot above owns that). */
    username: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    userGroups: { type: Array as PropType<{ id: string; name: string }[]>, default: () => [] },
    /** What the avatar trigger does:
     *  - "menu"   (default, desktop): toggle the user dropdown
     *    (identity, avatar edit, language, logout).
     *  - "drawer" (mobile): emit `avatarClick` so the shell opens its nav
     *    drawer, whose `userPanel` footer carries the same user content.
     *    Both the page title and the identity stay hidden in this mode —
     *    they live in the drawer, so header copies read as duplicated
     *    stray controls. */
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
    /** Offered locales for the Language cascade (the same shape the chat
     *  frontend feeds its user menu). An empty list hides the row —
     *  hosts without a locale concept simply omit it. Selecting a child
     *  emits `localeSelect` with the code. */
    localeOptions: { type: Array as PropType<LocaleOption[]>, default: () => [] },
    /** Currently active locale code (the Language cascade's check). */
    currentLocale: { type: String, default: undefined },
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
    localeSelect: (_code: string) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const userMenuOpen = ref(false);
    const userTriggerRef = ref<HTMLElement>();
    const avatarModalOpen = ref(false);
    const avatarFailed = ref(false);

    function onAvatarClick(e: MouseEvent) {
      e.stopPropagation();
      if (props.avatarAction === "drawer") {
        emit("avatarClick");
        return;
      }
      userMenuOpen.value = !userMenuOpen.value;
    }

    /** The dropdown is the SAME engine as the chat frontend's user menu
     *  (HkMenu): identity header via the header slot, cascading Language
     *  children, danger logout row — every account surface (chat header,
     *  console header, mobile drawer) reads identically. */
    const userMenuItems = computed<HkMenuItem[]>(() => {
      // Empty identity (fetchUser race on a hard refresh): a single
      // force-sign-out escape row — action items floating above no
      // identity read as a broken menu.
      if (!props.username && !props.userEmail) {
        return [
          {
            key: "force-signout",
            label: props.forceSignOutLabel ?? t("hikari::adminHeader.forceSignOut", "Sign out"),
          },
        ];
      }
      const items: HkMenuItem[] = [
        {
          key: "avatar",
          label: props.avatarMenuLabel ?? t("hikari::adminHeader.avatar", "Avatar"),
          icon: Camera,
        },
      ];
      if (props.localeOptions.length > 0) {
        items.push({
          key: "locale",
          label: props.localeMenuLabel ?? t("hikari::adminHeader.language", "Language"),
          icon: Languages,
          children: props.localeOptions.map((o) => ({
            key: `locale:${o.code}`,
            label: o.label,
            checked: o.code === props.currentLocale,
          })),
        });
      }
      // Frontend link — mirrors the drawer user panel's "go to frontend"
      // row (same position: directly above logout). Opt-in via the label
      // prop so admin-only panels keep the menu at avatar/language/logout.
      if (props.goToFrontendLabel) {
        items.push({ key: "go-to-frontend", label: props.goToFrontendLabel, icon: ExternalLink });
      }
      items.push({
        key: "logout",
        label: props.logoutLabel ?? t("hikari::adminHeader.logout", "Logout"),
        icon: LogOut,
        danger: true,
      });
      return items;
    });

    /** Leaf selection IS the action; HkMenu closes the menu around the
     *  emit, so each branch only fires its own side effect. */
    function onUserMenuSelect(key: string) {
      if (key === "avatar") {
        avatarModalOpen.value = true;
      } else if (key.startsWith("locale:")) {
        emit("localeSelect", key.slice("locale:".length));
      } else if (key === "go-to-frontend") {
        emit("goToFrontend");
      } else if (key === "logout") {
        emit("logout");
      } else if (key === "force-signout") {
        props.onForceSignOut?.();
      }
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
          {/* WHERE am I — the open view's title, not the nickname. The
              explicit 1.5 line-height keeps descenders (g, y, p) inside
              the truncate clip box: the default text-sm box is exactly
              the em advance, so zoom/subpixel rounding in a scaled root
              shaves the ink off at the bottom (user report 2026-09-12:
              the "g" tail of the nickname was visibly cut). */}
          {props.avatarAction === "menu" && props.title && (
            <span
              class="text-sm font-semibold text-text truncate max-w-[8rem]"
              style={{ lineHeight: "1.5" }}
            >
              {props.title}
            </span>
          )}
        </div>

        <HkMenu
          open={userMenuOpen.value}
          onUpdate:open={(v: boolean) => { userMenuOpen.value = v; }}
          anchorRef={userTriggerRef.value ?? null}
          placement="bottom-start"
          title={props.avatarTriggerLabel ?? t("hikari::adminHeader.avatarTrigger", "Account menu")}
          items={userMenuItems.value}
          onSelect={(key: string) => onUserMenuSelect(key)}
        >
          {{
            header: () => (
              !props.username && !props.userEmail ? (
                // Pending identity: a spinner beside the label reads as
                // "actively working", not a frozen panel.
                <div class="s-user-header s-user-header--pending">
                  <HSpinner size="sm" />
                  <div class="s-user-header-email">{props.signingInLabel ?? t("hikari::adminHeader.signingIn", "Signing in…")}</div>
                </div>
              ) : (
                // Identity block FIRST — avatar, nickname, login email,
                // permission badges — the same grammar the chat
                // frontend's user-menu header uses (the shared
                // s-user-header profile variant).
                <div class="s-user-header s-user-header--profile">
                  <span class="s-user-avatar-chip" aria-hidden="true">
                    {props.avatarUrl && !avatarFailed.value ? (
                      <img
                        src={props.avatarUrl}
                        alt=""
                        class="s-user-avatar-img"
                        onError={() => { avatarFailed.value = true; }}
                      />
                    ) : (
                      <span class="s-user-avatar">
                        {props.username?.charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                  </span>
                  <div class="s-user-header-body">
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
                </div>
              )
            ),
          }}
        </HkMenu>

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
