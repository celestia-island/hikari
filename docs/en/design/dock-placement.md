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
spacer exactly as tall as the **measured dock occupancy**, and sticks to the
visible bottom edge (`position: sticky; bottom: 0`):

- short content — the dock trails the content end, the air above it is the
  measured dock occupancy, and the leftover window height falls BELOW the dock;
- long content — the dock stays on the visible bottom edge (on the vertical
  axis it never scrolls away; on a two-axis board it also stays anchored to
  the inline start instead of travelling with the content), and the same air
  opens up at the scroll end.

"The dock occupancy" is the box the container measures and publishes as
`--hk-scroll-dock-bottom` — the dock's own placeholder, and not necessarily its
visible surface: space the host puts INSIDE that band (a dock inset, a row's
trailing padding) adds on top, so the air matches the dock within the host's
own padding. Hosts read the published value instead of hand-rolling a spacer
recipe or a magic pixel value, and the air follows every dock reflow (a row
changing, a breakpoint switch).

A ride host must also let its content end ABOVE the viewport bottom: a content
box that inflates itself to the viewport height (`min-height: 100%`) keeps the
in-flow spacer and dock below the fold, so the dock can only hug the edge and
the air reverts to the window's leftover. `HkKanban` releases its own lanes box
on a ride board; a custom host does the same.

`autoFollow` is not supported together with a ride dock, for the same
reason: it bottom-anchors a full-height content box, so the ride tail
falls below the fold. The container warns once per container instance in
dev builds when both are on.

While pinned, the ride wrapper and its spacer are `pointer-events: none`;
a part of the slot content that must catch events (the dock's own
controls) has to declare `pointer-events: auto` itself.

## Ride is not a frame-level reservation

Ride is **not** the retired recipe that reserved `dock height + breathing room` on the
viewport with an `::after` for a dock floating over the scroll area from outside the flow —
and it is not "reserve a second dock of blank space" either. That band was dead air *before*
the scroll end, and the dock never followed the content. A ride dock's own box is the in-flow
child: nothing is pre-reserved for something painted elsewhere, and the sticky box is what
makes the air track the content instead of the window.

## Choosing

| Host | Placement |
|---|---|
| Scrolling region, chrome belongs to the content | `dockMode="ride"` |
| Scrolling region, chrome owns the region's frame | `dockMode="pin"` |
| Canvas / page overlay, no scroll region owns it | `HkDockBar` |

`ride` exists on the vertical tail only: `axis="horizontal"` containers keep
the `pin` placement, because their tail is the cross axis.
