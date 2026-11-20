/**
 * HkNotificationBell — the bell trigger and the notification-center
 * panel as ONE composition (user direction 2026-11-15: the storage
 * grammar is hikari's, the placement is the host's — mount this
 * wherever the host's chrome keeps its top-right buttons; the chest
 * webui's reference spot is inside HeaderEndCluster, LEFT of the
 * settings gear, so the local shell's window controls stay untouched).
 *
 * Composition discipline (same rule as HEmergencySnoozeTray): the
 * trigger IS HkIconButton (chrome ladder via useChromeActionSize, so it
 * reads as one row with the search/settings buttons); the unread mark
 * is the button's OWN dot (dot/dotVariant/dotLabel — the 2026-10-28
 * ruling that a chrome-step ghost button carries its mark inside its
 * box, not as a stray wrapper badge); the surface IS HkPopover with
 * `sheetOnMobile` — anchored bottom-end flyout on desktop, bottom
 * sheet on phones, live-safe across the breakpoint. No bespoke popup
 * markup here (contract test pins this).
 *
 * Read semantics (user ruling 2026-11-15): opening the panel IS the
 * read receipt — the dot answers "did I miss anything", not "is
 * something on screen". Records are REPLAY-FREE except a snoozed
 * emergency alert, whose entry carries the real unsnooze path
 * (`onResummon`, wired by useEmergencyAlert); the button reuses the
 * emergency family's own "Show again" copy.
 *
 * Per-row copy (user direction 2026-11-19): rows whose tone the toast
 * family already deems copyable by default (error/warning —
 * useToast's `defaultCopyable`) carry the toast's own copy icon
 * button (same HkIconButton shape, same `hikari::toast.copy` label,
 * same useClipboard write) to the LEFT of dismiss, copying the full
 * untruncated record (title / code / detail, one per line) — the row
 * clips its text, so the clipboard is the only place the whole thing
 * still exists.
 *
 * Motion (user direction 2026-11-20): list rows pop in and out through
 * HkListTransition — the library's own list choreography primitive, which
 * reports every enter/leave batch to the runtime animation context
 * (reportTransition on the frame bus) and collapses under reduced motion /
 * the global CSS-animation switch. `pop` keeps the toast family's
 * fade+scale signature; `move` lets siblings FLIP-glide into the freed
 * space. No bespoke row transition lives here (contract test pins this).
 * The list wrap stays mounted across the empty swap for the same reason —
 * a torn-down TransitionGroup cancels its ghosts mid-flight.
 *
 * Renders nothing extra while the journal is empty beyond the bell
 * itself — an empty notification center still shows its (disabled-
 * looking) trigger so the host chrome never reflows on first use.
 */
import {
  CircleCheck as CheckCircle,
  Copy,
  Info,
  LoaderCircle,
  RotateCcw,
  Trash2,
  TriangleAlert as AlertTriangle,
  X,
} from "lucide-vue-next";
import { computed, defineComponent, h, nextTick, onUnmounted, ref, watch, type Component } from "vue";

import { useChromeActionSize } from "../composables/useChromeActionSize";
import {
  attachOverlayScrollbars,
  type OverlayScrollbarHandle,
} from "../composables/useOverlayScrollbar";
import { activeLocale, useI18n } from "../i18n/context";
import {
  useNotificationCenter,
  type HkNotificationEntry,
  type HkNotificationTone,
} from "../runtime/notificationCenter";
import { useClipboard } from "../runtime/useClipboard";
import HkIconButton from "./HkIconButton";
import HkButton from "./HkButton";
import HkListTransition from "./HkListTransition";
import HkPopover from "./HkPopover";
import "./HkNotificationBell.scss";

/** Tone glyph — the same lucide family HkToast draws, at row size. */
const TONE_ICONS: Record<HkNotificationTone, Component> = {
  error: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
  loading: LoaderCircle,
};

/** The toast family's own copyable-by-default set (useToast
 *  `defaultCopyable`): error and warning records get the per-row copy
 *  button, the other tones mirror their non-copyable surfaces. */
function rowCopyable(entry: HkNotificationEntry): boolean {
  return entry.tone === "error" || entry.tone === "warning";
}

/** `HH:mm` today, `MM-dd HH:mm` otherwise — Intl does the locale work
 *  (the journal stores epoch ms; formatting is a view concern). */
function formatRowTime(ts: number, locale: string): string {
  const date = new Date(ts);
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    locale,
    sameDay
      ? { hour: "2-digit", minute: "2-digit" }
      : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  ).format(date);
}

