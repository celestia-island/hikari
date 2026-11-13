import {
  computed,
  defineComponent,
  ref,
  shallowRef,
  type PropType,
} from "vue";

import "./HkKanban.scss";
import HScrollContainer from "./HkScrollContainer";

/** Which way a board scrolls. */
export type KanbanAxis = "horizontal" | "vertical" | "both";

/** What the `laneHeader` slot receives — enough to draw the header AS a
 *  card, which is what the chat node list does with its left-hand labels. */
export interface KanbanHeaderSlotProps {
  lane: unknown;
  laneIndex: number;
  laneKey: string;
  cards: readonly unknown[];
}

/** What the `card` slot receives for one card. */
export interface KanbanCardSlotProps {
  card: unknown;
  cardIndex: number;
  lane: unknown;
  laneIndex: number;
  laneKey: string;
}

/** Emitted when a card is dropped on another lane (or another position). */
export interface KanbanMove {
  card: unknown;
  fromLaneKey: string;
  fromIndex: number;
  toLaneKey: string;
  /** Where the drop lands, in the target lane's PRE-REMOVAL
   *  coordinates: a drop ON a card names that card's current index
   *  (the dragged card is still rendered when the index is read), and
   *  a drop into a gap, on the header/footer, or at the tail names
   *  `cardCount` — the append-to-end semantic. Hosts inserting into a
   *  list that no longer contains the dragged card must therefore
   *  shift one slot left for same-lane FORWARD drops on a card
   *  (`toIndex > fromIndex` → insert at `toIndex - 1`); backward and
   *  cross-lane moves need no shift, and gap drops always mean
   *  "append". */
  toIndex: number;
}

/**
 * HkKanban — the base view for boards of typed, draggable cards.
 *
 * It is deliberately NOT a waterfall variant. A waterfall enumerates one
 * stream into columns; a board is a set of LANES, each with a header that may
 * itself be a card, each holding cards that can be dragged between lanes.
 * The chat node list is this shape taken to its extreme (the left-hand
 * label of every row is a card of its own), and so is the multidimensional
 * table's board view — which is why both specialise this component rather
 * than the waterfall.
 *
 * What it owns:
 *
 *   - **lanes** — ordered, with a stable key each (the header's identity and
 *     the drop target);
 *   - **axes** — `horizontal` (lanes side by side), `vertical` (lanes
 *     stacked) or `both`, because a board's lane axis and its card axis are
 *     independent;
 *   - **headers** — rendered through a slot, so a header can be a plain
 *     label, a card, or a control cluster;
 *   - **drag and drop** — when `draggable`, cards carry the native drag
 *     contract and a completed drop emits `move` with both ends; the host
 *     applies it (and may reject it, since the board never mutates data).
 *
 * What it does NOT own: card content, lane sizing beyond `laneSize`, and any
 * data mutation — a board is a view of the host's model, never its owner.
 */
