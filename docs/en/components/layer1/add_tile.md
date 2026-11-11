# Add Tile

HkAddTile is the standard dashed affordance tile: a list's empty state,
the "add one more" row at the end of a list, and the pick-a-file /
drop-files zone. One anatomy, three blessed forms.

## Basic Usage

```hikari:tsx
<HkAddTile onClick={openAdd}>No sources yet — add one to begin</HkAddTile>
```

The Vue runtime ships first; the Rust mirror follows when a Rust host
consumes the tile.

## Forms

- default — centered vertical block (icon above the label): the empty
  state of a list or panel.
- `compact` — slim left-aligned row ("＋ add one more") that rides the
  END of a row list instead of a loose button under it.
- `droppable` — either form additionally accepts file drags. The
  drag-over state reuses the drag-overlay language (dashed primary on a
  faint primary floor). A drop fires `drop-files` only when it carries
  at least one file — text and URL drags are ignored, so hosts can rely
  on the payload.

## API

| Property | Description | Type | Default |
|----------|-------------|------|---------|
| disabled | Disables the click and refuses drags | boolean | false |
| droppable | Accepts file drags (non-empty drops only) | boolean | false |
| compact | Slim list-end row form | boolean | false |
| icon | Icon component (lucide-vue-next style) | Component | Plus |

| Slot | Description |
|------|-------------|
| default | Label text |
| icon | Overrides the default glyph |

| Event | Description |
|-------|-------------|
| click | Tile activated (native MouseEvent) |
| drop-files | A drop carrying ≥1 file — `(files: File[], event: DragEvent)` |
