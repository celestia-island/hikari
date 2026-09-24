# Package Architecture: hikari-components

Hikari's component system lives in a single package, `hikari-components`: the `rsx!`
render components with their reactive hooks, typed palette classes and
`StyledComponent` CSS.

> **Retired: `hikari-extra-components`.** The package used to ship framework-agnostic
> *data models* (`TimelineState`, `ZoomControlsState`, `GuideStep`, the node-graph
> model, …) beside the render components, which meant two same-named types for the
> same concept — e.g. `TimelinePosition` defaulted to `Left` in one package and to
> `Alternate` in the other. Nothing in the workspace depended on it and the node-graph
> model was referenced only by its own tests, so the package was removed. The
> components it shadowed all remain here: `display::{Timeline, DragLayer, UserGuide,
> ZoomControls}`, `production::{VideoPlayer, RichTextEditor, CodeHighlight}`.
