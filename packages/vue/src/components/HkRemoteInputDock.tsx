// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { MousePointerClick } from "lucide-vue-next";

import { computed, defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { MASK_LEFT, MASK_MIDDLE, MASK_RIGHT, type RemoteButtonActions } from "./remoteInputTypes";
import "./HkRemoteInputDock.scss";

/**
 * HkRemoteInputDock — the remote-control dial (2026-11-15 user
 * direction: 不论电脑版、手机版，都需要在合适的位置悬浮拨号盘类似的工具栏).
 *
 * A floating dial button (fixed to a corner, above the session
 * surface) that expands into the remote-input control card:
 *
 * - the MODE switch — direct touch (the finger is the pointer) vs the
 *   virtual mouse (a pointer that moves relatively; v-model);
 * - the BUTTON pad — left / middle / right hold-buttons plus wheel
 *   up/down taps, wired straight into the `actions` prop (the host's
 *   transport closure; the dock never owns pointer state);
 * - the HOST slot — view controls the owning surface adds beside them
 *   (fit/fill, the landscape-lock toggle, …).
 *
 * Hold semantics (the flagship phone flow: one thumb HOLDS a pad
 * button while the other works the canvas): a held pad KEEPS the card
 * open — the outside-pointerdown dismissal stands down while any pad
 * bit is held — and any path that unmounts the card anyway (Escape,
 * `hidden`, component teardown) force-releases every held bit, so a
 * removed button can never leave the remote button latched.
 *
 * The mask the pad reports is the PAD'S OWN held bits — the host
 * unions it with every other holder before wiring (see
 * RemoteButtonActions.setButtons); one holder per bit.
 *
 * Dismissal follows the HkFab grammar: outside pointerdown or Escape
 * closes the card (Escape is swallowed so an ancestor modal survives;
 * a hidden dock swallows nothing).
 */
export default defineComponent({
  name: "HkRemoteInputDock",
  props: {
    /** 'direct' — the finger/cursor is the pointer; 'virtual' — a
     *  pointer moves relatively (touchpad semantics). v-model:mode. */
    mode: { type: String as PropType<"direct" | "virtual">, default: "direct" },
    /** Button/wire actions; when absent the pad renders disabled. */
    actions: { type: Object as PropType<RemoteButtonActions | null>, default: null },
    /** Hide the whole dial (e.g. no live session). */
    hidden: { type: Boolean, default: false },
  },
  emits: {
    "update:mode": (_mode: "direct" | "virtual") => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const open = ref(false);
    const rootRef = ref<HTMLElement>();

    /** Hold-buttons: pointerdown presses, pointerup/leave/cancel
     *  releases — the pad speaks the absolute-mask action, so the
     *  mask of CURRENTLY HELD pads is sent on every transition. */
    const held = ref(0);

    /** Release every held bit. Unconditional on `held` itself; the
     *  wire call is best-effort (actions may have vanished with the
     *  session) — called from every teardown path so a removed button
     *  can never stay latched on the remote. */
    function releaseAll() {
      if (held.value === 0) return;
      held.value = 0;
      props.actions?.setButtons(0);
    }

    function padDown(mask: number) {
      if (!props.actions) return;
      held.value |= mask;
      props.actions.setButtons(held.value);
    }
    function padUp(mask: number) {
      // Clear the bit FIRST: `actions` may vanish mid-gesture (the
      // session dropped) and the local bookkeeping must not strand it.
      if ((held.value & mask) === 0) return;
      held.value &= ~mask;
      props.actions?.setButtons(held.value);
    }

    function setOpen(next: boolean) {
      open.value = next;
      if (next) {
        document.addEventListener("keydown", onDocKeydown, true);
        document.addEventListener("pointerdown", onDocPointerdown, true);
      } else {
        unbind();
        releaseAll();
      }
    }

    function unbind() {
      document.removeEventListener("keydown", onDocKeydown, true);
      document.removeEventListener("pointerdown", onDocPointerdown, true);
    }

    function onDocKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape" || props.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }

    function onDocPointerdown(e: PointerEvent) {
      const root = rootRef.value;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      // A HELD pad keeps the card open (the hold-and-work flow): the
      // dismissal stands down while any bit is held.
      if (held.value !== 0) return;
      setOpen(false);
    }

    // hidden while open: the card vanishes with the session — release
    // everything and stand the listeners down (an invisible dock must
    // not swallow Escape for the whole app).
    watch(
      () => props.hidden,
      (h) => {
        if (h && open.value) setOpen(false);
      },
    );
    // actions vanishing mid-hold (the session dropped): the disabled
    // pad would swallow the pointerup — release what it held.
    watch(
      () => props.actions,
      (a) => {
        if (!a) releaseAll();
      },
    );
    onBeforeUnmount(() => {
      unbind();
      releaseAll();
    });

    function setMode(mode: "direct" | "virtual") {
      emit("update:mode", mode);
    }

    const padItems = computed(() => [
      { key: "left", mask: MASK_LEFT },
      { key: "middle", mask: MASK_MIDDLE },
      { key: "right", mask: MASK_RIGHT },
    ] as const);

    /** Roving-tab tabindex: only the checked radio is a tab stop. */
    function radioTabindex(mode: "direct" | "virtual") {
      return props.mode === mode ? 0 : -1;
    }
    function onRadiogroupKeydown(e: KeyboardEvent) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setMode(props.mode === "direct" ? "virtual" : "direct");
    }

    return () =>
      props.hidden
        ? null
        : (
          <div class="hk-remote-input-dock" ref={rootRef}>
            <button
              type="button"
              class="hk-remote-input-dock__dial"
              data-open={open.value || undefined}
              aria-expanded={open.value}
              aria-label={t("hikari::remoteInput.dial", "Remote input")}
              onClick={() => setOpen(!open.value)}
            >
              <MousePointerClick size={20} aria-hidden="true" />
            </button>
            {open.value ? (
              <div class="hk-remote-input-dock__card" role="group" aria-label={t("hikari::remoteInput.card", "Remote input controls")}>
                <div
                  class="hk-remote-input-dock__modes"
                  role="radiogroup"
                  aria-label={t("hikari::remoteInput.mode", "Pointer mode")}
                  onKeydown={onRadiogroupKeydown}
                >
                  <button
                    type="button"
                    role="radio"
                    tabindex={radioTabindex("direct")}
                    aria-checked={props.mode === "direct"}
                    class="hk-remote-input-dock__mode"
                    data-active={props.mode === "direct" || undefined}
                    onClick={() => setMode("direct")}
                  >
                    {t("hikari::remoteInput.mode.direct", "Direct touch")}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    tabindex={radioTabindex("virtual")}
                    aria-checked={props.mode === "virtual"}
                    class="hk-remote-input-dock__mode"
                    data-active={props.mode === "virtual" || undefined}
                    onClick={() => setMode("virtual")}
                  >
                    {t("hikari::remoteInput.mode.virtual", "Virtual mouse")}
                  </button>
                </div>
                <div class="hk-remote-input-dock__pad" role="group" aria-label={t("hikari::remoteInput.pad", "Buttons and wheel")}>
                  {padItems.value.map(({ key, mask }) => (
                    <button
                      key={key}
                      type="button"
                      class="hk-remote-input-dock__btn"
                      disabled={!props.actions}
                      aria-label={t(`hikari::remoteInput.btn.${key}`, key)}
                      onPointerdown={(e) => { e.preventDefault(); padDown(mask); }}
                      onPointerup={() => padUp(mask)}
                      onPointerleave={() => padUp(mask)}
                      onPointercancel={() => padUp(mask)}
                    >
                      {t(`hikari::remoteInput.btn.${key}`, key).slice(0, 1).toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    class="hk-remote-input-dock__btn"
                    disabled={!props.actions}
                    aria-label={t("hikari::remoteInput.wheelUp", "Wheel up")}
                    onClick={() => props.actions?.wheel(1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="hk-remote-input-dock__btn"
                    disabled={!props.actions}
                    aria-label={t("hikari::remoteInput.wheelDown", "Wheel down")}
                    onClick={() => props.actions?.wheel(-1)}
                  >
                    ↓
                  </button>
                </div>
                {/* Host view controls (fit/fill, landscape lock, …). */}
                {slots.default ? (
                  <div class="hk-remote-input-dock__host">{slots.default()}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
  },
});
