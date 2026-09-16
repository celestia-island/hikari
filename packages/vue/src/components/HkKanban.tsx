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
  },
  emits: ["move"],
  setup(props, { slots, emit, expose }) {
    const scrollHost = shallowRef<{ getScrollElement: () => HTMLElement | undefined } | null>(null);
    /** The card being dragged, kept at module scope of the setup so a drop
     *  can name both ends without the host tracking drag state. */
    const dragging = ref<{ laneKey: string; index: number; card: unknown } | null>(null);
    const dropTarget = ref<string | null>(null);

    const cardsFor = (lane: unknown, index: number) => props.cardsOf(lane, index);

    /** The scroll axis of the lane strip itself: stacked lanes scroll down,
     *  side-by-side lanes scroll across. */
    const stripAxis = computed(() => (props.axis === "vertical" ? "vertical" : "horizontal"));

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

    function onDragLeave(laneKey: string) {
      if (dropTarget.value === laneKey) dropTarget.value = null;
    }

    function onDrop(lane: unknown, laneKey: string, index: number, event: DragEvent) {
      if (!props.draggable || !dragging.value) return;
      event.preventDefault();
      const from = dragging.value;
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

    return () => (
      <div
        class="hk-kanban"
        data-axis={props.axis}
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
            >
              <div
                class="hk-kanban-lanes"
                style={
                  props.laneSize
                    ? props.axis === "vertical"
                      ? { "--hk-kanban-lane-size": props.laneSize }
                      : { "--hk-kanban-lane-size": props.laneSize }
                    : undefined
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
                      onDragleave={() => onDragLeave(laneKey)}
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
                              draggable={props.draggable || undefined}
                              onDragstart={(event: DragEvent) =>
                                onDragStart(card, laneKey, cardIndex, event)
                              }
                              onDragover={(event: DragEvent) => onDragOver(laneKey, event)}
                              onDrop={(event: DragEvent) => onDrop(lane, laneKey, cardIndex, event)}
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
                        {/* The lane's own tail is a drop target too, so a card
                            can be appended to an empty or full lane. */}
                        <div
                          class="hk-kanban-lane-tail"
                          onDragover={(event: DragEvent) => onDragOver(laneKey, event)}
                          onDrop={(event: DragEvent) => onDrop(lane, laneKey, cards.length, event)}
                        />
                      </div>
                      {slots.laneFooter?.({ lane, laneIndex, laneKey, cards })}
                    </section>
                  );
                })}
              </div>
            </HScrollContainer>
          )}
      </div>
    );
  },
});
