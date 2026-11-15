// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { computed, defineComponent, ref, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import {
  MASK_LEFT,
  MASK_RIGHT,
  type RemoteViewport,
} from "./remoteInputTypes";
import "./HkVirtualCursor.scss";

/**
 * HkVirtualCursor — the rendered half of the virtual mouse (2026-11-15
 * remote-control direction: a pointer that MOVES with the finger
 * instead of BEING the finger).
 *
 * An absolute-position overlay pinned over the remote screen's display
 * box: the pointer glyph sits at the pointer's REMOTE coordinates
 * (percentage-mapped, so any letterbox/fill transform of the underlying
 * canvas carries it along), and its two button lobes are REAL touch
 * targets — hold the left/right lobe to press that button (press and
 * release pair, emitted through `press`), which is how a phone without
 * mouse buttons clicks.
 *
 * Ownership rule (R2): a lobe releases ONLY a button IT pressed — the
 * local `pressedHere` set tracks which bits this surface put down, so
 * a bit held by another surface (the dock pad, a host-side hold)
 * survives an unrelated pointerleave here, and this surface never
 * re-releases what it never pressed.
 *
 * The component is presentation + lobes only: position and pressed
 * state come in as props (a `useVirtualPointer` state), and every
 * interaction reports upward — it owns no pointer state beyond the
 * ownership set and never talks to a transport.
 */
export default defineComponent({
  name: "HkVirtualCursor",
  props: {
    /** Pointer x in REMOTE pixels. */
    x: { type: Number, required: true },
    /** Pointer y in REMOTE pixels. */
    y: { type: Number, required: true },
    /** The remote screen's pixel size (the coordinate space of x/y). */
    viewport: { type: Object as PropType<RemoteViewport>, required: true },
    /** Live UI button mask — a pressed lobe renders held. */
    buttons: { type: Number, default: 0 },
    /** Accessible label for the cursor surface. */
    label: { type: String, default: "" },
  },
  emits: {
    /** A lobe press (mask bit) went down (true) or up (false). */
    press: (_mask: number, _down: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    /** Bits THIS surface pressed and has not yet released. */
    const pressedHere = ref(0);

    const leftPct = computed(() =>
      props.viewport.width > 0 ? (props.x / props.viewport.width) * 100 : 0,
    );
    const topPct = computed(() =>
      props.viewport.height > 0 ? (props.y / props.viewport.height) * 100 : 0,
    );
    const leftHeld = computed(() => (props.buttons & MASK_LEFT) !== 0);
    const rightHeld = computed(() => (props.buttons & MASK_RIGHT) !== 0);

    function lobeDown(mask: number) {
      pressedHere.value |= mask;
      emit("press", mask, true);
    }
    /** Release ONLY what this surface pressed (the ownership rule). */
    function lobeUp(mask: number) {
      if ((pressedHere.value & mask) === 0) return;
      pressedHere.value &= ~mask;
      emit("press", mask, false);
    }

    return () => (
      <div class="hk-virtual-cursor" aria-label={props.label} role="presentation">
        <div
          class="hk-virtual-cursor__glyph"
          style={{ left: `${leftPct.value}%`, top: `${topPct.value}%` }}
        >
          {/* The pointer arrow: hotspot at the glyph's top-left. */}
          <svg class="hk-virtual-cursor__arrow" viewBox="0 0 12 18" aria-hidden="true">
            <path d="M1 1 L1 14 L4.6 10.8 L7 16 L9.2 15 L6.8 9.9 L11 9.4 Z" />
          </svg>
          {/* The lobes: real touch targets under the arrow's tail —
              left and right mouse buttons a phone does not have. */}
          <button
            type="button"
            class="hk-virtual-cursor__lobe"
            data-lobe="left"
            data-held={leftHeld.value || undefined}
            aria-label={t("hikari::remoteInput.btn.left", "left button")}
            onPointerdown={(e) => { e.preventDefault(); lobeDown(MASK_LEFT); }}
            onPointerup={() => lobeUp(MASK_LEFT)}
            onPointerleave={() => lobeUp(MASK_LEFT)}
            onPointercancel={() => lobeUp(MASK_LEFT)}
          />
          <button
            type="button"
            class="hk-virtual-cursor__lobe"
            data-lobe="right"
            data-held={rightHeld.value || undefined}
            aria-label={t("hikari::remoteInput.btn.right", "right button")}
            onPointerdown={(e) => { e.preventDefault(); lobeDown(MASK_RIGHT); }}
            onPointerup={() => lobeUp(MASK_RIGHT)}
            onPointerleave={() => lobeUp(MASK_RIGHT)}
            onPointercancel={() => lobeUp(MASK_RIGHT)}
          />
        </div>
      </div>
    );
  },
});
