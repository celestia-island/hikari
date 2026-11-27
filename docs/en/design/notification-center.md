# Notification Center: The Dismissal Grammar

Dismissing a notification must never mean losing it. Every dismissing
surface — the corner toast stack, the flow-blocking gates, the
full-screen emergency band, a host's persistent chips — records what it
showed in the notification-center journal, and a bell re-summons the
list wherever the host mounts it.

## What journals

By default (user ruling 2026-11-15), the tones worth a second look:

- error and warning toasts; settled blocking gates; every emergency
  alert episode (active, snoozed, and cleared — resolved conditions
  stay reviewable); persistent chips a host records explicitly.
- success / info / loading toasts opt in per push with `journal: true`,
  because journaling every 3-second "Saved." buries the list in noise.

## Retention and replay

The journal is session-scoped: sessionStorage survives reloads and dies
with the browser session, on top of a 100-entry ring (oldest dropped by
last update). A record is a RECORD — a toast's action button is a
caller closure and is never re-fired from the list. The one reversible
case is a snoozed emergency alert, whose entry carries the real unsnooze
path ("Show again" brings the band back).

## The read rule

Opening the panel IS the read receipt. The bell's own dot (the icon
button's built-in mark, not a wrapper badge) answers "did I miss
anything", not "is something on screen right now".

## Placement

Placement is downstream-owned — hikari owns the storage grammar and the
components. The reference placement for admin/console faces: a bell
icon button in the top-right action cluster, **left of the settings
gear** (the chest webui's HeaderEndCluster), so desktop shells with
extra window controls keep them untouched at the far right. It is never
a page-body button, and it is never registered through a page-scoped
action slot (page chrome unmounts with the page; the bell is global).

The trigger is `HkIconButton` on the chrome size ladder; the surface is
`HkPopover` with `sheetOnMobile` — an anchored flyout on wide screens,
a bottom sheet on phones, safe to cross the breakpoint live.

**Layering** (user direction 2026-11-17): a host whose header IS the window
caption band (the chrome band) mounts the bell with
`<HkNotificationBell aboveChrome={isNative()} />` — the panel then paints
in the above-titlebar layer (`#hk-top-root` / `--hk-z-top-layer`, see
design/layer1 §8.2). The titlebar stays the PAGE's top owner (a modal veil
never dims it), but the well its own bell opens must stay visible over the
row it hangs from instead of being buried under it.

## Motion

Row add and remove are choreographed by `HkListTransition` — the
library's own list primitive, the one the modal breadcrumbs, the tag
input, the password surface, the affix picker and the waterfall
already ride — in its `pop` variant (a fade that settles from
a slight scale) with FLIP moves, so the rows that remain glide into the
space a dismissed one frees. Two properties come from the primitive and
the platform rather than from the bell: it REPORTS every enter/leave
batch to the runtime animation context (`runtime/animationBus.ts`, so
JS peers know a transition is in flight), and its own reduced-motion
rules together with the global CSS-animation switch
(`html[data-css-animations="0"]`) collapse the motion.

Three consequences worth checking:

- Opening the panel does NOT replay the list's entrance (`appear` stays
  off) — only rows that really arrive or leave animate.
- The list wrapper outlives the empty swap: a row-less journal keeps the
  list mounted, because tearing a transition group down cancels its
  leaving ghosts mid-flight.
- The empty handover takes two beats: while the last row (or "Clear
  all") fades, the list keeps its last height — a leaving row is
  positioned INSIDE the scroll container, so a shrinking list would crop
  its own ghost (true for the bottom-most row of ANY removal, not just
  the emptying one) — and the "No notifications yet" caption only mounts
  after the leave window. A host that collapses motion (the
  `prefers-reduced-motion` query, the animation bus' park flag, or
  `html[data-css-animations="0"]`) skips the hold entirely and gets the
  caption at once.

## Reference implementation

`runtime/notificationCenter.ts` (the journal and its source hooks) and
`components/HkNotificationBell.tsx` (bell + panel in one composition).
Sources write through `recordNotification` / `setNotificationState`;
hosts mount `<HkNotificationBell />` and decide where it lives.

Host-recorded ids share one flat string space: the `toast:` / `blocking:` / `emergency:` prefixes are reserved by the built-in mirrors — hosts recording persistent chips or custom items pick their own prefix (e.g. `myapp:`) so a custom id can never hijack a built-in episode.

## The emergency carve-out

Emergency rows are the one exception: while an episode is LIVE
(active or snoozed) the row carries no dismiss control — its journal
entry holds the ONLY restore handle for the alert, and a polled
re-raise would resurrect a deleted row. A user dismiss therefore
applies to records (toasts, gates) and to resolved emergencies once
their episode has cleared; never to a live episode.
