import {
  computed,
  defineComponent,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";

import { Check, ChevronDown, GripVertical, Plus, Search } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import { usePointerReorder } from "../composables/usePointerReorder";

import HkInput from "./HkInput";
import HkListTransition from "./HkListTransition";
import HkSelectPanel from "./HkSelectPanel";
import HkTag from "./HkTag";
import "./HkTagInput.scss";

/** One entry of the tag catalog the field picks from. */
export interface HkTagOption {
  /** Stable identity — the value emitted back to the host. */
  key: string;
  /** Primary row AND tag text. */
  label: string;
  /** Secondary muted text (code suffix, hint). */
  meta?: string;
  /** Optional leading glyph (flag emoji or any short symbol). */
  flag?: string;
  /** Extra haystack for the search filter (aliases, codes, digits). */
  keywords?: string;
  /** Cannot be toggled on (still renders its check when it is set). */
  disabled?: boolean;
}

/** True when every character of `query` appears in `text` in the same
 *  order — gaps allowed ("中国" finds 中华人民共和国). Callers lowercase
 *  both sides first, matching the substring pass. Local copy of the
 *  helper HkAffixPicker uses (its internals are not exported; the rule
 *  is shared, the code deliberately is not). */
function isSubsequence(query: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

/** East-Asian wide glyphs occupy two `ch` units — approximating them
 *  keeps an auto-grown inline input from clipping CJK queries. */
const WIDE_GLYPH =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/;

/** Move the entry at `from` to the place of the entry at `to`, returning a
 *  fresh array — or null when the move says nothing (out of range, or the
 *  same slot). Insert-at-target semantics, which is what dropping one chip
 *  or one selected row ON another means: the moved key ends up at the
 *  target's index and the entries between them shift by one. */
function moveTo(list: readonly string[], from: number, to: number): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return null;
  }
  const next = list.slice();
  const [key] = next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}

/** The class HkListTransition paints on a node that is on its way OUT
 *  (`variant="reveal"` keeps it mounted, with pointer events off, until its
 *  squeeze-out ends). Such a node is no longer part of the list: it still
 *  sits in the DOM — and, under a test DOM, forever — so every strip a drag
 *  measures or indexes must skip it, or a drag started during a leave would
 *  count a ghost and move the wrong key. */
const LEAVING_CLASS = "hk-list-reveal-leave-active";

/** One keyboard stop of the panel: a visible catalog row, or the
 *  trailing custom row when `allowCustom` offers one (always last). */
type HkTagStop =
  | { id: string; kind: "option"; option: HkTagOption }
  | { id: string; kind: "custom" };

