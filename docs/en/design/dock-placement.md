# Dock Placement: Pin or Ride

A dock is chrome that belongs to a region — a bottom bar under a board, a
step pager in a corner. Inside a scrolling region the dock mounts through a
`HkScrollContainer` slot (`dockBottom` / `dockTop`), and the container offers
two ways to place a bottom dock (`dockMode`).

## `pin` — the default

The dock is a NON-scrolling flex sibling of the scroll viewport: it stays on
the container's edge, never scrolls, and the viewport shrinks by its height.

Correct for chrome that owns the region's frame — a progress bar above a log,
a toolbar aligned with the panel's own edges.

The air between the content end and the dock is whatever the window leaves
over, so short content keeps a dead band of leftover window height between
the two.

## `ride`

The dock moves into the viewport's content flow, after the content, behind a
spacer exactly one **measured** dock height tall, and sticks to the visible
bottom edge (`position: sticky; bottom: 0`):

- short content — the dock trails the content end, the air above it is exactly
  one dock height, and the leftover window height falls BELOW the dock;
- long content — the dock stays on the visible bottom edge (it never scrolls
  away), and the same one-dock-height air opens up at the scroll end.

Use it for chrome that belongs to the CONTENT — a cruise canvas's bottom bar
standing under its last row. The container measures the dock and publishes
`--hk-scroll-dock-bottom`, so hosts never hand-roll a spacer recipe or a
magic pixel value, and the air follows every dock reflow (a row changing, a
breakpoint switch).

## Ride is not a frame-level reservation

Ride is **not** the retired recipe that reserved `dock height + breathing
room` on the viewport with an `::after` for a dock floating over the scroll
area from outside the flow. That band was dead air *before* the scroll end,
and the dock never followed the content. A ride dock's own box is the in-flow
child: nothing is pre-reserved for something painted elsewhere, and the
sticky box is what makes the air track the content instead of the window.

## Choosing

| Host | Placement |
|---|---|
| Scrolling region, chrome belongs to the content | `dockMode="ride"` |
| Scrolling region, chrome owns the region's frame | `dockMode="pin"` |
| Canvas / page overlay, no scroll region owns it | `HkDockBar` |

`ride` exists on the vertical tail only: `axis="horizontal"` containers keep
the `pin` placement, because their tail is the cross axis.
