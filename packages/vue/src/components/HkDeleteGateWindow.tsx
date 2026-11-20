import { defineComponent, h, type VNode } from "vue";
import { asPropType } from "../utils/typing";

import HkSerpentineUnlock from "./HkSerpentineUnlock";
import HkModal from "./HkModal";
import "./HkDeleteGateWindow.scss";

export { default as HkDeleteFact } from "./HkDeleteFact";

/**
 * The open-and-go delete confirmation window.
 *
 * ANY delete-related surface mounts this with `open` + `title`; the
 * default slot renders the message area, and the HOUSE RULE for that slot
 * is documented and enforced by review: the copy must carry EVERY key
 * fact of the thing being deleted — its name (and per-locale alias where
 * one exists), its owner, its size/counters, and the names of everything
 * attached to it — each wrapped in an {@link HkDeleteFact} emphasis tag so
 * the irreversible act is never aimed at an anonymous blob.
 *
 * The only confirm control is the serpentine walk (a full traced lane);
 * closing abandons. The parent performs the actual deletion in
 * `onConfirm`.
 */
export default defineComponent({
  name: "HkDeleteGateWindow",
  props: {
    /** Window visibility (v-model:open). */
    open: { type: Boolean, default: false },
    /** Window title ("删除工作区"). */
    title: { type: String, required: true },
    /** What the confirming user is about to delete ("此工作区"). */
    label: { type: String, required: true },
    /** Hint before grabbing. */
    grabHint: { type: String, required: true },
    /** Hint while tracking. */
    trackingHint: { type: String, required: true },
    /** Corner-count range `[min, max]` — higher stakes, more turns. */
    turns: {
      type: asPropType<[number, number]>(Array),
      default: null,
    },
    /** Deterministic lane seed (tests / design review). */
    seed: { type: Number, default: null },
    /** Disables the gate (e.g. the delete RPC is in flight). */
    disabled: { type: Boolean, default: false },
  },
  emits: {
    "update:open": (v: boolean) => typeof v === "boolean",
    /** Fired once, after a full lane walk released at the goal. */
    confirm: () => true,
    /** Progress at an early release; the parent may log or ignore. */
    cancel: (progress: number) => typeof progress === "number",
  },
  setup(props, { emit, slots }) {
    function close() {
      emit("update:open", false);
    }
    function onConfirm() {
      emit("confirm");
      close();
    }
    return () =>
      h(HkModal, {
        modelValue: props.open,
        "onUpdate:modelValue": (v: boolean) => emit("update:open", v),
        title: props.title,
      }, {
        default: () => [
          // The window renders the message wrapper itself: consumers put
          // their key-fact chips inside the slot without knowing the class.
          <div class="hk-delete-gate-message">
            {slots.default?.() as VNode[]}
          </div>,
          <HkSerpentineUnlock
            tone="danger"
            label={props.label}
            grabHint={props.grabHint}
            trackingHint={props.trackingHint}
            turns={props.turns ?? undefined}
            seed={props.seed ?? undefined}
            disabled={props.disabled}
            onConfirm={() => onConfirm()}
            onCancel={(progress: number) => emit("cancel", progress)}
          />,
        ],
      });
  },
});

