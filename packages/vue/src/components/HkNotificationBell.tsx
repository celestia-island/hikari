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
import { computed, defineComponent, h, ref, watch, type Component } from "vue";

import { useChromeActionSize } from "../composables/useChromeActionSize";
import { activeLocale, useI18n } from "../i18n/context";
import {
  useNotificationCenter,
  type HkNotificationEntry,
  type HkNotificationTone,
} from "../runtime/notificationCenter";
import { useClipboard } from "../runtime/useClipboard";
import HkIconButton from "./HkIconButton";
import HkButton from "./HkButton";
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

    // Open = read receipt. Watching the flag (not wiring it into the
    // toggle) keeps the receipt honest for sheet-scrim closes too.
    watch(open, (v) => {
      if (v) markAllRead();
    });

    /** The toast's copy contract, carried over verbatim: the FULL
     *  untruncated record, one field per line (title / code / detail —
     *  whatever the entry carries). The row itself ellipsizes, so the
     *  clipboard is the only complete copy of what was shown. */
    function copyEntry(entry: HkNotificationEntry) {
      const parts = [entry.title];
      if (entry.code) parts.push(entry.code);
      if (entry.detail) parts.push(entry.detail);
      void clipboard.copy(parts.join("\n"));
    }

    function renderRow(entry: HkNotificationEntry) {
      const Icon = TONE_ICONS[entry.tone] ?? Info;
      const isLive = entry.kind === "emergency" && entry.state !== "cleared";
      const resummonable = entry.onResummon !== undefined && entry.state === "snoozed";
      return (
        <li key={entry.id} class={["hk-notification-row", `is-${entry.tone}`, `is-${entry.state}`]}>
          {/* The row glyph renders through h(Icon, …): Vue's Component
              union is not a valid JSX element type, so `<Icon />` is
              not available here — both this tone glyph and the row
              actions' RotateCcw go through the render function. */}
          <span class="hk-notification-row__icon" aria-hidden="true">
            {h(Icon, { size: 14 })}
          </span>
          <div class="hk-notification-row__body">
            <div class="hk-notification-row__top">
              <span class="hk-notification-row__title" title={entry.title}>
                {entry.title}
              </span>
              {/* The state word is a flex:none SIBLING of the clipping
                  title (round-2 review: inside the span, ellipsis ate it
                  first for exactly the long titles where it matters). */}
              {(entry.state === "snoozed" || entry.state === "cleared") && (
                <span class="hk-notification-row__title-state">
                  {"· "}
                  {t(
                    entry.state === "snoozed"
                      ? "hikari::notificationCenter.stateHidden"
                      : "hikari::notificationCenter.stateResolved",
                    entry.state === "snoozed" ? "Hidden" : "Resolved",
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
                onClick={() => forget(entry.id)}
              >
                {{ icon: () => <X size={14} /> }}
              </HkIconButton>
            )}
            {resummonable && (
              <HkIconButton
                size={24}
                variant="ghost"
                aria-label={t("hikari::emergencyAlert.restore", "Show again")}
                onClick={() => entry.onResummon?.()}
              >
                {{ icon: () => h(RotateCcw, { size: 14 }) }}
              </HkIconButton>
            )}
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
                    {/* The wipe glyph reads before the label is parsed —
                        a destructive affordance announced by its icon
                        (user direction 2026-11-19), from the same lucide
                        family the row glyphs already speak. */}
                    <HkButton variant="ghost" size="sm" icon="Trash2" onClick={() => reset()}>
                      {t("hikari::notificationCenter.clearAll", "Clear all")}
                    </HkButton>
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
