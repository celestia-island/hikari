import { computed, defineComponent, h, ref, type Component, type PropType } from "vue";
import { Plus } from "lucide-vue-next";

import "./HkAddTile.scss";

/**
 * HkAddTile — the dashed add / empty affordance tile.
 *
 * One standard element for the "dashed placeholder that invites an
 * action" pattern that product surfaces kept re-drawing by hand: the
 * empty-list tile, the "add one more" row at the end of a staged list,
 * and the pick-a-file / drop-files zone. Three blessed forms, one
 * anatomy:
 *
 *   - **default** — a centered vertical block (icon above the label):
 *     the empty state of a list or panel ("no sources yet — add one to
 *     begin"). The whole tile is the click target; hosts no longer pair
 *     a passive dashed box with a separate button below it.
 *   - **compact** — a slim start-aligned row ("＋ Add node / repo"): the
 *     tile that rides the END of a list of rows and grows the list. It
 *     replaces the loose secondary button, so the add affordance reads
 *     as part of the list instead of floating under it.
 *   - **droppable** — either form additionally accepts file drags:
 *     dragover/dragenter flip the tile into the drag-over wash (same
 *     visual language as the established drag overlays — dashed primary
 *     on a faint primary floor), and a drop with a non-empty `FileList`
 *     is handed UP as `drop-files`. The host decides what files mean;
 *     the tile only standardizes the gesture. Drops of anything but
 *     files (text, URLs) are ignored — the drag-files-in gesture is the
 *     contract, so a host can rely on `drop-files` always carrying ≥1
 *     file.
 *
 * Accessibility: a real `<button type="button">` — keyboard focus and
 * Enter/Space activation come free; `disabled` renders the native
 * attribute (and a disabled tile refuses drags entirely: it never calls
 * `preventDefault` on dragover, so the browser disallows the drop).
 */
export default defineComponent({
  name: "HkAddTile",
  props: {
    /** Off switches the tile off entirely: no click, no drag acceptance. */
    disabled: { type: Boolean, default: false },
    /** Accept file drags; non-empty drops surface as `drop-files`. */
    droppable: { type: Boolean, default: false },
    /** List-end form: slim horizontal row instead of the centered block. */
    compact: { type: Boolean, default: false },
    /** Icon component (lucide-vue-next style); defaults to Plus. */
    icon: { type: [Object, Function] as PropType<Component>, default: undefined },
  },
  emits: {
    click: (_e: MouseEvent) => true,
    /** A drop carrying at least one file: `(files, nativeEvent)`. */
    "drop-files": (_files: File[], _e: DragEvent) => true,
  },
  setup(props, { slots, emit }) {
    // dragenter/dragleave fire in pairs across EVERY child boundary, so
    // a boolean flips off the moment the pointer crosses the label —
    // track depth instead and clear it on drop.
    const dragDepth = ref(0);
    const dragOver = computed(
      () => props.droppable && !props.disabled && dragDepth.value > 0,
    );
    const rootEl = ref<HTMLButtonElement | null>(null);

    /** Whether this tile accepts the drag at all. Refusing means NEVER
     *  calling preventDefault: the browser only permits a drop onto a
     *  target whose last dragover was not cancelled, so a disabled (or
     *  non-droppable) tile cannot receive one by construction. */
    function acceptsDrag(): boolean {
      return props.droppable && !props.disabled;
    }

    function onDragenter(e: DragEvent) {
      if (!acceptsDrag()) return;
      e.preventDefault();
      dragDepth.value += 1;
    }

    function onDragover(e: DragEvent) {
      if (!acceptsDrag()) return;
      // preventDefault on EVERY dragover (not just the first) — the
      // drop allowance expires continuously; missing one cancels the
      // drop for the whole hover.
      e.preventDefault();
    }

    function onDragleave(e: DragEvent) {
      // Containment check instead of a blind decrement: a child that
      // leaves the DOM mid-hover (slot swap) never fires its own leave,
      // so a plain `depth -= 1` could strand the count above zero and
      // keep the drag-over wash lit after the pointer has fully exited
      // (the R3 residual sweep). When the leave's relatedTarget is
      // outside the tile — or null, i.e. left to nothing — the pointer
      // has truly gone: reset fully.
      const root = rootEl.value;
      const rt = e.relatedTarget as Node | null;
      if (root && rt && root.contains(rt)) return;
      dragDepth.value = 0;
    }

    function onDrop(e: DragEvent) {
      dragDepth.value = 0;
      if (!acceptsDrag()) return;
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      emit("drop-files", files, e);
    }

    function onClick(e: MouseEvent) {
      if (props.disabled) return;
      emit("click", e);
    }

    return () => {
      // Icon resolution reads `slots` INSIDE the render function — the
      // slots object is not reactive, so a computed here would cache the
      // choice across slot add/remove (R2-S1: a parent that adds an icon
      // slot later rendered the stale default Plus ALONGSIDE the slot;
      // removing the slot left the tile iconless until an unrelated prop
      // churned the cache). House style: HkEmptyState reads slots.icon
      // per render for the same reason. h() rather than JSX: the icon
      // prop is a Component (object | function) union, which TS cannot
      // expand as a JSX element type.
      const Icon = slots.icon ? null : (props.icon ?? Plus);
      return (
        <button
          type="button"
          ref={rootEl}
          class={[
            "hk-add-tile",
            props.compact && "hk-add-tile--compact",
            props.disabled && "hk-add-tile--disabled",
            dragOver.value && "hk-add-tile--drag-over",
          ]}
          disabled={props.disabled}
          onClick={onClick}
          onDragenter={onDragenter}
          onDragover={onDragover}
          onDragleave={onDragleave}
          onDrop={onDrop}
        >
          {Icon ? h(Icon, { size: props.compact ? 14 : 18, "aria-hidden": true }) : null}
          {slots.icon?.()}
          {slots.default?.()}
        </button>
      );
    };
  },
});
