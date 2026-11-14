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
 * Renders nothing extra while the journal is empty beyond the bell
 * itself — an empty notification center still shows its (disabled-
 * looking) trigger so the host chrome never reflows on first use.
 */
import { CircleCheck as CheckCircle, Info, LoaderCircle, TriangleAlert as AlertTriangle } from "lucide-vue-next";
import { computed, defineComponent, h, ref, watch, type Component } from "vue";

import { useChromeActionSize } from "../composables/useChromeActionSize";
import { activeLocale, useI18n } from "../i18n/context";
import {
  useNotificationCenter,
  type HkNotificationEntry,
  type HkNotificationTone,
} from "../runtime/notificationCenter";
import HIconButton from "./HkIconButton";
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
    const { t, locale } = useI18n();
    const { entries, markAllRead, reset } = useNotificationCenter();
    const chromeSize = useChromeActionSize();
    const open = ref(false);
    const anchorRef = ref<HTMLElement | null>(null);

    const unread = computed(() => entries.filter((e) => !e.read).length);
    const sorted = computed(() =>
      // Newest first; the id tiebreak keeps same-millisecond pushes
      // deterministic (R2 note, PR #1322 — a burst must not render
      // older-first just because the clock tied).
      [...entries].sort(
        (a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      ),
    );

    // Open = read receipt. Watching the flag (not wiring it into the
    // toggle) keeps the receipt honest for sheet-scrim closes too.
    watch(open, (v) => {
      if (v) markAllRead();
    });

    function renderRow(entry: HkNotificationEntry) {
      const Icon = TONE_ICONS[entry.tone] ?? Info;
      // A restore button exists ONLY for a SNOOZED entry with a live
      // path (R2 finding, PR #1322): the callback may briefly survive
      // a restore (the source re-arms/clears it), but an on-screen
      // band is not something "Show again" can bring back — the state
      // gate keeps a dead control off the row.
      const resummonable = entry.onResummon !== undefined && entry.state === "snoozed";
      return (
        <li key={entry.id} class={["hk-notification-row", `is-${entry.tone}`, `is-${entry.state}`]}>
          <span class="hk-notification-row__icon" aria-hidden="true">
            {/* Render via h(): Vue's `Component` union includes non-callable
                option types, so `<Icon />` is not a valid JSX element type
                (the HkNavSidebar convention). */}
            {h(Icon, { size: 14 })}
          </span>
          <div class="hk-notification-row__body">
            <div class="hk-notification-row__top">
              <span class="hk-notification-row__title" title={entry.title}>
                {entry.title}
              </span>
              <time
                class="hk-notification-row__time"
                datetime={new Date(entry.updatedAt).toISOString()}
              >
                {formatRowTime(entry.updatedAt, activeLocale() || locale)}
              </time>
            </div>
            {(entry.detail || entry.code) && (
              <p class="hk-notification-row__detail">
                {entry.code && <code class="hk-notification-row__code">{entry.code}</code>}
                {entry.detail && <span class="hk-notification-row__detail-text">{entry.detail}</span>}
              </p>
            )}
            {(entry.state === "snoozed" || entry.state === "cleared") && (
              <div class="hk-notification-row__meta">
                {entry.state === "snoozed" && (
                  <span class="hk-notification-row__state">
                    {t("hikari::notificationCenter.stateHidden", "Hidden")}
                  </span>
                )}
                {entry.state === "cleared" && (
                  <span class="hk-notification-row__state">
                    {t("hikari::notificationCenter.stateResolved", "Resolved")}
                  </span>
                )}
                {resummonable && (
                  <button
                    type="button"
                    class="hk-notification-row__restore"
                    onClick={() => entry.onResummon?.()}
                  >
                    {t("hikari::emergencyAlert.restore", "Show again")}
                  </button>
                )}
              </div>
            )}
          </div>
        </li>
      );
    }

    return () => {
      const label = t("hikari::notificationCenter.title", "Notifications");
      return (
        <span ref={anchorRef} class="hk-notification-bell">
          <HIconButton
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
              {sorted.value.length === 0 ? (
                <p class="hk-notification-center__empty">
                  {t("hikari::notificationCenter.empty", "No notifications yet")}
                </p>
              ) : (
                <>
                  <ul class="hk-notification-center__list" role="list">
                    {sorted.value.map(renderRow)}
                  </ul>
                  <div class="hk-notification-center__foot">
                    <button
                      type="button"
                      class="hk-notification-center__clear"
                      onClick={() => reset()}
                    >
                      {t("hikari::notificationCenter.clearAll", "Clear all")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </HkPopover>
        </span>
      );
    };
  },
});