export default defineComponent({
  name: "HkKanban",
  props: {
    /** The lanes, in display order. */
    lanes: { type: Array as PropType<readonly unknown[]>, required: true },
    /** Stable key of a lane — the header's identity and the drop target. */
    laneKeyOf: {
      type: Function as PropType<(lane: unknown, index: number) => string>,
      required: true,
    },
    /** The cards inside a lane, in display order. */
    cardsOf: {
      type: Function as PropType<(lane: unknown, index: number) => readonly unknown[]>,
      required: true,
    },
    /** Stable key of a card, when the host has one (drag identity). */
    cardKeyOf: {
      type: Function as PropType<(card: unknown, index: number) => string>,
      default: undefined,
    },
    /** Which way the board scrolls. */
    axis: { type: String as PropType<KanbanAxis>, default: "horizontal" },
    /** CSS width (horizontal / both) or height (vertical) of one lane. */
    laneSize: { type: String, default: undefined },
    /** Whether cards can be dragged between lanes. */
    draggable: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
    /** Forwarded to the strip's HkScrollContainer: spend the shell-
     *  published --hk-scroll-tail-bottom as an in-flow tail spacer so a
     *  dock floating over the board never covers its last row at the
     *  scroll end (see HkScrollContainer's dockTailClearance). Only
     *  effective on axis="vertical"/"both" boards: the default
     *  horizontal axis carries its tail on the cross axis, where the
     *  contract generates no spacer and the shrink pin is inert in the
     *  block viewport — a horizontal board gets a no-op by design. */
    dockTailClearance: { type: Boolean, default: false },
    /** Where a `dockBottom` dock lives, forwarded to the strip's
     *  HkScrollContainer (see its `dockMode`): "pin" (default) keeps the
     *  dock on the strip's bottom edge, "ride" moves it into the strip's
     *  content flow so the air above it is the measured dock occupancy and
     *  the dock follows the content. Only effective on axis="vertical"/
     *  "both" boards — a horizontal strip carries its tail on the cross
     *  axis, where the container's ride placement is gated off by design.
     *
     *  A ride board ALSO carries `data-dock-mode="ride"` on its root — only
     *  while a `dockBottom` slot is actually mounted, since that hook
     *  releases this component's full-height lanes box
     *  (see HkKanban.scss): `.hk-kanban-lanes { min-height: 100% }` keeps
     *  the lanes box as tall as the viewport, which would push the in-flow
     *  spacer + dock below the fold and turn the air back into the
     *  window's leftover (measured on a real board: 275.8px static vs the
     *  139px dock, i.e. zero improvement over the pin board). The
     *  attribute is emitted only while a ride dock is genuinely mounted (not
     *  for pin, not for a horizontal board, not for an empty board — with no
     *  lanes the whole strip including the dock is not rendered — and not
     *  for an empty dock slot), so every existing board is untouched. */
    dockMode: { type: String as PropType<"pin" | "ride">, default: "pin" },
  },
  emits: ["move"],
  setup(props, { slots, emit, expose }) {
    const scrollHost = shallowRef<{ getScrollElement: () => HTMLElement | undefined } | null>(null);
    /** The card being dragged, kept at module scope of the setup so a drop
     *  can name both ends without the host tracking drag state. */
    const dragging = ref<{ laneKey: string; index: number; card: unknown } | null>(null);
    const dropTarget = ref<string | null>(null);

    const cardsFor = (lane: unknown, index: number) => props.cardsOf(lane, index);

    /** The scroll axis of the lane strip itself, straight from `axis`: a
     *  horizontal board scrolls across, a vertical one down, and `both`
     *  scrolls the strip BOTH ways (the lane axis and the card axis are
     *  independent, and a board may need to travel on either). */
    const stripAxis = computed(() => props.axis);

    function onDragStart(card: unknown, laneKey: string, index: number, event: DragEvent) {
      if (!props.draggable) return;
      dragging.value = { laneKey, index, card };
      event.dataTransfer?.setData("text/plain", laneKey);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    }

    function onDragOver(laneKey: string, event: DragEvent) {
      if (!props.draggable || !dragging.value) return;
      // Only a lane that would actually accept the card is a target.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      dropTarget.value = laneKey;
    }

    function onDragLeave(laneKey: string, event: DragEvent) {
      // dragleave bubbles from every child the pointer crosses, so a move
      // from one card to the next inside the SAME lane would otherwise blink
      // the highlight off; only a leave that exits the lane counts.
      const next = event.relatedTarget as Node | null;
      const lane = event.currentTarget as Node | null;
      if (next && lane && lane.contains(next)) return;
      if (dropTarget.value === laneKey) dropTarget.value = null;
    }

    /** Where a drop lands inside a lane: on the card under the pointer, or
     *  at the end when the pointer is over the lane's header, footer, the
     *  gaps between cards, or the tail. The whole lane is a target because
     *  the whole lane is highlighted as one. */
    function dropIndexWithin(event: DragEvent, cardCount: number): number {
      const target = event.target as HTMLElement | null;
      const card = target?.closest?.("[data-card-index]");
      const raw = card?.getAttribute("data-card-index");
      const index = raw === null || raw === undefined ? Number.NaN : Number(raw);
      return Number.isInteger(index) && index >= 0 && index < cardCount ? index : cardCount;
    }

    function onDrop(laneKey: string, cardCount: number, event: DragEvent) {
      if (!props.draggable || !dragging.value) return;
      event.preventDefault();
      const from = dragging.value;
      const index = dropIndexWithin(event, cardCount);
      dragging.value = null;
      dropTarget.value = null;
      // A drop on the card it started from is not a move — the host should
      // not have to filter that itself.
      if (from.laneKey === laneKey && from.index === index) return;
      emit("move", {
        card: from.card,
        fromLaneKey: from.laneKey,
        fromIndex: from.index,
        toLaneKey: laneKey,
        toIndex: index,
      } satisfies KanbanMove);
    }

    function onDragEnd() {
      dragging.value = null;
      dropTarget.value = null;
    }

    expose({ scrollHost, dragging });

    return () => {
      // Docks attach to the strip's VERTICAL tail: `axis="horizontal"`
      // boards keep the pre-2026-11-10 shape (no forwarded dock slot), the
      // same gate the container itself applies to the ride placement —
      // there the tail is the cross axis, where an in-flow block child
      // leaks onto the hidden vertical axis.
      const docksOnTail = stripAxis.value !== "horizontal";
      // Styling hook AND behaviour switch for the CONTENT HEIGHT of the
      // board (see the dockMode prop doc): a ride dock only follows the
      // content when the lanes box is allowed to end above the viewport
      // bottom. Ride only — a pin board keeps the full-height lanes box it
      // always had, so no existing board changes. Gated on the dock actually
      // being mounted too (S2-2): a requested-but-empty slot is legal, and
      // releasing the lanes box for it would only shrink lane chrome on a
      // short board while no dock is there to justify it. Gated on a
      // non-empty board as well (2026-11-10 follow-up): with
      // `lanes.length === 0` the whole strip is replaced by the empty slot,
      // so the container — and any dock in it — is not rendered at all; the
      // hook means "a ride dock is mounted", and on an empty board none
      // ever is.
      const rideBoard =
        docksOnTail &&
        props.dockMode === "ride" &&
        !!slots.dockBottom &&
        props.lanes.length > 0;
      return (
        <div
          class="hk-kanban"
          data-axis={props.axis}
          data-dock-mode={rideBoard ? "ride" : undefined}
          data-dragging={dragging.value ? "" : undefined}
          aria-label={props.ariaLabel}
        >
          {props.lanes.length === 0
            ? (slots.empty?.() ?? null)
            : (
              <HScrollContainer
                ref={scrollHost}
                class="hk-kanban-strip"
                axis={stripAxis.value}
                overscanScreens={1}
                dockTailClearance={props.dockTailClearance}
                dockMode={props.dockMode}
              >
                {{
                  default: () => (
                    <div
                      class="hk-kanban-lanes"
                      // One variable; the stylesheet decides whether it is the
                      // lane's width (horizontal boards) or its height (vertical).
                      style={
                        props.laneSize ? { "--hk-kanban-lane-size": props.laneSize } : undefined
                      }
                    >
                      {props.lanes.map((lane, laneIndex) => {
                        const laneKey = props.laneKeyOf(lane, laneIndex);
                        const cards = cardsFor(lane, laneIndex);
                        return (
                          <section
                            key={laneKey}
                            class="hk-kanban-lane"
                            data-lane={laneKey}
                            data-drop-target={dropTarget.value === laneKey ? "" : undefined}
                            onDragover={(event: DragEvent) => onDragOver(laneKey, event)}
                            onDragleave={(event: DragEvent) => onDragLeave(laneKey, event)}
                            onDrop={(event: DragEvent) => onDrop(laneKey, cards.length, event)}
                          >
                            <header class="hk-kanban-lane-header">
                              {slots.laneHeader?.({
                                lane,
                                laneIndex,
                                laneKey,
                                cards,
                              })}
                            </header>
                            <div class="hk-kanban-cards">
                              {cards.map((card, cardIndex) => {
                                const cardKey =
                                  props.cardKeyOf?.(card, cardIndex) ?? `${laneKey}#${cardIndex}`;
                                return (
                                  <div
                                    key={cardKey}
                                    class="hk-kanban-card"
                                    data-card={cardKey}
                                    data-card-index={cardIndex}
                                    draggable={props.draggable || undefined}
                                    onDragstart={(event: DragEvent) =>
                                      onDragStart(card, laneKey, cardIndex, event)
                                    }
                                    onDragend={onDragEnd}
                                  >
                                    {slots.card?.({
                                      card,
                                      cardIndex,
                                      lane,
                                      laneIndex,
                                      laneKey,
                                    })}
                                  </div>
                                );
                              })}
                              {/* The tail keeps the lane's empty space hittable
                                  (the lane itself owns the drop). */}
                              <div class="hk-kanban-lane-tail" />
                            </div>
                            {slots.laneFooter?.({ lane, laneIndex, laneKey, cards })}
                          </section>
                        );
                      })}
                    </div>
                  ),
                  // Forwarded so a board's own chrome (a cruise canvas's dock
                  // under the lanes) keeps the container's dock contract —
                  // including the --hk-scroll-dock-* heights it publishes.
                  dockBottom: docksOnTail ? slots.dockBottom : undefined,
                }}
              </HScrollContainer>
            )}
        </div>
      );
    };
  },
});