/**
 * HkTagInput — the tag editor field: selected tags live IN the field as
 * closable chips, and one searchable panel toggles catalog membership.
 *
 *   - the FIELD is a bordered, focus-ringed box in HkInput's visual
 *     language: tags left to right in host order, then a bare
 *     auto-growing input for typing, then the chevron that opens the
 *     panel. Chips wrap onto as many lines as they need and the box
 *     grows with them. At `maxTags` that input is NOT unmounted — it
 *     stays in place and goes `readOnly`, so the field keeps its focus,
 *     its caret and its accessible name while every ADD affordance is
 *     inert; the browser shows the placeholder (or the surviving query)
 *     as the field's text. Only `disabled` removes the element — a
 *     disabled control must not be focusable — and the placeholder text
 *     stands in for it;
 *   - the PANEL (chevron, any click inside the field, ArrowDown) is the
 *     shared HkSelectPanel surface — same popup-manager stacking, mobile
 *     bottom sheet, outside-click/Escape closing and ONE SCROLLBAR PER
 *     WINDOW contract as every other picker. It deliberately mounts no
 *     scroll region of its own: the window surface scrolls the search
 *     field and the rows as one. It also does NOT mirror the field's
 *     width (`matchAnchorWidth` is off, the HkAffixPicker precedent): the
 *     field is usually a full-width settings column while the catalog is
 *     designed at 13–19rem, so an anchor-wide box would leave a large
 *     empty band and park the surface's scrollbar far from the rows.
 *     Instead the surface is capped through `maxHeight`
 *     (`min(18rem, 45dvh)`), so a long catalog scrolls inside a panel
 *     that hugs its own measure rather than stretching to the viewport;
 *   - ALL options are listed, each with a check glyph when selected —
 *     unlike HkAffixPicker's multi mode, which hides the selected keys,
 *     "is this tag used or not" must stay visible and togglable in one
 *     pass. Toggling never closes the panel (batch editing);
 *   - ROWS ARE GROUP-STRICT: the selected options come first, in the
 *     host's `modelValue` order, then the unselected catalog options in
 *     catalog order, and the custom ("Use …") row is last. A query filters
 *     WITHIN the two groups — it can hide rows, never merge or re-sort
 *     them — and the keyboard stops (`stops`,
 *     `aria-activedescendant`) walk exactly this rendered order;
 *   - ORDER IS HOST STATE: a newly added key is APPENDED to the end of
 *     `modelValue` ("first tag = primary" for hosts that care), an
 *     existing key is removed in place, and the emitted array is always
 *     a copy of the host's order with that one edit applied;
 *   - REORDERING writes that same order back through
 *     `update:modelValue` (no add/remove fires — nothing was added or
 *     removed). Two drag surfaces, both with a ~6px movement threshold so
 *     a plain click/tap still clicks:
 *       * a CHIP is dragged by its BODY (its × never starts a drag, and
 *         pressing any control inside a chip is not a drag at all); the
 *         chip follows no ghost — it LIFTS in place (a touch larger,
 *         raised off the surface, only lightly dimmed so it stays legible
 *         as the item being moved) while the drop slot is ringed and the
 *         release emits the reordered array. The lift is what makes the
 *         gesture readable under a finger, where the cursor is invisible;
 *       * in the PANEL only the SELECTED rows move, and only through the
 *         explicit GRIP HANDLE at the row's trailing edge (the handle is
 *         the one element that claims touch, so the sheet keeps scrolling
 *         normally everywhere else, and a press on it that never became a
 *         drag does not toggle its row). Holding the drag near the top or
 *         bottom of the panel's own scroll region pulls the list along a
 *         frame at a time, so a row can be carried past the visible band
 *         of the (capped) surface in one gesture; nothing is scrolled
 *         without a live drag. A row drag is CLAMPED to the selected
 *         group: unselected rows are not drop targets and never move, and
 *         a release past the group's end lands on its last position. A
 *         dragged row lifts exactly like a dragged chip;
 *     both lists are keyed HkListTransition groups (FLIP `move`), so the
 *     moved chip/row and its neighbours animate into their new places,
 *     with the library's usual reduced-motion opt-outs (the lift's scale
 *     and shadow stay — only their 0.12s ramp is dropped, so a
 *     reduced-motion user keeps the state marker without the motion). The
 *     lift scales ALONG each list's drag axis and never across it: the drop
 *     slot is resolved from the items' live rects, so a span grown across
 *     that axis would hide every sibling from the pointer and silently
 *     collapse the gesture into a no-op;
 *   - a key in `modelValue` that the catalog does not carry (a custom
 *     tag, or an option deleted since) degrades to its raw key as the
 *     tag label — the same rule as HkAffixPicker.tagEntries. Such a key
 *     has no panel row (the panel only lists the catalog), so a panel
 *     drag is applied to the host's array BY KEY: the moved key lands on
 *     the target key's position and whatever sat between them shifts by
 *     one — a custom tag is never dropped, duplicated, or addressed by
 *     an index the panel cannot see (and it can still be moved by its
 *     own chip, where it is a first-class entry);
 *   - removal is IMMEDIATE: a tag's × emits `remove` + `update:modelValue`
 *     with no confirm dialog. This is a deliberate divergence from
 *     HkAffixPicker's `confirmRemove` two-step — a tag field is edited
 *     in bulk, and a modal per chip would dominate the flow;
 *   - with `allowCustom` a NON-EMPTY trimmed query offers a trailing
 *     "Use “<query>”" row, so the search box can also CREATE a value (the
 *     CORS-origin/admin-keyword case) — but only while that query names
 *     nothing the field already carries. An exact, case-folded match on
 *     an option key, on an option label, or on an ALREADY-SELECTED key
 *     suppresses the row: in all three cases there is nothing left to add.
 *
 * The field is a combobox-style control: the inline input carries
 * `role="combobox"`, `aria-expanded`, `aria-controls` (the listbox id)
 * and `aria-autocomplete="list"`; rows are `role="option"` with
 * `aria-selected`. ArrowDown / ArrowUp walk an ACTIVE row through the
 * visible rows — the custom row, when offered, is the LAST stop and both
 * ends wrap — and publish it as `aria-activedescendant` on the inline
 * input and on the panel's search field. That is the activedescendant
 * pattern: focus never moves to a row, the row is only highlighted, and
 * Enter activates the active row. With NO active row, Enter falls back to
 * the first row the query can still ADD (a selected row is not an add
 * target, so a blind Enter can never delete the tag the user is looking
 * at), then to the custom row; a query naming only what the field already
 * carries is a no-op. Every open and every query edit starts again with
 * no active row.
 *
 * REORDERING IS ALSO A KEYBOARD AFFORDANCE: from the field's input, the
 * panel's search box or a row that holds focus, Alt+ArrowUp /
 * Alt+ArrowDown moves the ACTIVE selected row one slot inside the
 * selected group (hard stops at its edges, a no-op for an unselected
 * row). The grip handle is a pointer affordance; the field and the panel
 * are otherwise pointer-only for reordering.
 *
 * CHIP TEXT IS NOT SELECTABLE WHILE THE FIELD IS EDITABLE — the chip is an
 * interactive control, and its press is the reorder gesture, exactly as a
 * `<button>`'s label is not selectable because its press is the activation.
 * The two cannot be had at once: a press allowed to start a text selection
 * is a press the browser has already claimed, so it can no longer become a
 * ~6px drag (on touch the long press raises the selection callout and the
 * drag dies on `pointercancel`; on a mouse the two gestures run together
 * and neither reads). The threshold therefore wins by design, and the
 * trade-off is paid where it costs nothing instead: a DISABLED field
 * reorders nothing, so its chips ARE selectable text — the stylesheet
 * flips their `user-select` back to `text` (and drops the grab cursor)
 * under the box's own disabled hook. The panel rows keep their LABELS
 * selectable even while editable: only the grip handle reserves the
 * gesture there, and it — not the label — is the drag target.
 *
 * `maxTags` freezes ADDS only. Reordering stays available at the cap:
 * the order is host state, and a reorder adds nothing (nor removes
 * anything).
 *
 * CONTROLLED: the component owns no selected state — `add` / `remove`
 * fire with the key and `update:modelValue` with the full next array, and
 * the host writes the prop back. Two synthetic clicks dispatched in the
 * SAME tick therefore both resolve against the same stale prop and
 * collapse to the last emitted state — a real pair of user clicks cannot
 * hit this, because the second lands after the host has re-rendered the
 * first — so a host must not write back asynchronously expecting both
 * edits to land.
 */
