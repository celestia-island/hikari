// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { MousePointerClick } from "lucide-vue-next";

import { defineComponent, onBeforeUnmount, ref, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import type { RemoteButtonActions } from "./remoteInputTypes";
import "./HkRemoteInputDock.scss";

/**
 * HkRemoteInputDock — the remote-control dial (2026-11-15 user
 * direction: 不论电脑版、手机版，都需要在合适的位置悬浮拨号盘类似的工具栏).
 *
 * A floating dial button (fixed to a corner, above the session
 * surface) that expands into the remote-input control card:
 *
 * - the MODE switch — direct touch (the finger is the pointer) vs the
 *   virtual mouse (a pointer that MOVES with the finger; v-model);
 * - the BUTTON pad — left / middle / right hold-buttons plus wheel
 *   up/down taps, wired straight into the `actions` prop (the host's
 *   transport closure; the dock never owns pointer state);
 * - the HOST slot — view controls the owning surface adds beside them
 *   (fit/fill, the landscape-lock toggle, …).
 *
 * Dismissal follows the HkFab grammar: outside pointerdown or Escape
 * closes the card (Escape is swallowed so an ancestor modal survives).
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

    function setOpen(next: boolean) {
      open.value = next;
      if (next) {
        document.addEventListener("keydown", onDocKeydown, true);
        document.addEventListener("pointerdown", onDocPointerdown, true);
      } else {
        unbind();
      }
    }

    function unbind() {
      document.removeEventListener("keydown", onDocKeydown, true);
      document.removeEventListener("pointerdown", onDocPointerdown, true);
    }

    function onDocKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }

    function onDocPointerdown(e: PointerEvent) {
      const root = rootRef.value;
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    }

    onBeforeUnmount(unbind);

    function setMode(mode: "direct" | "virtual") {
      emit("update:mode", mode);
    }

    /** Hold-buttons: pointerdown presses, pointerup/leave/cancel
     *  releases — the pad speaks the absolute-mask action, so a
     *  mask-of-held-pads is sent on every transition. */
    const held = ref(0);
    function padDown(mask: number) {
      if (!props.actions) return;
      held.value |= mask;
      props.actions.setButtons(held.value);
    }
    function padUp(mask: number) {
      if (!props.actions) return;
      held.value &= ~mask;
      props.actions.setButtons(held.value);
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
                <div class="hk-remote-input-dock__modes" role="radiogroup" aria-label={t("hikari::remoteInput.mode", "Pointer mode")}>
                  <button
                    type="button"
                    role="radio"
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
                    aria-checked={props.mode === "virtual"}
                    class="hk-remote-input-dock__mode"
                    data-active={props.mode === "virtual" || undefined}
                    onClick={() => setMode("virtual")}
                  >
                    {t("hikari::remoteInput.mode.virtual", "Virtual mouse")}
                  </button>
                </div>
                <div class="hk-remote-input-dock__pad" aria-label={t("hikari::remoteInput.pad", "Buttons and wheel")}>
                  {([
                    ["left", 0b001],
                    ["middle", 0b010],
                    ["right", 0b100],
                  ] as const).map(([name, mask]) => (
                    <button
                      key={name}
                      type="button"
                      class="hk-remote-input-dock__btn"
                      disabled={!props.actions}
                      aria-label={t(`hikari::remoteInput.btn.${name}`, name)}
                      onPointerdown={(e) => { e.preventDefault(); padDown(mask); }}
                      onPointerup={() => padUp(mask)}
                      onPointerleave={() => held.value & mask && padUp(mask)}
                      onPointercancel={() => held.value & mask && padUp(mask)}
                    >
                      {t(`hikari::remoteInput.btn.${name}`, name).slice(0, 1).toUpperCase()}
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
