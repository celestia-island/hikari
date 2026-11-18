// 2026-10-10 user direction — the ONE user-selection business component.
// 2026-11 user direction, second pass — "the whole project's thing has to
// be ONE component, a tooltip-style panel (not its own window — on phones
// that adapts to a bottom sheet), search on top and the candidates under
// it, and with an empty search bar the candidates must be EMPTY (listing
// everything would be absurd)".
//
// 2026-11-18 user direction, third pass (chest's workspace member list):
//  · TRIGGER presentation — the host may collapse the field into its own
//    icon button by filling the `trigger` slot; the component anchors the
//    SAME panel to that button (desktop popout under it, phone bottom
//    sheet) and grows no second kind of window. The slot receives
//    `{ open, toggle }` so the host button can mirror the a11y state;
//    the click/keydown wiring stays here, on the anchor wrapper.
//  · GROUP-kind rows — grant surfaces treat users and user groups as the
//    same kind of thing (a group IS a batch of users), so an option may
//    carry `kind: "group"`: the row renders the group glyph beside the
//    name and `data-kind="group"` for hosts/tests. Identity is still
//    `uid`; the search contract is unchanged — the injected feed decides
//    whether a query answers users, groups, or both.
//
// Every surface that needs "pick one or more users" renders this field:
// selected members travel as tags (display name + email), and picking
// happens in the ONE anchored panel the library already owns for this —
// HkSelectPanel, the same surface a dropdown opens (desktop popout under
// the field, phone bottom sheet), never a centered modal. So the family
// grows no second kind of window, and the panel geometry (width parity
// with the field, the surface's ONE scrollbar, Escape / outside-click
// closing, the back-gesture layer) is the shared surface's, not ours.
//
// SEARCH-FIRST CONTRACT: the panel opens with an EMPTY query and shows no
// candidates at all — a picker over the user directory must never list the
// directory on open. Typing (250ms debounce) is what queries the injected
// `search`; the newest answer wins (race token); a rejection renders a
// retry affordance, never a throw. Hosts inject the search itself, so the
// component still carries zero transport.
//
// Semantics (the HkAffixPicker vocabulary): "single" closes on pick and
// replaces the selection; "multi" toggles rows in a working copy, counts
// them in the panel footer and commits on Confirm. The field's tag ×
// removes directly — no panel involved.
import { UsersRound, X } from "lucide-vue-next";

import HkIconButton from "./HkIconButton";

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import HkButton from "./HkButton";
import HkSearchInput from "./HkSearchInput";
import HkSelectPanel from "./HkSelectPanel";
import "./HkUserPicker.scss";

/** One pickable user. `uid` is the stable identity (what the host stores);
 *  `username`/`email`/`displayName`/`avatarUrl` are display baggage the
 *  field keeps inside its value so hosts never re-fetch to re-render.
 *  `kind: "group"` marks a user-group row (a batch grant, not a person):
 *  the row wears the group glyph; the default is "user". */
export interface HkUserOption {
  uid: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  kind?: "user" | "group";
}

/** Primary tag label: the display name when the deployment has one, the
 *  username otherwise — never both stacked (the email line follows). */
function tagTitle(user: HkUserOption): string {
  return user.displayName?.trim() || user.username;
}

/** Typing pause before the injected search runs (the family's debounce —
 *  HkSearchInput's own default interval, owned here because Enter is bound
 *  to row selection and must not ALSO flush a search). */
const SEARCH_DEBOUNCE_MS = 250;

