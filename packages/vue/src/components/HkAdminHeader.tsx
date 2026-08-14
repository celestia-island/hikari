import { defineComponent, ref, type PropType, type VNode } from "vue";
import { Camera, Languages, LogOut, Menu } from "lucide-vue-next";
import { HBadge, HButton, HDivider, HPopover } from "@celestia-island/hikari";

export interface LocaleOption {
  code: string;
  label: string;
}

export const HkAdminHeader = defineComponent({
  name: "HkAdminHeader",
  props: {
    title: { type: String, required: true },
    showHamburger: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    actions: { type: Array as PropType<VNode[]>, default: () => [] },
    username: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    userGroups: { type: Array as PropType<{ id: string; name: string }[]>, default: () => [] },
    showEmergencyStop: { type: Boolean, default: false },
    emergencyStopActive: { type: Boolean, default: false },
    emergencyStopActiveLabel: { type: String, default: "" },
    emergencyStopActiveTitle: { type: String, default: "" },
    emergencyStopLabel: { type: String, default: "" },
    emergencyStopTitle: { type: String, default: "" },
    emergencyStopLoading: { type: Boolean, default: false },
    avatarMenuLabel: { type: String, default: "Avatar" },
    localeMenuLabel: { type: String, default: "Language" },
    logoutLabel: { type: String, default: "Logout" },
    adminGroupLabel: { type: String, default: "Administrators" },
  },
  emits: {
    logout: () => true,
    hamburger: () => true,
    emergencyStop: () => true,
    avatarClick: () => true,
  },
  setup(props, { emit, slots }) {
    const userMenuOpen = ref(false);
    const userTriggerRef = ref<HTMLElement>();
    const avatarModalOpen = ref(false);
    const avatarFailed = ref(false);
    const localeMenuOpen = ref(false);
    const localeTriggerRef = ref<HTMLElement | null>(null);

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

        <div ref={userTriggerRef} class="flex items-center gap-2">
          <button
            class={[
              "w-7 h-7 rounded-full overflow-hidden shrink-0 cursor-pointer transition-opacity relative group p-0 border-0",
              props.avatarUrl
                ? ""
                : "bg-primary/10 border-2 border-primary/15 hover:border-primary/30",
            ]}
            onClick={(e) => {
              e.stopPropagation();
              avatarModalOpen.value = true;
              emit("avatarClick");
            }}
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
            <div class="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={10} class="text-white" />
            </div>
          </button>
          <span class="text-sm font-semibold text-text truncate max-w-[8rem]">
            {props.username}
          </span>
        </div>

        <HPopover
          modelValue={userMenuOpen.value}
          onUpdate:modelValue={(v: boolean) => { userMenuOpen.value = v; }}
          placement="bottom-start"
          anchorRef={userTriggerRef.value ?? null}
          class="w-40"
        >
          <div class="py-1">
            {props.userGroups && props.userGroups.length > 0 && (
              <>
                <div class="px-3 py-1.5 flex flex-wrap gap-1">
                  {props.userGroups.map((g: { id: string; name: string }) => (
                    <HBadge
                      key={g.id}
                      variant={g.name === "Administrators" ? "error" : "primary"}
                      size="sm"
                    >
                      {g.name === "Administrators" ? props.adminGroupLabel : g.name}
                    </HBadge>
                  ))}
                </div>
                <HDivider spacing="sm" />
              </>
            )}
            <button
              class="s-popup-menu-item"
              onClick={() => {
                userMenuOpen.value = false;
                avatarModalOpen.value = true;
              }}
            >
              <Camera size={14} />
              {props.avatarMenuLabel}
            </button>
            <div ref={localeTriggerRef}>
              <button
                class="s-popup-menu-item"
                onClick={() => (localeMenuOpen.value = !localeMenuOpen.value)}
              >
                <Languages size={14} />
                {props.localeMenuLabel}
              </button>
              {slots["locale-picker"]?.({
                open: localeMenuOpen.value,
                onUpdateOpen: (v: boolean) => {
                  localeMenuOpen.value = v;
                  if (!v) userMenuOpen.value = false;
                },
                triggerRef: localeTriggerRef.value,
              })}
            </div>
            {slots["user-menu-extra"]?.()}
            <HDivider spacing="sm" />
            <button
              class="s-popup-menu-item"
              onClick={() => {
                userMenuOpen.value = false;
                emit("logout");
              }}
            >
              <LogOut size={14} />
              {props.logoutLabel}
            </button>
          </div>
        </HPopover>

        <h2 class="text-sm font-semibold text-text">
          {props.title}
        </h2>
        <div class="ml-auto flex items-center gap-1.5">
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
