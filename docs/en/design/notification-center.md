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

## Reference implementation

`runtime/notificationCenter.ts` (the journal and its source hooks) and
`components/HkNotificationBell.tsx` (bell + panel in one composition).
Sources write through `recordNotification` / `setNotificationState`;
hosts mount `<HkNotificationBell />` and decide where it lives.

Host-recorded ids share one flat string space: the `toast:` / `blocking:` / `emergency:` prefixes are reserved by the built-in mirrors — hosts recording persistent chips or custom items pick their own prefix (e.g. `myapp:`) so a custom id can never hijack a built-in episode.