export default defineComponent({
  name: "HkUserPicker",
  props: {
    modelValue: { type: Array as PropType<HkUserOption[]>, required: true },
    /** "single" replaces the selection on pick; "multi" accumulates (the
     *  HkAffixPicker mode vocabulary). */
    mode: { type: String as PropType<"single" | "multi">, default: "single" },
    /** Backend search: resolve a NON-EMPTY query to user options. The
     *  component never calls it for an empty query (empty input = empty
     *  candidate list, by contract). Rejections render as a retry hint,
     *  never a throw. */
    search: { type: Function as PropType<(query: string) => Promise<HkUserOption[]>>, required: true },
    label: { type: String, default: undefined },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    /** Rows rendered per query — a runaway backend answer cannot turn the
     *  panel into a thousand-row scroll. */
    maxResults: { type: Number, default: 50 },
    /** Standing hint shown while the query is empty (the panel's opening
     *  state). Defaults to the i18n bundle's `userPicker.emptyInitial`. */
    emptyHint: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_users: HkUserOption[]) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();

    const fieldRef = ref<HTMLElement | null>(null);
    /** The panel surface (HkSelectPanel) — its exposed `panelEl()` scopes
     *  the two DOM queries this component needs (focus the search field on
     *  open, scroll the keyboard cursor into view) to OUR surface, never
     *  the document. */
    const panelExpose = ref<{ panelEl: () => HTMLElement | null }>();

    const open = ref(false);
    const query = ref("");
    const results = ref<HkUserOption[]>([]);
    const loading = ref(false);
    const failed = ref(false);
    /** Keyboard cursor into `results` (-1 = nothing active). Published as
     *  `aria-activedescendant` on the search field; focus never leaves it. */
    const activeIndex = ref(-1);
    /** Multi-mode working copy — committed only on Confirm. */
    const draft = ref<HkUserOption[]>([]);
    /** Race guard: only the newest in-flight search may write results. */
    let searchToken = 0;
    /** The pending debounce (one timer for the whole component). */
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const generatedId = useId();
    const listboxId = `${generatedId}-listbox`;

    /** DOM id of a result row — encoded so a uid with quotes / spaces (an
     *  email-shaped id) still resolves as one id everywhere. */
    function optionId(user: HkUserOption): string {
      return `${generatedId}-user-${encodeURIComponent(user.uid)}`;
    }

    function stopPendingSearch(): void {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }

    async function runSearch(q: string): Promise<void> {
      const token = ++searchToken;
      loading.value = true;
      failed.value = false;
      try {
        const found = await props.search(q);
        if (token !== searchToken) return;
        results.value = (found ?? []).slice(0, props.maxResults);
        // The row set moved: an index from the previous answer would name
        // a different user (or none) — the cursor restarts unset.
        activeIndex.value = -1;
      } catch {
        if (token !== searchToken) return;
        results.value = [];
        activeIndex.value = -1;
        failed.value = true;
      } finally {
        if (token === searchToken) loading.value = false;
      }
    }

    /** The empty-candidate arm: no request, no rows. Bumping the token
     *  orphans any in-flight answer so a late resolve cannot repopulate a
     *  list the user just cleared. */
    function clearCandidates(): void {
      searchToken += 1;
      results.value = [];
      loading.value = false;
      failed.value = false;
      activeIndex.value = -1;
    }

    watch(query, (raw) => {
      stopPendingSearch();
      const q = raw.trim();
      if (!q) {
        // Hard contract: an empty (or whitespace-only) query searches
        // NOTHING and lists NOTHING — the hint stands alone.
        clearCandidates();
        return;
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runSearch(q);
      }, SEARCH_DEBOUNCE_MS);
    });

    /** Fresh session per open: the panel content UNMOUNTS when the surface
     *  fully closes, so this is also where a previous session's answer,
     *  cursor and draft are dropped. */
    function resetSession(): void {
      stopPendingSearch();
      searchToken += 1;
      query.value = "";
      results.value = [];
      loading.value = false;
      failed.value = false;
      activeIndex.value = -1;
      draft.value = [...props.modelValue];
    }

    /** Open focuses the search field (search-first surface): the panel
     *  content mounts on the surface's opening edge, so wait for that
     *  render before reaching into it. */
    async function focusSearch(): Promise<void> {
      await nextTick();
      if (!open.value) return;
      panelExpose.value
        ?.panelEl()
        ?.querySelector<HTMLInputElement>(".hk-user-picker-search input")
        ?.focus();
    }

    watch(open, (now) => {
      if (!now) {
        stopPendingSearch();
        loading.value = false;
        return;
      }
      resetSession();
      void focusSearch();
    });

    onBeforeUnmount(stopPendingSearch);

    const inDraft = (uid: string) => draft.value.some((u) => u.uid === uid);

    function togglePanel(): void {
      if (props.disabled) return;
      open.value = !open.value;
    }

    function pickRow(user: HkUserOption): void {
      if (props.mode === "single") {
        open.value = false;
        emit("update:modelValue", [user]);
        return;
      }
      draft.value = inDraft(user.uid)
        ? draft.value.filter((u) => u.uid !== user.uid)
        : [...draft.value, user];
    }

    function confirmDraft(): void {
      open.value = false;
      emit("update:modelValue", draft.value);
    }

    function cancelDraft(): void {
      open.value = false;
    }

    function retrySearch(): void {
      const q = query.value.trim();
      if (!q) return;
      stopPendingSearch();
      void runSearch(q);
    }

    const removeTag = (uid: string) => {
      if (props.disabled) return;
      emit(
        "update:modelValue",
        props.modelValue.filter((u) => u.uid !== uid),
      );
    };

    /** Arrow walk over the current rows, wrapping at both ends (the
     *  HkTagInput / HkSelect cursor). */
    function moveActive(delta: 1 | -1): void {
      const count = results.value.length;
      if (count === 0) {
        activeIndex.value = -1;
        return;
      }
      const from = activeIndex.value;
      if (from < 0 || from >= count) activeIndex.value = delta > 0 ? 0 : count - 1;
      else activeIndex.value = (from + delta + count) % count;
    }

    /** Keep the cursor row inside the surface's ONE scroll region (the
     *  desktop popout or the sheet's list band), never a region of ours. */
    function scrollActiveIntoView(): void {
      if (activeIndex.value < 0) return;
      const root = panelExpose.value?.panelEl();
      root
        ?.querySelector<HTMLElement>(`[data-user-index="${activeIndex.value}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    }

    watch(activeIndex, () => {
      scrollActiveIntoView();
    });

    /** Keys that bubbled from the panel surface — the search field lives
     *  inside it, so arrows pressed there arrive here (the HkSelectPanel
     *  `keydown` contract). Escape is the surface's own and never reaches
     *  this handler. */
    function onPanelKeydown(e: KeyboardEvent): void {
      if (e.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Enter") {
        // Enter takes the cursor row; with no cursor it takes the top
        // match — the HkAffixPicker / HkTagInput "blind Enter" order, kept
        // so a typed query can be committed without reaching for arrows.
        const row = results.value[activeIndex.value] ?? results.value[0];
        if (!row) return;
        e.preventDefault();
        pickRow(row);
      }
    }

    /** The field's own keys (focus lives here while the panel is closed). */
    function onFieldKeydown(e: KeyboardEvent): void {
      if (props.disabled) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        open.value = true;
        return;
      }
      if (e.key === "Escape" && open.value) {
        // The surface's Escape handler lives ON the surface; a key pressed
        // on the field would never reach it (the HkSelect trigger rule).
        e.preventDefault();
        e.stopPropagation();
        open.value = false;
      }
    }

    const panelTitle = computed(() => props.label ?? t("hikari::userPicker.title", "Select users"));

    const searchPlaceholder = computed(() =>
      t("hikari::userPicker.searchPlaceholder", "Nickname, username or email"),
    );

    const emptyHint = computed(
      () => props.emptyHint ?? t("hikari::userPicker.emptyInitial", "Type a nickname, username or email to search."),
    );

    /** The rows band's state ladder (loading → failed → empty → ready) —
     *  published as `data-state` so hosts/tests can key on the state
     *  without reading the note text. */
    const rowsState = computed(() =>
      loading.value
        ? "loading"
        : failed.value
          ? "failed"
          : results.value.length === 0
            ? "empty"
            : "ready",
    );

    return () => {
      const activeId =
        activeIndex.value >= 0 && results.value[activeIndex.value]
          ? optionId(results.value[activeIndex.value]!)
          : undefined;
      const hasQuery = query.value.trim().length > 0;
      const multi = props.mode === "multi";
      // Trigger presentation: the host's slot content replaces the tag
      // field as the visible chrome; this wrapper stays the ANCHOR and the
      // sole toggle wiring (click bubbles from the host's button; the
      // surface owns Escape), so the host cannot double-toggle. The slot
      // receives the state it needs to mirror a11y onto its own button.
      const triggerSlot = slots.trigger;
      const anchor = triggerSlot ? (
        <div
          ref={fieldRef}
          class={{ "hk-user-picker-trigger": true, "is-open": open.value }}
          onClick={togglePanel}
        >
          {triggerSlot({ open: open.value, toggle: togglePanel })}
        </div>
      ) : (
        <div
          ref={fieldRef}
          class={{ "hk-user-picker-field": true, "is-open": open.value }}
          role="button"
          tabindex={props.disabled ? -1 : 0}
          aria-disabled={props.disabled}
          aria-haspopup="listbox"
          aria-expanded={open.value}
          aria-label={panelTitle.value}
          onClick={togglePanel}
          onKeydown={onFieldKeydown}
        >
          {props.modelValue.map((user) => (
            <span key={user.uid} class="hk-user-picker-tag" title={`${tagTitle(user)} ${user.email ?? ""}`.trim()}>
              <span class="hk-user-picker-tag-body">
                <span class="hk-user-picker-tag-name">{tagTitle(user)}</span>
                {user.email && <span class="hk-user-picker-tag-email">{user.email}</span>}
              </span>
              {!props.disabled && (
                <HkIconButton
                  class="hk-user-picker-tag-x"
                  size={16}
                  variant="ghost"
                  aria-label={`${t("hikari::userPicker.remove", "Remove")} ${tagTitle(user)}`}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    removeTag(user.uid);
                  }}
                >
                  {{ icon: () => <X aria-hidden="true" /> }}
                </HkIconButton>
              )}
            </span>
          ))}
          <span class={{ "hk-user-picker-add": true, "is-placeholder": props.modelValue.length === 0 }}>
            {props.modelValue.length === 0
              ? (props.placeholder ?? t("hikari::userPicker.add", "Select users…"))
              : t("hikari::userPicker.add", "Select users…")}
          </span>
        </div>
      );

      return (
        <div class={{ "hk-user-picker": true, "is-disabled": props.disabled }}>
          {props.label && !triggerSlot && <div class="hk-user-picker-label">{props.label}</div>}
          {anchor}

          {/*
            The ONE anchored surface (desktop popout / phone bottom sheet).
            Field mode keeps the surface's own `matchAnchorWidth` default:
            the panel reads as this field's drop-down, not as a floating
            window. Trigger mode turns it off — an icon-button anchor is
            one glyph wide, so the panel carries the family width instead
            and opens bottom-end from its corner anchor. `maxHeight` bounds
            the surface that scrolls — the popout itself, or the sheet's
            list band — so the panel keeps exactly ONE scrollbar (the
            HkAffixPicker / HkTagInput rule). The measure is the family's
            catalog cap with a little more room, because this panel carries
            a search line AND (multi) a draft footer around the rows.
          */}
          <HkSelectPanel
            ref={panelExpose}
            open={open.value}
            onUpdate:open={(v: boolean) => { open.value = v; }}
            anchorRef={fieldRef.value ?? null}
            title={panelTitle.value}
            // An icon-button anchor sits at a corner: open toward the
            // panel's reading direction and do NOT inherit the anchor's
            // one-glyph width — the panel carries its own width instead
            // (`.is-trigger-anchor`).
            placement={Boolean(triggerSlot) ? "bottom-end" : "bottom-start"}
            matchAnchorWidth={!triggerSlot}
            maxHeight="min(22rem, 50dvh)"
            onKeydown={onPanelKeydown}
          >
            <div class={{ "hk-user-picker-panel": true, "is-trigger-anchor": Boolean(triggerSlot) }}>
              <div class="hk-user-picker-search" role="search">
                <HkSearchInput
                  role="combobox"
                  aria-expanded={true}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={activeId}
                  // The field's accessible name: the placeholder reads as
                  // the instruction ("Nickname, username or email") — the
                  // HkAffixPicker / HkTagInput precedent, so no new i18n
                  // key is invented for it.
                  aria-label={searchPlaceholder.value}
                  modelValue={query.value}
                  disabled={props.disabled}
                  placeholder={searchPlaceholder.value}
                  clearAriaLabel={t("hikari::search.clear", "Clear search")}
                  onUpdate:modelValue={(v: string) => { query.value = v; }}
                />
              </div>
              <div
                id={listboxId}
                class="hk-user-picker-rows"
                role="listbox"
                aria-multiselectable={multi ? "true" : undefined}
                aria-label={panelTitle.value}
                data-state={rowsState.value}
              >
                {/* The standing state line (searching / failed / empty) is
                  * the listbox's own content while it holds no rows — the
                  * HkTagInput empty-state precedent: the element the input's
                  * `aria-controls` names always exists, and its state is
                  * read where the rows would be. Rows that ARE present stay
                  * mounted under a "Searching…" line (stale-while-revalidate)
                  * so a new query never flashes the list empty. */}
                {loading.value && (
                  <p class="hk-user-picker-note">{t("hikari::userPicker.searching", "Searching…")}</p>
                )}
                {!loading.value && failed.value && (
                  // The retry affordance IS the note — clicking it re-runs
                  // the same query (the historic failed/retry semantics,
                  // never a toast).
                  <button
                    type="button"
                    class="hk-user-picker-retry"
                    onClick={retrySearch}
                  >
                    {t("hikari::userPicker.searchFailed", "The search failed; try again.")}
                  </button>
                )}
                {!loading.value && !failed.value && results.value.length === 0 && (
                  <p class="hk-user-picker-note">
                    {hasQuery
                      ? t("hikari::userPicker.empty", "No users match this search.")
                      : emptyHint.value}
                  </p>
                )}
                {results.value.map((user, index) => {
                  const selected = multi && inDraft(user.uid);
                  const isGroup = user.kind === "group";
                  return (
                    <div
                      key={user.uid}
                      id={optionId(user)}
                      role="option"
                      tabindex={-1}
                      class={{ "hk-user-picker-row": true, "is-selected": selected }}
                      aria-selected={selected}
                      data-user-index={index}
                      data-active={activeIndex.value === index || undefined}
                      data-kind={isGroup ? "group" : undefined}
                      // Grammar face attribute (_menu-item.scss): mi.item's
                      // checked face and its hover guard key on data-checked —
                      // emitted beside the legacy .is-selected class so the
                      // picked row's face survives hover.
                      data-checked={props.mode === "multi" && inDraft(user.uid) || undefined}
                      onClick={() => pickRow(user)}
                    >
                      {isGroup && (
                        <UsersRound size={14} class="hk-user-picker-row-kind" aria-hidden="true" />
                      )}
                      <span class="hk-user-picker-row-main">
                        <span class="hk-user-picker-row-name">{tagTitle(user)}</span>
                        {user.email && <span class="hk-user-picker-row-email">{user.email}</span>}
                      </span>
                      {multi && selected && (
                        <span class="hk-user-picker-row-check" aria-hidden>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {multi && (
                <div class="hk-user-picker-footer">
                  {draft.value.length > 0 && (
                    <p class="hk-user-picker-count">
                      {t("hikari::userPicker.selectedCount", "{count} selected").replace("{count}", String(draft.value.length))}
                    </p>
                  )}
                  <div class="hk-user-picker-actions">
                    <HkButton
                      variant="secondary"
                      size="sm"
                      class="hk-user-picker-cancel"
                      onClick={cancelDraft}
                    >
                      {t("hikari::messageBox.cancel", "Cancel")}
                    </HkButton>
                    <HkButton
                      variant="primary"
                      size="sm"
                      class="hk-user-picker-confirm"
                      disabled={draft.value.length === 0}
                      onClick={confirmDraft}
                    >
                      {t("hikari::userPicker.confirm", "Confirm")}
                    </HkButton>
                  </div>
                </div>
              )}
            </div>
          </HkSelectPanel>
        </div>
      );
    };
  },
});