export default defineComponent({
  name: "HkNotificationBell",
  setup() {
    const { t } = useI18n();
    const { entries, forget, markAllRead, reset } = useNotificationCenter();
    const chromeSize = useChromeActionSize();
    const clipboard = useClipboard();
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);
    // The list is the popup's ONE scroll surface on the desktop flyout —
    // it carries the native-suppression pair, so WITHOUT the overlay
    // engine it scrolls invisibly (user report 2026-11-19). HkPopover
    // attaches its own engine only in sheet mode ("desktop popovers size
    // to content"), which is why the bell owns this one. Same shape as
    // HkDrawer: a wrapper that wraps EXACTLY the viewport is the track
    // host, attach on open, detach on close/unmount.
    // The ul itself is rendered BY HkListTransition (the row enter/exit
    // choreography, motion section below), so the viewport element is
    // resolved off the component instance's $el instead of a direct ref.
    const listHostRef = ref<{ $el?: Element } | null>(null);
    const listWrapRef = ref<HTMLDivElement | null>(null);
    let listScrollbar: OverlayScrollbarHandle | null = null;
    function detachListScrollbar() {
      listScrollbar?.detach();
      listScrollbar = null;
    }
    /** One sync point for the list's overlay chrome: attach when the
     *  viewport exists under an open panel, detach when it does not,
     *  update when only the content moved. Re-checks `open` INSIDE the
     *  nextTick so a same-flush open→close cannot attach onto a panel
     *  that is already on its way out (round-2 flap note). The sheet
     *  branch never scrolls the list (overflow: visible — the engine
     *  self-hides when content fits), so one unconditional path serves
     *  both modalities. */
    function syncListScrollbar() {
      nextTick(() => {
        const listEl = listHostRef.value?.$el as HTMLUListElement | undefined;
        if (!open.value || !listEl) {
          detachListScrollbar();
          return;
        }
        if (!listScrollbar) {
          listScrollbar = attachOverlayScrollbars(listEl, {
            axis: "vertical",
            host: listWrapRef.value ?? undefined,
          });
        } else {
          listScrollbar.update();
        }
      });
    }

    const unread = computed(() => entries.filter((e) => !e.read).length);
    const sorted = computed(() =>
      // Newest first; ties fall back to the journal's own append order
      // (newest INSERTION above). A string-id tiebreak would flip across
      // digit widths ("9" sorts above "10") — the R8 pin test caught
      // exactly that, so the ledger's insertion order is the judge.
      [...entries].sort(
        (a, b) => b.updatedAt - a.updatedAt || entries.indexOf(b) - entries.indexOf(a),
      ),
    );
    // Content consolidation (user direction 2026-11-19) lives in the VIEW,
    // deliberately not in the journal: ids are the key every lifecycle op
    // speaks (a source's own re-record, setNotificationState, forget), and
    // a record-time merge would discard the incoming id — a folded source's
    // re-records then count as recurrences forever and its state/forget
    // calls no-op (the round-1 review's S1, proven by probe). Grouping the
    // sorted rows keeps the journal 1:1 with its sources while the reader
    // sees ONE row per distinct message with a tally badge. Newest member
    // is the group's face (time/state/actions); the tally is the member
    // count; dismiss forgets every DISMISSABLE member of the group.
    interface HkNotificationGroup {
      /** Stable content key — the row's vue key, so a new member joining
       *  (or the face changing) does not remount the row under the cursor. */
      key: string;
      members: HkNotificationEntry[];
      head: HkNotificationEntry;
    }
    const groups = computed<HkNotificationGroup[]>(() => {
      const out: HkNotificationGroup[] = [];
      const byKey = new Map<string, HkNotificationGroup>();
      for (const e of sorted.value) {
        const key = `${e.tone}\u0000${e.title}\u0000${e.code ?? ""}\u0000${e.detail ?? ""}`;
        const hit = byKey.get(key);
        if (hit) {
          hit.members.push(e);
        } else {
          const group: HkNotificationGroup = { key, members: [e], head: e };
          byKey.set(key, group);
          out.push(group);
        }
      }
      return out;
    });
    // A signature of everything the rendered rows depend on — drives the
    // scrollbar sync (rows appearing/vanishing/changing height all move
    // scrollHeight, which the engine's box ResizeObserver cannot see).
    const rowSignature = computed(() =>
      groups.value
        .map((g) =>
          g.members
            .map((m) => `${m.id}:${m.updatedAt}:${m.state}:${m.read ? 1 : 0}`)
            .join("+"),
        )
        .join("|"),
    );

    // Open = read receipt. Watching the flag (not wiring it into the
    // toggle) keeps the receipt honest for sheet-scrim closes too.
    watch(open, (v) => {
      if (v) markAllRead();
      syncListScrollbar();
    });
    // Rows mount/unmount/change while open too (empty↔list swaps, new
    // records, tallies) — every such transition moves scrollHeight, which
    // the engine's box ResizeObserver cannot see.
    watch(rowSignature, () => syncListScrollbar());
    onUnmounted(detachListScrollbar);

    /** The toast's copy affordance, carried over: same clipboard write
     *  path (useClipboard), but the payload is the journal's own shape —
     *  the FULL untruncated record, one field per line (title / code /
     *  detail — whatever the entry carries). The row itself ellipsizes,
     *  so the clipboard is the only complete copy of what was shown. */
    function copyEntry(entry: HkNotificationEntry) {
      const parts = [entry.title];
      if (entry.code) parts.push(entry.code);
      if (entry.detail) parts.push(entry.detail);
      void clipboard.copy(parts.join("\n"));
    }

    function renderRow(group: HkNotificationGroup) {
      // The NEWEST member is the group's face — time, code/detail and the
      // tone all answer "what happened most recently".
      const entry = group.head;
      const Icon = TONE_ICONS[entry.tone] ?? Info;
      // The actions lane is MEMBER-SCANNED, not head-only (round-3 S2,
      // proven by probe): a same-content toast joining a snoozed
      // emergency's group becomes the face, and a head-only read would
      // hide the emergency's ONLY restore affordance while the journal
      // still holds it — exactly the loss the record-time merge was
      // rejected for, at the view layer instead.
      const isLive = group.members.some(
        (m) => m.kind === "emergency" && m.state !== "cleared",
      );
      // ALL restorable members, not just the first (final-residual fix):
      // two identical-content episodes are two episodes, each with its
      // own live callback — a `find` surfaced one Restore and stranded
      // the other's only handle.
      const restorables = group.members.filter(
        (m) => m.onResummon !== undefined && m.state === "snoozed",
      );
      // State chip: the head's own state wins; otherwise any member's
      // Hidden/Resolved state still deserves its chip.
      const chip =
        entry.state === "snoozed" || entry.state === "cleared"
          ? entry
          : group.members.find((m) => m.state === "snoozed" || m.state === "cleared");
      const tally = group.members.length;
      return (
        <li key={group.key} class={["hk-notification-row", `is-${entry.tone}`, `is-${entry.state}`]}>
          {/* The row glyph renders through h(Icon, …): Vue's Component
              union is not a valid JSX element type, so `<Icon />` is
              not available here — both this tone glyph and the row
              actions' RotateCcw go through the render function. */}
          <span class="hk-notification-row__icon-box">
            <span class="hk-notification-row__icon" aria-hidden="true">
              {h(Icon, { size: 14 })}
            </span>
            {tally > 1 && (
              // The consolidation tally (user direction 2026-11-19): a
              // corner badge on the tone glyph. It sits OUTSIDE the
              // glyph's aria-hidden box (round-2 a11y note) as real text —
              // screen readers hear the number — and keeps pointer events
              // so the hover naming works.
              <span
                class="hk-notification-row__icon-count"
                title={`${tally} ${t("hikari::toast.msgs", "msgs")}`}
              >
                {/* The visible cap is sighted-user shorthand; AT gets the
                    full pair as real text (final-residual fix: `aria-label`
                    on a role-less span is not a reliable accessible name —
                    generic role cannot be named from author). */}
                <span aria-hidden="true">{tally > 99 ? "99+" : tally}</span>
                <span class="hk-notification-row__sr-only">{`${tally} ${t("hikari::toast.msgs", "msgs")}`}</span>
              </span>
            )}
          </span>
          <div class="hk-notification-row__body">
            <div class="hk-notification-row__top">
              <span class="hk-notification-row__title" title={entry.title}>
                {entry.title}
              </span>
              {/* The state word is a flex:none SIBLING of the clipping
                  title (round-2 review: inside the span, ellipsis ate it
                  first for exactly the long titles where it matters). */}
              {chip && (
                <span class="hk-notification-row__title-state">
                  {"· "}
                  {t(
                    chip.state === "snoozed"
                      ? "hikari::notificationCenter.stateHidden"
                      : "hikari::notificationCenter.stateResolved",
                    chip.state === "snoozed" ? "Hidden" : "Resolved",
                  )}
                </span>
              )}
              <time
                class="hk-notification-row__time"
                datetime={new Date(entry.updatedAt).toISOString()}
              >
                {formatRowTime(entry.updatedAt, activeLocale())}
              </time>
            </div>
            {(entry.detail || entry.code) && (
              <p class="hk-notification-row__detail">
                {entry.code && <code class="hk-notification-row__code">{entry.code}</code>}
                {entry.detail && <span class="hk-notification-row__detail-text">{entry.detail}</span>}
              </p>
            )}
          </div>
          <div class="hk-notification-row__actions">
            {/* Copy (toast-family tones, left of dismiss per user
                direction 2026-11-19) → dismiss → restore. Dismiss is
                gated OFF for live emergency episodes (round-6 S1: a
                snoozed alert's entry carries the ONLY restore handle).
                Restore is gated ON only for snoozed entries. */}
            {rowCopyable(entry) && (
              <HkIconButton
                size={24}
                variant="ghost"
                aria-label={t("hikari::toast.copy", "Copy")}
                {...{ title: t("hikari::toast.copy", "Copy") }}
                onClick={() => copyEntry(entry)}
              >
                {{ icon: () => <Copy size={14} /> }}
              </HkIconButton>
            )}
            {!isLive && (
              <HkIconButton
                size={24}
                variant="ghost"
                aria-label={t("hikari::notificationCenter.dismiss", "Dismiss")}
                onClick={() => {
                  // X on a consolidated row dismisses the WHOLE line —
                  // every member whose surface allows dismissal (a live
                  // emergency episode is never user-dismissable).
                  for (const m of group.members) {
                    if (!(m.kind === "emergency" && m.state !== "cleared")) {
                      forget(m.id);
                    }
                  }
                }}
              >
                {{ icon: () => <X size={14} /> }}
              </HkIconButton>
            )}
            {restorables.map((m) => (
              <HkIconButton
                key={`restore-${m.id}`}
                size={24}
                variant="ghost"
                aria-label={t("hikari::emergencyAlert.restore", "Show again")}
                onClick={() => m.onResummon?.()}
              >
                {{ icon: () => h(RotateCcw, { size: 14 }) }}
              </HkIconButton>
            ))}
          </div>
        </li>
      );
    }

    return () => {
      const label = t("hikari::notificationCenter.title", "Notifications");
      return (
        <span ref={anchorRef} class="hk-notification-bell">
          <HkIconButton
            icon="bell"
            size={chromeSize.value}
            variant="ghost"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open.value ? "true" : "false"}
            dot={unread.value > 0}
            dotVariant="primary"
            dotLabel={
              unread.value > 0
                ? t("hikari::notificationCenter.unread", "Unread notifications")
                : undefined
            }
            onClick={() => {
              open.value = !open.value;
            }}
          />
          <HkPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => (open.value = v)}
            anchorRef={anchorRef.value}
            placement="bottom-end"
            offset={6}
            sheetOnMobile
            title={label}
          >
            <div class="hk-notification-center">
              {/* The list wrap stays MOUNTED while the panel is open — the
                  empty caption lives inside it, beside the (row-less) list.
                  Tearing the TransitionGroup down on the empty swap would
                  cancel the leave choreography mid-flight (Vue runs child
                  leave transitions only while the group itself stays
                  mounted), so "Clear all" and a last-row dismiss would snap
                  instead of fading. The foot keeps its empty-hides rule. */}
              <div class="hk-notification-center__list-wrap" ref={listWrapRef}>
                <HkListTransition
                  tag="ul"
                  variant="pop"
                  move
                  class="hk-notification-center__list"
                  {...{ role: "list" }}
                  ref={listHostRef}
                >
                  {groups.value.map(renderRow)}
                </HkListTransition>
                {groups.value.length === 0 && (
                  <p class="hk-notification-center__empty">
                    {t("hikari::notificationCenter.empty", "No notifications yet")}
                  </p>
                )}
              </div>
              {groups.value.length > 0 && (
                <div class="hk-notification-center__foot">
                  {/* The wipe glyph reads before the label is parsed —
                      a destructive affordance announced by its icon
                      (user direction 2026-11-19), from the same lucide
                      family the row glyphs already speak. */}
                  <HkButton variant="ghost" size="sm" icon="Trash2" onClick={() => reset()}>
                    {t("hikari::notificationCenter.clearAll", "Clear all")}
                  </HkButton>
                </div>
              )}
            </div>
          </HkPopover>
        </span>
      );
    };
  },
});