export const HkTagInput = defineComponent({
  name: "HkTagInput",
  props: {
    /** Selected keys, IN HOST ORDER (order is meaningful to hosts). */
    modelValue: {
      type: Array as PropType<readonly string[]>,
      default: () => [] as readonly string[],
    },
    /** The catalog the panel lists. */
    options: {
      type: Array as PropType<readonly HkTagOption[]>,
      default: () => [] as readonly HkTagOption[],
    },
    /** Free-text tags typed into the field / search box. */
    allowCustom: { type: Boolean, default: false },
    /** Field caption; also names the panel and the control. */
    label: { type: String, default: undefined },
    /** Shown inside the field while no tag & query — the inline input's
     *  placeholder. */
    placeholder: { type: String, default: undefined },
    /** Muted helper line under the field. */
    hint: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    /** Capacity cap; 0 / undefined means unlimited. At the cap the
     *  inline input stays mounted but `readOnly` (focus and the field's
     *  accessible name survive) and the panel's add affordances go
     *  disabled (the tags' × still removes). */
    maxTags: { type: Number, default: undefined },
    /** Search field placeholder; defaulted from the i18n bundle. */
    searchPlaceholder: { type: String, default: undefined },
    /** "No matches" row text; defaulted from the i18n bundle. */
    emptyText: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_keys: string[]) => true,
    /** A key was toggled on (fires before `update:modelValue`). */
    add: (_key: string) => true,
    /** A key was toggled off — tag × or a selected row. */
    remove: (_key: string) => true,
    "update:open": (_open: boolean) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const open = ref(false);
    const query = ref("");
    /** The keyboard cursor: an index into the stops list, -1 for "nothing
     *  active" — the state every open and every query edit starts from. */
    const activeIndex = ref(-1);
    const fieldRef = ref<HTMLElement | null>(null);
    const inputRef = ref<HTMLInputElement | null>(null);

    // Field identity for the label association, plus the listbox id the
    // inline input points at with aria-controls.
    const generatedId = useId();
    const listboxId = `${generatedId}-listbox`;

    /** A fresh close drops the filter — a reopened panel starts calm
     *  (the HkAffixPicker convention) — and the cursor is cleared on BOTH
     *  edges: a reopened panel must not remember a row. */
    watch(open, (v) => {
      if (!v) query.value = "";
      activeIndex.value = -1;
      emit("update:open", v);
    });

    /** Any query edit re-filters the list under the cursor, so the cursor
     *  goes with it — synchronously, so a key pressed in the same tick as
     *  the input event can never address a row that is already gone. */
    watch(
      query,
      () => {
        activeIndex.value = -1;
      },
      { flush: "sync" },
    );

    const selectedKeys = computed<readonly string[]>(() =>
      Array.isArray(props.modelValue) ? props.modelValue : [],
    );

    const atMax = computed(
      () => (props.maxTags ?? 0) > 0 && selectedKeys.value.length >= (props.maxTags ?? 0),
    );

    /** Tags in host order; a key the catalog does not carry renders the
     *  raw key as its label (custom tags survive edits of the catalog),
     *  and so does a catalog entry whose label is blank — an empty chip
     *  would be invisible and unnameable. */
    const tagEntries = computed<readonly HkTagOption[]>(() =>
      selectedKeys.value.map((key) => {
        const option = props.options.find((o) => o.key === key);
        if (option && option.label.trim()) return option;
        return { key, label: key };
      }),
    );

    /** Does one catalog entry survive the current query? Filtering is
     *  TWO-PASS over a single field at a time (never across concatenated
     *  fields, which produces noise):
     *    1. an exact substring match for precision (label / meta / key /
     *       keywords, case-folded);
     *    2. an in-order character subsequence fallback (gaps allowed) —
     *       so a renamed or CJK-composed label like "中华人民共和国" is
     *       still found by its short form "中国". */
    function matchesQuery(option: HkTagOption, q: string): boolean {
      if (!q) return true;
      if (option.label.toLowerCase().includes(q)) return true;
      if (option.meta && option.meta.toLowerCase().includes(q)) return true;
      if (option.key.toLowerCase().includes(q)) return true;
      if (option.keywords && option.keywords.toLowerCase().includes(q)) return true;
      // Fuzzy fallback — per field, in-order subsequence, gaps allowed.
      if (isSubsequence(q, option.label.toLowerCase())) return true;
      if (option.meta && isSubsequence(q, option.meta.toLowerCase())) return true;
      if (isSubsequence(q, option.key.toLowerCase())) return true;
      return !!option.keywords && isSubsequence(q, option.keywords.toLowerCase());
    }

    /** Rows of the panel in its READING ORDER — every matching option,
     *  never pruned by selection (that is what makes "used / not used"
     *  visible), but GROUP-STRICT:
     *    1. the selected options, in the host's `modelValue` order (the
     *       order a drag writes back — the selected group IS the host's
     *       array as far as this catalog can render it);
     *    2. then the unselected options, in catalog order;
     *    3. the custom row renders last, after this list.
     *
     *  The query filters WITHIN each group: it can hide rows, it can never
     *  re-sort them or merge the two groups. */
    const rows = computed<readonly HkTagOption[]>(() => {
      const q = query.value.trim().toLowerCase();
      const matched = props.options.filter((option) => matchesQuery(option, q));
      if (selectedKeys.value.length === 0) return matched;
      /** modelValue position of a key (a duplicated key keeps its first). */
      const order = new Map<string, number>();
      selectedKeys.value.forEach((key, index) => {
        if (!order.has(key)) order.set(key, index);
      });
      const selected: HkTagOption[] = [];
      const rest: HkTagOption[] = [];
      for (const option of matched) {
        (order.has(option.key) ? selected : rest).push(option);
      }
      selected.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
      return [...selected, ...rest];
    });

    /** The rows a drag may move, in display order — the selected group,
     *  which the render puts first, so index `i` here is display row `i`
     *  AND the i-th drop target of the panel strip. */
    const selectedRows = computed<readonly HkTagOption[]>(() =>
      rows.value.filter((option) => selectedKeys.value.includes(option.key)),
    );

    const customText = computed(() => query.value.trim());

    /** An exact key OR label match means the query is naming an entry the
     *  catalog already carries; a key already selected (a custom tag from
     *  an earlier edit) has nothing left to add either — in both cases no
     *  duplicate custom row is offered. */
    const exactMatch = computed(() => {
      const q = customText.value.toLowerCase();
      if (!q) return false;
      if (
        props.options.some(
          (o) => o.key.toLowerCase() === q || o.label.toLowerCase() === q,
        )
      ) {
        return true;
      }
      return selectedKeys.value.some((key) => key.toLowerCase() === q);
    });

    const customVisible = computed(
      () => props.allowCustom && !!customText.value && !exactMatch.value,
    );

    /** Rows and the custom row are inert while the field is disabled or
     *  already at capacity. */
    const rowsDisabled = computed(() => props.disabled || atMax.value);

    /** DOM id of a row stop: the single spelling the ROW renders and
     *  `aria-activedescendant` publishes, so the two can never drift.
     *
     *  Keyed by the option's KEY rather than by its position, because a
     *  position is not stable: rows reorder (a drag, the group regroup, a
     *  query), and a leaving row keeps whatever id it had until its
     *  squeeze-out ends — a positional id would then be worn by two nodes
     *  at once and `aria-activedescendant` could resolve to the ghost.
     *  `encodeURIComponent` keeps an arbitrary host key inside one id; two
     *  catalog entries sharing a key are a host bug Vue already rejects
     *  (duplicate vnode keys). */
    function optionStopId(option: HkTagOption): string {
      return `${generatedId}-option-${encodeURIComponent(option.key)}`;
    }

    /** DOM id of the custom row — the one stop with no option behind it. */
    const customStopId = `${generatedId}-custom`;

    /** The stops ArrowDown / ArrowUp walk, in the panel's reading order:
     *  the visible rows, then the custom row as the LAST stop. */
    const stops = computed<readonly HkTagStop[]>(() => {
      const list: HkTagStop[] = rows.value.map((option) => ({
        id: optionStopId(option),
        kind: "option" as const,
        option,
      }));
      if (customVisible.value) list.push({ id: customStopId, kind: "custom" });
      return list;
    });

    /** The active stop, or null when nothing is active — also when the
     *  list shrank under a stale index (a cursor past the end is no
     *  cursor, never a neighbouring row). */
    const activeStop = computed<HkTagStop | null>(
      () => stops.value[activeIndex.value] ?? null,
    );

    /** The panel's keyboard reorder: move the ACTIVE row one slot inside
     *  the selected group (the same edit a row drag makes, without a
     *  pointer). Only a selected row has a place in that order, the ends of
     *  the group are hard stops, and `false` means the key was not ours to
     *  consume. The cursor stays on the key it was on — the stops rebuild
     *  in the new order, so it follows the row the user moved. */
    function nudgeActiveRow(delta: 1 | -1): boolean {
      const stop = activeStop.value;
      if (props.disabled || !stop || stop.kind !== "option") return false;
      const group = selectedRows.value;
      const from = group.findIndex((option) => option.key === stop.option.key);
      if (from < 0) return false;
      const to = from + delta;
      if (to < 0 || to >= group.length) return false;
      reorderSelectedRows(from, to);
      activeIndex.value = to;
      return true;
    }

    /** Alt+ArrowUp / Alt+ArrowDown on any of the field's keyboard surfaces
     *  is the reorder key: it is consumed even when the cursor has nowhere
     *  to go (an unselected or edge row), because Alt+Arrow is not a plain
     *  arrow — the browser must not act on it either. Returns whether the
     *  key belonged to the reorder. */
    function onReorderKey(e: KeyboardEvent): boolean {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return false;
      e.preventDefault();
      nudgeActiveRow(e.key === "ArrowUp" ? -1 : 1);
      return true;
    }

    /** Walk the cursor one stop. From "nothing active" ArrowDown lands on
     *  the FIRST stop and ArrowUp on the last; from either end it wraps
     *  around. An empty list leaves nothing active. */
    function moveActive(delta: 1 | -1): void {
      const count = stops.value.length;
      if (count === 0) {
        activeIndex.value = -1;
        return;
      }
      const from = activeIndex.value;
      if (from < 0 || from >= count) activeIndex.value = delta > 0 ? 0 : count - 1;
      else activeIndex.value = (from + delta + count) % count;
    }

    /** Rows that carry the raw key when the catalog's label is blank. */
    function labelOf(option: HkTagOption): string {
      return option.label.trim() ? option.label : option.key;
    }

    /** Accessible name of a selected row's drag handle: it names the entry
     *  AND the action on the pointer surface (aria-label + title) instead of
     *  leaving a bare glyph there. The reorder itself is pointer-only — the
     *  row keeps its `option` role and its aria, the keyboard keeps the
     *  activedescendant cursor plus the × / Backspace removal, and the
     *  handle stays out of the tab order. (An option's children are
     *  presentational to AT, so the handle's own name is not announced;
     *  that is the accepted cost of keeping the row's existing roles.) */
    function reorderLabel(option: HkTagOption): string {
      return interpolate(t("hikari::tagInput.reorder", "Reorder {label}"), {
        label: labelOf(option),
      });
    }

    /** Is this row inert? The field being disabled or full freezes the
     *  whole list (there is nothing to add); `disabled` on an option only
     *  forbids toggling it ON, so an already-set disabled option stays
     *  removable — a catalog edit must never strand a tag forever. */
    function rowInert(option: HkTagOption): boolean {
      if (rowsDisabled.value) return true;
      return !!option.disabled && !selectedKeys.value.includes(option.key);
    }

    const title = computed(() => props.label ?? t("hikari::tagInput.title", "Tags"));
    const placeholder = computed(() => props.placeholder ?? "");

    const tagSize = computed<"sm" | "md">(() => (props.size === "sm" ? "sm" : "md"));

    /** The inline input grows with its content (plus one caret unit);
     *  the placeholder drives the width while the query is empty. */
    const inlineWidth = computed(() => {
      const text = query.value || placeholder.value;
      let units = 0;
      for (const ch of text) units += WIDE_GLYPH.test(ch) ? 2 : 1;
      return `${Math.max(2, units + 1)}ch`;
    });

    function interpolate(template: string, vars: Record<string, string>): string {
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.split(`{${k}}`).join(v),
        template,
      );
    }

    function openPanel(): void {
      if (props.disabled) return;
      open.value = true;
    }

    /** Commit one edit to the host's ordered key list. `add` / `remove`
     *  fire first (the key), `update:modelValue` second (the full new
     *  array) — the same "specific event, then the model" order the
     *  neighbours use. */
    function commit(next: string[], key: string, kind: "add" | "remove"): void {
      if (kind === "add") emit("add", key);
      else emit("remove", key);
      emit("update:modelValue", next);
    }

    /** Appends to the END of the host order — never re-sorts, so
     *  "first tag = primary" stays under the host's control. Returns
     *  whether the key was actually added. */
    function addKey(key: string): boolean {
      if (props.disabled || atMax.value) return false;
      if (selectedKeys.value.includes(key)) return false;
      commit([...selectedKeys.value, key], key, "add");
      return true;
    }

    function removeKey(key: string): void {
      if (props.disabled) return;
      const index = selectedKeys.value.indexOf(key);
      if (index < 0) return;
      const next = selectedKeys.value.slice();
      next.splice(index, 1);
      commit(next, key, "remove");
    }

    function toggle(key: string): void {
      if (props.disabled) return;
      if (selectedKeys.value.includes(key)) removeKey(key);
      else addKey(key);
    }

    function toggleRow(option: HkTagOption): void {
      if (rowInert(option)) return;
      toggle(option.key);
    }

    /** A chip dropped on another chip. The field's own left-to-right order
     *  IS the host's array order (tagEntries maps `modelValue` 1:1), so the
     *  two display indices are the array indices — the only edit is the
     *  move, and `update:modelValue` carries it. */
    function reorderChips(from: number, to: number): void {
      const next = moveTo(selectedKeys.value, from, to);
      if (next) emit("update:modelValue", next);
    }

    /** A selected row dropped on another selected row. The panel's group
     *  only carries keys the catalog lists, while `modelValue` may
     *  interleave custom ones — so the display indices are mapped through
     *  their KEYS and the move happens inside the host's own array: the
     *  moved key lands on the target key's position and whatever sat
     *  between the two shifts by one. A key the panel never showed is
     *  therefore neither dropped nor inserted at an index it never had. */
    function reorderSelectedRows(from: number, to: number): void {
      const group = selectedRows.value;
      const fromKey = group[from]?.key;
      const toKey = group[to]?.key;
      if (fromKey === undefined || toKey === undefined) return;
      const next = moveTo(
        selectedKeys.value,
        selectedKeys.value.indexOf(fromKey),
        selectedKeys.value.indexOf(toKey),
      );
      if (next) emit("update:modelValue", next);
    }

    /** The panel surface, as the drag strip's query root: the selected
     *  rows are marked `data-reorder` and ONLY they are listed, so the
     *  drop space ends with the selected group — an unselected row can
     *  never be a landing slot (the clamp is structural, not a rule the
     *  drag has to remember). */
    const panelRef = ref<HTMLElement | null>(null);

    /** The chips the field CARRIES, in display order (the drag strip). A
     *  chip on its way out is not one of them — see LEAVING_CLASS. */
    function liveChips(): HTMLElement[] {
      return fieldRef.value
        ? [
            ...fieldRef.value.querySelectorAll<HTMLElement>(
              `.hk-tag-input-tag:not(.${LEAVING_CLASS})`,
            ),
          ]
        : [];
    }

    /** The selected rows, in display order (the panel's drag strip) — the
     *  same leaving-node rule. */
    function liveReorderRows(): HTMLElement[] {
      return panelRef.value
        ? [
            ...panelRef.value.querySelectorAll<HTMLElement>(
              `[data-reorder="true"]:not(.${LEAVING_CLASS})`,
            ),
          ]
        : [];
    }

    const chipDrag = usePointerReorder({
      axis: "x",
      items: liveChips,
      onDrop: reorderChips,
    });

    const rowDrag = usePointerReorder({
      axis: "y",
      items: liveReorderRows,
      // The panel's own scroll region — the desktop popout or the mobile
      // sheet's list band, whichever the surface mounted — so a long drag
      // carries a row past the visible band by scrolling the surface that
      // already owns THE scrollbar (never a region of this component's
      // own). Resolved per drag, because the form factor is decided by the
      // viewport at open time.
      scrollContainer: () =>
        panelRef.value?.closest<HTMLElement>(
          ".hk-select-popout, .hk-select-sheet-list",
        ) ?? null,
      onDrop: reorderSelectedRows,
    });

    /** The "Use “<query>”" row — the raw typed text becomes the tag. The
     *  query is consumed only when the tag was really added, so a no-op
     *  can never look like an accepted edit. */
    function addCustom(): void {
      const q = customText.value;
      if (!q || rowsDisabled.value) return;
      if (!addKey(q)) return;
      query.value = "";
    }

    /** Enter resolves the typed query. With an active row that row wins —
     *  the keyboard cursor must be able to reach a row other than the top
     *  one. With nothing active it stays the HkAffixPicker order: the
     *  first row the query can still ADD, otherwise the custom row (an
     *  inert top row falls through instead of swallowing the key, and so
     *  does a row the field already carries — a blind Enter is an add
     *  gesture, and since selected rows now sort FIRST, toggling the top
     *  match would silently remove the very tag the user is looking at).
     *  Removing stays a deliberate act: the row itself, or the cursor.
     *  An empty query is a no-op: Enter on a blank field must not pick
     *  the top of the catalog. */
    function commitQuery(): void {
      const stop = activeStop.value;
      if (stop) {
        if (stop.kind === "custom") addCustom();
        else toggleRow(stop.option);
        return;
      }
      const q = customText.value;
      if (!q) return;
      const addable = rows.value.find(
        (option) => !rowInert(option) && !selectedKeys.value.includes(option.key),
      );
      if (addable) {
        toggleRow(addable);
        return;
      }
      if (customVisible.value) addCustom();
    }

    /** A press inside the field that lands on a CHIP starts a potential
     *  chip drag. Caught here on the box because the chip is rendered by
     *  HkTag (whose root takes no arbitrary attributes): the press's own
     *  target is resolved back to its chip, so the chip body is the handle
     *  while the × — a button — is vetoed inside the composable. A press
     *  on the input, the chevron or the empty space resolves to no chip
     *  and is none of the drag's business. */
    function onFieldPointerDown(e: PointerEvent): void {
      if (props.disabled) return;
      const chip = (e.target as HTMLElement | null)?.closest?.(".hk-tag-input-tag");
      if (!chip) return;
      // The SAME strip the drop measures: a chip on its way out is not a
      // slot, and counting it would shift every index behind it.
      const index = liveChips().indexOf(chip as HTMLElement);
      if (index >= 0) chipDrag.start(e, index);
    }

    function onFieldClick(e: MouseEvent): void {
      if (props.disabled) return;
      const target = e.target as HTMLElement | null;
      // The chevron drives its own toggle, and a tag × must only remove:
      // an already-open panel is left as it is, but the press never
      // OPENS one behind the pointer.
      if (target?.closest?.(".hk-tag-input-chevron")) return;
      if (target?.closest?.(".hk-tag-close")) return;
      openPanel();
      inputRef.value?.focus();
    }

    function onInlineKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      if (onReorderKey(e)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitQuery();
        return;
      }
      if (e.key === "Backspace" && !query.value) {
        const last = selectedKeys.value.at(-1);
        if (last !== undefined && !props.disabled) {
          e.preventDefault();
          removeKey(last);
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        // Closed: the arrow only opens the panel — the canonical combobox
        // step, and opening starts with nothing active. Open: it walks
        // the cursor; focus stays where it is (activedescendant).
        if (!open.value) openPanel();
        else moveActive(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Escape") {
        // First Escape folds the panel (and drops the query); a second
        // one has nothing left to clear — committed tags are never
        // discarded by a keystroke.
        if (open.value) {
          e.preventDefault();
          e.stopPropagation();
          open.value = false;
        }
        return;
      }
    }

    function onSearchKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      if (onReorderKey(e)) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitQuery();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        open.value = false;
      }
    }

    /** Arrows pressed on the panel SURFACE itself (a row keeps focus
     *  after a click, since rows carry tabindex="-1") walk the cursor
     *  too. Keydowns that bubbled out of a field are that field's own
     *  business — handled once, never twice. */
    function onPanelKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      const target = e.target as HTMLElement | null;
      // A field's own arrows are that field's business — including the
      // reorder chord, which onSearchKeydown/onInlineKeydown already took.
      if (target?.closest?.("input, textarea, select")) return;
      if (onReorderKey(e)) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(e.key === "ArrowDown" ? 1 : -1);
      }
    }

    return () => {
      const visibleRows = rows.value;
      const searchPlaceholder =
        props.searchPlaceholder ?? t("hikari::tagInput.search", "Search");
      const emptyText = props.emptyText ?? t("hikari::tagInput.empty", "No matches");
      const removeLabel = t("hikari::tagInput.remove", "Remove");
      const customLabel = interpolate(
        t("hikari::tagInput.addCustom", "Use “{q}”"),
        { q: customText.value },
      );
      // The inline input is unmounted ONLY while disabled — a disabled
      // control must not be focusable, and the placeholder text keeps the
      // field readable. At capacity it stays mounted and goes readOnly:
      // the field keeps its focus, its caret and its accessible name, the
      // browser shows the placeholder (or the surviving query) as the
      // field's text, and every add affordance is inert anyway.
      const inputRendered = !props.disabled;
      const activeId = activeStop.value?.id;
      return (
        <div class="hk-tag-input-wrapper">
          {props.label && (
            <label
              class="hk-tag-input-label"
              // A `for` must name an element that exists. While disabled
              // there is no input to point at, and the box carries the
              // caption itself (role="group" + aria-label).
              for={inputRendered ? generatedId : undefined}
            >
              {props.label}
            </label>
          )}
          <div
            ref={(el: unknown) => {
              fieldRef.value = (el as HTMLElement) ?? null;
            }}
            class={[
              "hk-tag-input-box",
              `hk-tag-input-box-${props.size}`,
              open.value ? "hk-tag-input-box-open" : "",
            ]}
            data-disabled={props.disabled || undefined}
            data-full={atMax.value || undefined}
            role={inputRendered ? undefined : "group"}
            aria-label={inputRendered ? undefined : title.value}
            onPointerdown={onFieldPointerDown}
            onClick={onFieldClick}
          >
            {/* The chips are a keyed list, so a reorder FLIPs the moved
              * chip and its neighbours into place. `tag=""` renders the
              * group as a FRAGMENT (Vue's TransitionGroup contract for an
              * absent tag): no wrapper element appears in the field, so
              * every chip stays a direct item of the box's wrapping row
              * exactly as before. The press itself is caught on the BOX
              * below (HkTag accepts no arbitrary attributes), which is why
              * the drag markers are classes, not data attributes. */}
            <HkListTransition tag="" variant="reveal" move>
              {tagEntries.value.map((entry, index) => {
                const dragging = chipDrag.dragFrom.value === index;
                const dropTarget =
                  chipDrag.dragging.value && chipDrag.dragOver.value === index && !dragging;
                return (
                  <HkTag
                    key={entry.key}
                    class={[
                      "hk-tag-input-tag",
                      dragging ? "hk-tag-input-tag-dragging" : "",
                      dropTarget ? "hk-tag-input-tag-drop" : "",
                    ]}
                    size={tagSize.value}
                    closable={!props.disabled}
                    closeLabel={`${removeLabel} — ${entry.label}`}
                    onClose={() => removeKey(entry.key)}
                  >
                    <span class="hk-tag-input-tag-text">{entry.label}</span>
                  </HkTag>
                );
              })}
            </HkListTransition>
            {inputRendered ? (
              <input
                ref={inputRef}
                id={generatedId}
                type="text"
                class="hk-tag-input-element"
                style={{ width: inlineWidth.value }}
                value={query.value}
                role="combobox"
                aria-expanded={open.value}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-activedescendant={activeId}
                aria-label={props.label ? undefined : title.value}
                // At the cap the field stays focusable and readable, but
                // takes no text; nothing could be added with it anyway.
                // (Lowercase `readonly`: Vue's JSX types spell the DOM
                // ATTRIBUTE, and the runtime sets the boolean attribute.)
                // Backspace on the empty readOnly field still removes the
                // last tag — the very code path an editable field uses,
                // and at the cap the keyboard way to free a slot, exactly
                // like the chip's ×.
                readonly={atMax.value || undefined}
                placeholder={placeholder.value}
                autocomplete="off"
                spellcheck={false}
                data-1p-ignore
                data-lpignore="true"
                onInput={(e: Event) => {
                  query.value = (e.target as HTMLInputElement).value;
                }}
                onKeydown={onInlineKeydown}
              />
            ) : placeholder.value ? (
              <span class="hk-tag-input-placeholder">{placeholder.value}</span>
            ) : null}
            <button
              type="button"
              class="hk-tag-input-chevron"
              disabled={props.disabled}
              aria-haspopup="listbox"
              aria-expanded={open.value}
              aria-label={title.value}
              title={title.value}
              // Keep the inline input's focus (and its caret) on the
              // chevron press — the panel opens without a blur flicker.
              onMousedown={(e: MouseEvent) => e.preventDefault()}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (props.disabled) return;
                open.value = !open.value;
              }}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
          {props.hint && <p class="hk-tag-input-hint">{props.hint}</p>}
          <HkSelectPanel
            open={open.value}
            anchorRef={fieldRef.value}
            title={title.value}
            placement="bottom-start"
            // The panel hugs its own designed 13–19rem measure instead of
            // stretching to the field's width (usually a full-width
            // settings column): an anchor-wide surface would leave a band
            // of empty popout beside the catalog and park the surface's
            // scrollbar at the far edge of it. The cap keeps a long
            // catalog scrolling inside that measure rather than growing
            // toward the 36rem stylesheet ceiling.
            matchAnchorWidth={false}
            maxHeight="min(18rem, 45dvh)"
            onUpdate:open={(v: boolean) => {
              open.value = v;
            }}
            onKeydown={onPanelKeydown}
          >
            {{
              default: () => (
                /* Width container only — the window surface (HkSelectPanel
                 * popout / sheet) owns THE single scrollbar and scrolls the
                 * search field with the rows; no inner max-height/overflow
                 * here, ever. */
                <div class="hk-tag-input-panel" ref={panelRef}>
                  <div class="hk-tag-input-search" role="search">
                    <HkInput
                      modelValue={query.value}
                      onUpdate:modelValue={(v: string) => {
                        query.value = v;
                      }}
                      size="sm"
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      // The search field is the second combobox surface:
                      // arrows pressed here move the SAME cursor, and the
                      // row is published the same way.
                      aria-activedescendant={activeId}
                      autocomplete="off"
                      onKeydown={onSearchKeydown}
                    >
                      {{
                        prefixIcon: () => <Search size={13} aria-hidden="true" />,
                      }}
                    </HkInput>
                  </div>
                  {/* The listbox element exists for as long as the panel is
                    * open — including when the filter matches nothing — so
                    * the input's `aria-controls` always resolves; the empty
                    * state is its only child in that case. */}
                  <div
                    id={listboxId}
                    class="hk-tag-input-list"
                    role="listbox"
                    aria-multiselectable="true"
                    aria-label={title.value}
                  >
                    {/* The rows are a keyed list, so a reorder FLIPs the
                      * moved row and its neighbours. `tag=""` renders the
                      * group as a FRAGMENT (Vue's TransitionGroup contract
                      * for an absent tag): the rows stay the listbox's OWN
                      * children — still options of the listbox for
                      * aria-required-children, still the flex items that
                      * carry the option rhythm — with no wrapper element in
                      * between. */}
                    <HkListTransition tag="" variant="reveal" move>
                      {visibleRows.map((option, index) => {
                        const selected = selectedKeys.value.includes(option.key);
                        const inert = rowInert(option);
                        const stop = stops.value[index];
                        // Only a selected row is a drag item: it carries the
                        // marker the panel strip lists AND the grip that
                        // starts the drag. An unselected row stays put — not
                        // draggable, and not a drop target either.
                        const reorderable = selected && !props.disabled;
                        const dragging = rowDrag.dragFrom.value === index;
                        const dropTarget =
                          rowDrag.dragging.value &&
                          rowDrag.dragOver.value === index &&
                          !dragging;
                        return (
                          <div
                            key={option.key}
                            id={stop.id}
                            role="option"
                            tabindex={-1}
                            class="hk-tag-input-row"
                            aria-selected={selected}
                            aria-disabled={inert || undefined}
                            data-selected={selected || undefined}
                            data-disabled={inert || undefined}
                            data-active={activeId === stop.id || undefined}
                            data-reorder={reorderable ? "true" : undefined}
                            data-dragging={dragging || undefined}
                            data-drop={dropTarget || undefined}
                            onClick={(e: MouseEvent) => {
                              e.stopPropagation();
                              toggleRow(option);
                            }}
                          >
                            <span class="hk-tag-input-check" aria-hidden="true">
                              {selected && <Check size={14} />}
                            </span>
                            {option.flag && (
                              <span class="hk-tag-input-row-flag" aria-hidden="true">
                                {option.flag}
                              </span>
                            )}
                            <span class="hk-tag-input-row-label">{labelOf(option)}</span>
                            {option.meta && (
                              <span class="hk-tag-input-row-meta">{option.meta}</span>
                            )}
                            {reorderable && (
                              <span
                                class="hk-tag-input-grip"
                                role="button"
                                tabindex={-1}
                                aria-label={reorderLabel(option)}
                                title={reorderLabel(option)}
                                // The handle — and only the handle — claims
                                // the gesture (touch-action: none), so the
                                // sheet keeps scrolling under every other
                                // part of the row.
                                onPointerdown={(e: PointerEvent) => {
                                  rowDrag.start(e, index);
                                }}
                                // A press on the handle that never became a
                                // drag must not fall through to the row's
                                // toggle: losing the tag the user reached
                                // for is not what a handle means.
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                }}
                              >
                                <GripVertical size={14} aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {customVisible.value && (
                        <div
                          id={customStopId}
                          key="hk-tag-input-custom"
                          role="option"
                          tabindex={-1}
                          class="hk-tag-input-row"
                          aria-selected={false}
                          // The custom row is inert on exactly the same flag
                          // as the option rows — the whole list (custom row
                          // included) freezes when the field is disabled or
                          // full, and reads inert to AT while it does.
                          aria-disabled={rowsDisabled.value || undefined}
                          data-custom="true"
                          data-disabled={rowsDisabled.value || undefined}
                          data-active={activeId === customStopId || undefined}
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            addCustom();
                          }}
                        >
                          <span class="hk-tag-input-check" aria-hidden="true">
                            <Plus size={14} />
                          </span>
                          <span class="hk-tag-input-row-label">{customLabel}</span>
                        </div>
                      )}
                    </HkListTransition>
                  </div>
                  {/* The empty message lives OUTSIDE the listbox: a listbox
                    * may only own options/groups (aria-required-children),
                    * and the element it hangs off must still exist while the
                    * panel is open for `aria-controls` to resolve. */}
                  {visibleRows.length === 0 && !customVisible.value && (
                    <div class="hk-tag-input-empty">{emptyText}</div>
                  )}
                </div>
              ),
            }}
          </HkSelectPanel>
        </div>
      );
    };
  },
});

export default HkTagInput;
