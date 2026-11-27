# Page Chrome: The Action-Bar Grammar

Admin and console pages share ONE header contract: the page owns the top-right
action cluster through declared-purpose slots, and the cluster — not the page
body — is where its primary affordances live.

## The canonical slots

Every registration declares a PURPOSE; the cluster renders canonical slots by
rank, regardless of the order the views register them in:

```text
[create][filter][search][refresh][window]
```

Registrations whose purpose is not one of the canonical slots are customs:
they render AFTER the enum zone, stuffed right-to-left in reverse registration
order, so the canonical zone never moves.

## The create rule

A page's primary create action — the affordance that creates a new top-level
entity (a provider, a channel, a group, an access rule, a theme on the shared
line) — is a **plus icon button in the top-right cluster, left of refresh**.
It is never a standalone button inside the page body.

The visible label an in-body button would have carried becomes the button's
accessible name and tooltip; the page keeps owning its own create dialog.

**In-context adds are exempt.** A plus that adds a row to a sub-list inside an
editor, dialog, wizard, or card ("add a model row", "add a member", "add a
mount scheme") is part of that local grammar, not the page's create action,
and stays where it is.

## Geometry

The cluster is one row of chrome: every icon button steps the same size ladder
(`useChromeActionSize`), with 16 px glyphs. A flat fixed-size button beside
ladder-sized neighbors reads as a different button family — compose the
cluster from the shared helpers, never hand-pinned sizes.

## Reference implementation

hikari supplies the chrome: `HkAdminHeader`'s action row, `HkIconButton`, and
`useChromeActionSize`. Hosts register through the `provideActionBar` /
`useActionBar` composable pair, which renders the slots above; it is the
reference implementation of this grammar.

## Mobile collapse

A button group anchored to the header's center slot or the footer's
center slot collapses on phone-width viewports (<768,
`useBreakpoint().isMobile` — the sheet family's threshold): the strip
becomes a select-style trigger naming the ACTIVE item, and its options
open as a bottom sheet (`HkSelectPanel` with `sheetOnMobile`). One
value contract drives both forms, so `?tab=` deep links survive the
breakpoint. `HkAdaptiveTabs` is the default implementation; dynamic
project-list switchers with bespoke rows (the platform switcher) are
the exempt special case, not the pattern to copy.

## Picker sheets and the pinned search

A dropdown surface (`HkSelectPanel`, under `HkSelect` / `HkMenu` / the chip
pickers) has two content bands, and which band a thing belongs in is not
negotiable:

- **`default` scrolls.** Rows, cards, catalogs — anything that can outgrow
  the surface.
- **`pinnedHeader` does not.** Chrome that must stay reachable while the
  list scrolls: a live-filter search field, first of all. It renders
  outside the scroll region on both form factors — a band under the
  sheet's title row on the phone, the head of the popout column on the
  desktop (whose body then hosts the single scrollbar). A search field
  inside the scrolling content scrolls away with the first swipe and is a
  defect, not a style choice (2026-11-27).

Phone sheets of the picker/menu family hug their content up to **80% of the
viewport**; longer content scrolls inside. A cap tuned for the desktop popout
(`maxHeight`, e.g. `min(18rem, 45dvh)`) never reaches the sheet. The sheet
also stops scroll chaining: a swipe on the grabber, the title row or the
pinned band never drags the page behind it.

## List motion

Whenever list items change — added, removed, re-ranked — the move runs
through hikari's `HkListTransition` (a keyed `TransitionGroup` whose FLIP is
reported to the runtime animation bus), never a hand-rolled tween. One
default for every list-shaped surface (rows, cards, waterfalls): the move
track is 0.3s, enter and leave are 0.15s each and start at the same time as
the move. A host customizes with the `duration` / `enterDuration` /
`leaveDuration` props (CSS times; a lone `duration` derives the halves).
`surface` is the one exception (rows that are windows keep the window
family's entrance/exit timings).

Two standing rules for hosts: a list that lives directly inside a scroll viewport keeps `move` off (the leave ghost is pinned against the nearest positioned ancestor, which in a scrollport is not the visual list box), and a list row never carries `transition: all` — the primitive's tracks take over the row's `transition` for the length of one choreography, and an `all` track would lose its hover face in that window.

A multi picker (`HkAffixPicker` in `multi` mode, `layout="rows"`) builds
nothing in front of the search for its selection: the checked rows wear the
leading check mark and float to the top in catalog order behind a divider; a
tap toggles the row and it glides to or from its slot. `layout="tags"` is the
value-editor shape (a typed value shown per entry) and keeps the tag list
above the search.

## Footer corner text

Text in any of the six header/footer corners (left/center/right ×2) rides
hikari's `HkCornerText`: one instance = one text lane for one corner.

- `align` sets the corner: `start` (left corners) / `center` (the middle
  lane) / `end` (right corners); wrapped rows keep hugging that edge — a
  right-corner lane that wraps stays right-aligned.
- Entries are `nowrap` atoms: the lane wraps BETWEEN entries, never inside
  one (a filing number must not break mid-sequence).
- Default is muted chrome ink (`text-2xs` + 0.6 opacity); `muted: false`
  restores full ink.
- Several rows in one corner (identity line above the filings line) stack
  instances vertically — the fixed 3rem status band holds two text-2xs
  rows.
- An `items` entry is `{ key, text, href? }`: `key` is the stable identity the
  list renderer keys on, `text` is the display string (a filing number, a
  system name, …), and `href` is optional — omit it and the entry renders as a
  plain `<span>`; set it and it renders as a link.
- Entry with `href` always opens in a new tab: `target="_blank"` plus
  `rel="noopener noreferrer"` (the same contract as the filing number — a
  third-party site must never hold a handle on the login page's window). That
  is the component's own behaviour: hosts must not wrap entries in their own
  `<a>`.
- Link entries use `items` + `as="nav"` + `ariaLabel`;
  free-form content (a status chip) rides the default slot, after `items`.

Hosts must not hand-roll `flex-wrap: nowrap` squeeze lanes or let text
paint outside a fixed-height band. Reference implementation: `HkCornerText`.
