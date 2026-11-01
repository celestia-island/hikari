// hi-components/src/data/treemap_stage.rs
// TreemapStage — mirror of the canonical Vue `HkTreemapStage`: the
// interactive treemap surface you can CLICK to zoom into.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTreemapStage.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-treemap-stage*` class name is literal
// and identical in both forms. The cells reuse `HkTreemap`'s pure layout and
// its `.hk-treemap__cell*` chrome verbatim — same family, no second renderer.
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-treemap-stage
//     header.hk-treemap-stage__head                     (drilled levels only)
//       nav.hk-treemap-stage__path[aria-label]
//         button.hk-treemap-stage__crumb[data-root]
//         span.hk-treemap-stage__crumb-seg*
//           span.hk-treemap-stage__crumb-sep[aria-hidden]
//           button.hk-treemap-stage__crumb[data-last][aria-current]
//     div.hk-treemap-stage__body
//       div.hk-treemap-stage__canvas[role=application][aria-label]
//         div.hk-treemap-stage__surface        (style: transform)
//           div.hk-treemap__cell[.hk-treemap__cell--group]
//               .hk-treemap-stage__cell[.hk-treemap-stage__cell--drillable]
//               [role=button][tabindex=0][aria-label][title]
//             span.hk-treemap__group-head        (group)
//             span.hk-treemap__leaf-body         (leaf, label ladder)
//             div.hk-treemap__cell.hk-treemap-stage__nested-cell*[data-depth]
//                                                 (non-interactive preview)
//         div.hk-treemap__empty                  (no data at all)
//       div.hk-treemap-stage__empty              (a drilled level went empty)
//       button.hk-treemap-stage__back-float[aria-label] (drilled levels only)
//
// The Vue stage paints DOM boxes too (no `<svg>`), so no
// `dangerous_inner_html` host appears here; the one glyph (the back chevron)
// rides the mirrored `Icon`, which owns its own inner-html host.
//
// The layout core is `data::treemap`'s (shared, pure); this file adds the
// stage's own pure geometry: the camera helpers, the drill-path resolution
// and the nested-preview flattening. Rendering only assembles nodes.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO MEASUREMENT API — Vue measures the canvas (`clientWidth/Height`);
//     the mirror takes the canvas box as the `width`/`height` props.
//   * CAMERA + DRILL PATH ARE CONTROLLED PROPS, not internal refs: Vue owns
//     `drillPath`/`zoom`/`pan` in `ref`s and emits only the zoom/collapse
//     protocols. The crate has no signal state (zero `use_signal`/`use_state`
//     in the mirrors), so the host owns the state and the component exposes
//     the activation edges: [`TreemapStageProps::on_drill`] (a group was
//     activated), [`TreemapStageProps::on_select`] (a leaf was activated) and
//     [`TreemapStageProps::on_pop`] (a breadcrumb/back asked for a path
//     truncation to that length). The pure helpers
//     ([`treemap_stage_resolve_drill`], [`treemap_stage_rescale_pan`],
//     [`treemap_stage_step_zoom`], [`treemap_stage_clamp_zoom`]) let a host
//     reproduce Vue's behaviour exactly — including the "a refresh that
//     removed a hop truncates the path and resets the camera" rule, which
//     becomes an explicit host decision instead of a watcher.
//   * NO `HkMinimap` / NO ZOOM BAR — that component is not mirrored in this
//     wave, and the wheel gesture needs `drawnScale`/pointer geometry the
//     crate does not own. `minimap_collapsed` therefore only drives the back
//     button's logical inset (`12 + (30|160) + 8`), so a host that mounts its
//     own control cluster in that corner gets Vue's exact placement; the zoom
//     rungs are exported as [`TREEMAP_STAGE_MIN_ZOOM`] /
//     [`TREEMAP_STAGE_MAX_ZOOM`] / [`TREEMAP_STAGE_STEP_ZOOM`].
//   * NO `HkTooltip` PER CELL — the mirrored `Tooltip` has no `style` prop and
//     its wrapper is `position:relative`, so it cannot be the absolute cell
//     frame. The cell carries that frame itself (canvas-local `left`/`top`/
//     `width`/`height` against `.hk-treemap-stage__surface`) and keeps the SAME
//     hint text in a native `title` next to its `aria-label`.
//   * `HkIconButton` + the lucide `ChevronLeft` become a plain `button` with
//     the sheet's own `.hk-treemap-stage__back-float` chrome and the mirrored
//     `Icon` glyph.
//   * NESTED PREVIEW keeps every threshold of the Vue ladder (120×90 to paint,
//     90×70 to recurse, depth ≤ 3, 2px minimum) and its flat-sibling
//     coordinates (every depth keeps the TOP-LEVEL group's origin); only the
//     `--hk-treemap-fg` ink and the ladder's zoom factor are re-derived here.
//   * I18N falls back to the same English strings Vue carries
//     (`hikari::treemap.drillPath` / `hikari::treemap.back`).
//
// Replaces nothing: the family had no stage treemap before this mirror.

use hikari_icons::{Icon, MdiIcon};

use crate::data::treemap::{
    TreemapCell, TreemapLayout, TreemapLayoutNode, TreemapNode, treemap_build_layout,
    treemap_cell_ladder, treemap_cell_text, treemap_contrast_text_color, treemap_format_percent,
    treemap_format_value, treemap_label_classes, treemap_layout_cells, treemap_px,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TreemapStageComponent;

// ── camera constants (Vue: MIN_ZOOM / MAX_ZOOM / STEP_ZOOM) ─────────────

pub const TREEMAP_STAGE_MIN_ZOOM: f64 = 50.0;
pub const TREEMAP_STAGE_MAX_ZOOM: f64 = 200.0;
pub const TREEMAP_STAGE_STEP_ZOOM: f64 = 10.0;

/// The default zoom rung (Vue: `internalZoom = ref(100)`).
pub const TREEMAP_STAGE_DEFAULT_ZOOM: f64 = 100.0;

/// The floating control cluster's own width: collapsed / expanded
/// (Vue: `minimapWidth = collapsed ? 30 : 160`).
pub const TREEMAP_STAGE_MINIMAP_COLLAPSED_PX: f64 = 30.0;
pub const TREEMAP_STAGE_MINIMAP_EXPANDED_PX: f64 = 160.0;

/// The corner: `12` from the edge, the cluster, then `8` of breathing room
/// (Vue: `12 + minimapWidth + 8`).
pub const TREEMAP_STAGE_BACK_INSET_BASE_PX: f64 = 12.0;
pub const TREEMAP_STAGE_BACK_INSET_GAP_PX: f64 = 8.0;

// ── nested preview constants (Vue: NESTED_*) ────────────────────────────

/// A group paints its inside only when it is at least this large on screen.
pub const TREEMAP_STAGE_NESTED_MIN_W: f64 = 120.0;
pub const TREEMAP_STAGE_NESTED_MIN_H: f64 = 90.0;

/// A nested cell recurses into its own children past this on-screen size.
pub const TREEMAP_STAGE_NESTED_RECURSE_W: f64 = 90.0;
pub const TREEMAP_STAGE_NESTED_RECURSE_H: f64 = 70.0;

/// The nested preview never paints deeper than this.
pub const TREEMAP_STAGE_NESTED_MAX_DEPTH: usize = 3;

/// A nested cell thinner than this on either axis is dropped (Vue: `w < 2`).
pub const TREEMAP_STAGE_NESTED_MIN_PX: f64 = 2.0;

// ── the camera (pure) ──────────────────────────────────────────────────

/// Vue's `applyZoom` clamp: round, then hold inside the 50–200% range.
pub fn treemap_stage_clamp_zoom(percent: f64) -> f64 {
    if !percent.is_finite() {
        return TREEMAP_STAGE_DEFAULT_ZOOM;
    }
    percent
        .round()
        .clamp(TREEMAP_STAGE_MIN_ZOOM, TREEMAP_STAGE_MAX_ZOOM)
}

/// One zoom-bar rung: `direction` is -1 (out) or +1 (in) (Vue:
/// `applyZoom(zoomPct + (deltaY < 0 ? STEP : -STEP))`).
pub fn treemap_stage_step_zoom(percent: f64, direction: i32) -> f64 {
    let step = if direction == 0 {
        0.0
    } else {
        TREEMAP_STAGE_STEP_ZOOM * f64::from(direction.signum())
    };
    treemap_stage_clamp_zoom(percent + step)
}

/// Vue's `rescalePan`: with `transform = translate(pan) scale(k)`, keep the
/// WORLD point under `anchor` stationary across a zoom change.
/// Anchor, pan and the result are all canvas-local CSS px.
pub fn treemap_stage_rescale_pan(
    pan_x: f64,
    pan_y: f64,
    prev_zoom: f64,
    next_zoom: f64,
    anchor_x: f64,
    anchor_y: f64,
) -> (f64, f64) {
    if prev_zoom <= 0.0 || next_zoom == prev_zoom {
        return (pan_x, pan_y);
    }
    let ratio = next_zoom / prev_zoom;
    (
        anchor_x - (anchor_x - pan_x) * ratio,
        anchor_y - (anchor_y - pan_y) * ratio,
    )
}

/// The camera transform written onto `.hk-treemap-stage__surface`.
pub fn treemap_stage_transform(pan_x: f64, pan_y: f64, zoom_percent: f64) -> String {
    format!(
        "translate({}, {}) scale({})",
        treemap_px(pan_x),
        treemap_px(pan_y),
        zoom_percent / 100.0
    )
}

/// The back button's logical inset from the inline end, so it parks beside a
/// minimap whether that cluster is folded (30px) or expanded (160px).
pub fn treemap_stage_back_inset_end(minimap_collapsed: bool) -> String {
    let cluster = if minimap_collapsed {
        TREEMAP_STAGE_MINIMAP_COLLAPSED_PX
    } else {
        TREEMAP_STAGE_MINIMAP_EXPANDED_PX
    };
    treemap_px(TREEMAP_STAGE_BACK_INSET_BASE_PX + cluster + TREEMAP_STAGE_BACK_INSET_GAP_PX)
}

// ── the drill path (pure) ──────────────────────────────────────────────

/// The live resolution of the drill path against the CURRENT layout.
/// Ids — never a children snapshot — are stored by the host, so a live data
/// refresh keeps the operator's drill instead of silently snapping home.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapStageDrill {
    /// Valid ids: a refresh that removed a hop truncates the path here.
    pub ids: Vec<String>,
    /// The nodes along the path, for the breadcrumb.
    pub nodes: Vec<TreemapLayoutNode>,
    /// The children shown on the canvas at this level.
    pub siblings: Vec<TreemapLayoutNode>,
}

/// Walk `drill_path` through `layout` and stop at the first missing hop.
pub fn treemap_stage_resolve_drill(
    layout: &TreemapLayout,
    drill_path: &[String],
) -> TreemapStageDrill {
    let mut siblings = layout.nodes.clone();
    let mut nodes: Vec<TreemapLayoutNode> = Vec::new();
    let mut valid = 0usize;
    for id in drill_path {
        let next = match siblings.iter().find(|node| &node.id == id) {
            Some(next) => next.clone(),
            None => break,
        };
        siblings = next.children.clone().unwrap_or_default();
        nodes.push(next);
        valid += 1;
    }
    TreemapStageDrill {
        ids: drill_path[..valid].to_vec(),
        nodes,
        siblings,
    }
}

// ── the nested preview (pure) ──────────────────────────────────────────

/// One non-interactive nested rectangle of a group's in-place preview.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapStageNested {
    /// Vue's render key path (`nested:<group>/<child>/…`); kept in the model
    /// so a host can address an entry without re-deriving the walk.
    pub key: String,
    /// Position INSIDE the top-level group cell (Vue: `x - originX`).
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub depth: usize,
    pub is_group: bool,
    pub node: TreemapLayoutNode,
}

fn treemap_stage_push_nested(
    out: &mut Vec<TreemapStageNested>,
    cell: &TreemapCell,
    key: &str,
    depth: usize,
    origin_x: f64,
    origin_y: f64,
    zoom: f64,
) {
    if cell.w < TREEMAP_STAGE_NESTED_MIN_PX || cell.h < TREEMAP_STAGE_NESTED_MIN_PX {
        return;
    }
    let is_group = !cell.children.is_empty();
    out.push(TreemapStageNested {
        key: key.to_string(),
        x: cell.x - origin_x,
        y: cell.y - origin_y,
        w: cell.w,
        h: cell.h,
        depth,
        is_group,
        node: cell.node.clone(),
    });
    // The returned entries are FLAT siblings under the top-level group cell,
    // so every depth keeps that group's origin (passing this cell's x/y would
    // shift grandchildren up and left by the accumulated insets).
    if is_group
        && depth < TREEMAP_STAGE_NESTED_MAX_DEPTH
        && cell.w * zoom >= TREEMAP_STAGE_NESTED_RECURSE_W
        && cell.h * zoom >= TREEMAP_STAGE_NESTED_RECURSE_H
    {
        for child in &cell.children {
            treemap_stage_push_nested(
                out,
                child,
                &format!("{key}/{}", child.node.id),
                depth + 1,
                origin_x,
                origin_y,
                zoom,
            );
        }
    }
}

/// Vue's `renderNestedPreview`: a group large enough on screen (at the
/// current zoom) paints its children — and their children — in place.
pub fn treemap_stage_nested_preview(cell: &TreemapCell, zoom: f64) -> Vec<TreemapStageNested> {
    if cell.children.is_empty()
        || cell.w * zoom < TREEMAP_STAGE_NESTED_MIN_W
        || cell.h * zoom < TREEMAP_STAGE_NESTED_MIN_H
    {
        return Vec::new();
    }
    let mut out: Vec<TreemapStageNested> = Vec::new();
    for child in &cell.children {
        treemap_stage_push_nested(
            &mut out,
            child,
            &format!("nested:{}/{}", cell.node.id, child.node.id),
            0,
            cell.x,
            cell.y,
            zoom,
        );
    }
    out
}

// ── class names (the DOM contract, pinned by the tests) ─────────────────

/// The class string of one stage cell; every cell is an activatable button
/// (groups drill, leaves select), and only groups carry the drill affordance.
pub fn treemap_stage_cell_classes(is_group: bool) -> String {
    if is_group {
        "hk-treemap__cell hk-treemap__cell--group hk-treemap-stage__cell hk-treemap-stage__cell--drillable"
            .to_string()
    } else {
        "hk-treemap__cell hk-treemap-stage__cell".to_string()
    }
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct TreemapStageProps {
    /// Caller-supplied tree (Vue: `nodes`, default `[]`).
    pub nodes: Vec<TreemapNode>,

    /// Canvas WIDTH in px (Vue measures the canvas; see the header).
    #[default(320.0)]
    pub width: f64,

    /// Canvas HEIGHT in px (Vue measures the canvas; see the header).
    #[default(320.0)]
    pub height: f64,

    /// The controlled drill path: ids from the root down to the shown level
    /// (Vue owns this internally).
    pub drill_path: Vec<String>,

    /// The camera's zoom percent, clamped to 50–200 on render.
    #[default(TREEMAP_STAGE_DEFAULT_ZOOM)]
    pub zoom_percent: f64,

    /// The camera's pan in canvas-local px.
    #[default]
    pub pan_x: f64,

    #[default]
    pub pan_y: f64,

    /// Whether the (host-owned) minimap cluster is folded — it only moves the
    /// back button's inset here (see the header).
    #[default(true)]
    pub minimap_collapsed: bool,

    /// Text of the empty state (Vue: `emptyText`).
    #[default("No data".to_string())]
    pub empty_text: String,

    /// Accessible name of the canvas, and the ROOT breadcrumb's label
    /// (Vue: `ariaLabel`).
    #[default("Treemap".to_string())]
    pub aria_label: String,

    /// Value formatter (Vue: `valueFormatter`); `None` is Vue's default.
    pub value_formatter: Option<Callback<f64, String>>,

    /// A GROUP cell was activated: append this id to `drill_path`
    /// (Vue: `pushDrill`'s drill branch).
    pub on_drill: Option<EventHandler<String>>,

    /// A LEAF cell was activated (Vue: `pushDrill`'s select emit).
    pub on_select: Option<EventHandler<String>>,

    /// A breadcrumb / the back button asked for `drill_path[..len]`
    /// (Vue: `popTo`).
    pub on_pop: Option<EventHandler<usize>>,
}

// ── render assembly (no geometry below this line) ───────────────────────

fn treemap_stage_cell_frame_style(cell: &TreemapCell) -> String {
    format!(
        "position:absolute;left:{};top:{};width:{};height:{};background:{};--hk-treemap-fg:{}",
        treemap_px(cell.x),
        treemap_px(cell.y),
        treemap_px(cell.w),
        treemap_px(cell.h),
        cell.node.color,
        treemap_contrast_text_color()
    )
}

fn treemap_stage_meta_node(
    node: &TreemapLayoutNode,
    formatter: Option<&Callback<f64, String>>,
) -> VNode {
    let meta = format!(
        "{} · {}",
        treemap_format_value(formatter, node.value),
        treemap_format_percent(node.percent)
    );
    rsx! {
        span { class: "hk-treemap__meta", {meta} }
    }
}

fn treemap_stage_nested_node(
    nested: &TreemapStageNested,
    zoom: f64,
    formatter: Option<&Callback<f64, String>>,
) -> VNode {
    let ladder = treemap_cell_ladder(nested.w, nested.h, zoom);
    let label_classes = treemap_label_classes(nested.is_group, nested.node.label_italic);
    let label = nested.node.label.clone();
    let meta = if ladder.show_value {
        let meta_text = format!(
            "{} · {}",
            treemap_format_value(formatter, nested.node.value),
            treemap_format_percent(nested.node.percent)
        );
        rsx! {
            span { class: "hk-treemap-stage__nested-meta", {meta_text} }
        }
    } else {
        empty_vnode()
    };
    let nested_label = format!("hk-treemap-stage__nested-label {label_classes}");
    let body = if nested.is_group {
        if ladder.show_label {
            rsx! {
                span {
                    class: "hk-treemap-stage__nested-head",
                    span { class: nested_label, {label} }
                    {meta}
                }
            }
        } else {
            empty_vnode()
        }
    } else if ladder.show_label {
        rsx! {
            span {
                class: "hk-treemap-stage__nested-leaf",
                span { class: nested_label, {label} }
                {meta}
            }
        }
    } else {
        empty_vnode()
    };
    let style = format!(
        "position:absolute;left:{};top:{};width:{};height:{};background:{};--hk-treemap-fg:{}",
        treemap_px(nested.x),
        treemap_px(nested.y),
        treemap_px(nested.w),
        treemap_px(nested.h),
        nested.node.color,
        treemap_contrast_text_color()
    );
    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-treemap__cell hk-treemap-stage__nested-cell")
            .attr("data-depth", nested.depth as i32)
            .attr("aria-hidden", "true")
            .style(style)
            .child(body),
    ))
}

fn treemap_stage_cell_node(
    cell: &TreemapCell,
    zoom: f64,
    formatter: Option<&Callback<f64, String>>,
    on_drill: Option<EventHandler<String>>,
    on_select: Option<EventHandler<String>>,
) -> VNode {
    let node = &cell.node;
    let is_group = !cell.children.is_empty();
    let ladder = treemap_cell_ladder(cell.w, cell.h, zoom);
    let label_classes = treemap_label_classes(is_group, node.label_italic);
    let label = node.label.clone();
    let meta = if ladder.show_value {
        treemap_stage_meta_node(node, formatter)
    } else {
        empty_vnode()
    };
    let body = if is_group {
        rsx! {
            span {
                class: "hk-treemap__group-head",
                span { class: label_classes, {label} }
                {meta}
            }
        }
    } else if ladder.show_label {
        rsx! {
            span {
                class: "hk-treemap__leaf-body",
                span { class: label_classes, {label} }
                {meta}
            }
        }
    } else {
        empty_vnode()
    };

    let cell_id = node.id.clone();
    let click = {
        let on_drill = on_drill.clone();
        let on_select = on_select.clone();
        let cell_id = cell_id.clone();
        move |_event: MouseEvent| {
            if is_group {
                if let Some(handler) = on_drill.as_ref() {
                    handler.call(cell_id.clone());
                }
            } else if let Some(handler) = on_select.as_ref() {
                handler.call(cell_id.clone());
            }
        }
    };
    // Every cell is an activatable button (groups drill, leaves select) —
    // keyboard parity with the mouse path.
    let keydown = {
        let on_drill = on_drill.clone();
        let on_select = on_select.clone();
        let cell_id = cell_id.clone();
        move |event: KeyboardEvent| {
            if event.key != "Enter" && event.key != " " {
                return;
            }
            event.prevent_default();
            if is_group {
                if let Some(handler) = on_drill.as_ref() {
                    handler.call(cell_id.clone());
                }
            } else if let Some(handler) = on_select.as_ref() {
                handler.call(cell_id.clone());
            }
        }
    };

    let aria = treemap_cell_text(node, formatter);
    let mut element = VElement::new("div")
        .class(treemap_stage_cell_classes(is_group))
        .attr("role", "button")
        .attr("tabindex", "0")
        .attr("aria-label", aria.clone())
        .attr("title", aria)
        .style(treemap_stage_cell_frame_style(cell))
        .on_click(click)
        .on_keydown(keydown)
        .child(body);

    for nested in treemap_stage_nested_preview(cell, zoom) {
        element = element.child(treemap_stage_nested_node(&nested, zoom, formatter));
    }
    VNode::Element(Box::new(element))
}

fn treemap_stage_crumb_nodes(
    drill: &TreemapStageDrill,
    root_label: &str,
    on_pop: Option<EventHandler<usize>>,
) -> Vec<VNode> {
    let root_click = {
        let on_pop = on_pop.clone();
        move |_event: MouseEvent| {
            if let Some(handler) = on_pop.as_ref() {
                handler.call(0);
            }
        }
    };
    let mut nodes: Vec<VNode> = Vec::new();
    nodes.push(rsx! {
        button {
            "type": "button",
            class: "hk-treemap-stage__crumb",
            "data-root": "",
            onclick: root_click,
            {root_label.to_string()}
        }
    });
    let count = drill.nodes.len();
    for (index, step) in drill.nodes.iter().enumerate() {
        let is_last = index + 1 == count;
        let target = index + 1;
        let step_click = {
            let on_pop = on_pop.clone();
            move |_event: MouseEvent| {
                if let Some(handler) = on_pop.as_ref() {
                    handler.call(target);
                }
            }
        };
        let data_last = if is_last { Some(String::new()) } else { None };
        let aria_current = if is_last {
            Some("page".to_string())
        } else {
            None
        };
        let label = step.label.clone();
        nodes.push(rsx! {
            span {
                class: "hk-treemap-stage__crumb-seg",
                span { class: "hk-treemap-stage__crumb-sep", "aria-hidden": "true", "/" }
                button {
                    "type": "button",
                    class: "hk-treemap-stage__crumb",
                    "data-last": data_last,
                    "aria-current": aria_current,
                    onclick: step_click,
                    {label}
                }
            }
        });
    }
    nodes
}

#[component]
pub fn TreemapStage(props: TreemapStageProps) -> Element {
    let formatter = props.value_formatter.clone();
    let layout = treemap_build_layout(&props.nodes);
    let has_data = !layout.nodes.is_empty();
    let drill = treemap_stage_resolve_drill(&layout, &props.drill_path);
    let zoom = treemap_stage_clamp_zoom(props.zoom_percent);
    let cells = if has_data {
        treemap_layout_cells(&drill.siblings, 0.0, 0.0, props.width, props.height)
    } else {
        Vec::new()
    };
    let drilled = has_data && !drill.nodes.is_empty();
    let level_empty = drilled && cells.is_empty();

    let cell_nodes: Vec<VNode> = cells
        .iter()
        .map(|cell| {
            treemap_stage_cell_node(
                cell,
                zoom,
                formatter.as_ref(),
                props.on_drill.clone(),
                props.on_select.clone(),
            )
        })
        .collect();
    let crumb_nodes = if drilled {
        treemap_stage_crumb_nodes(&drill, &props.aria_label, props.on_pop.clone())
    } else {
        Vec::new()
    };

    let surface_style = format!(
        "transform:{};transform-origin:0 0",
        treemap_stage_transform(props.pan_x, props.pan_y, zoom)
    );
    let aria_label = props.aria_label.clone();
    let path_label = hikari_i18n::t("hikari::treemap.drillPath", "Drill path");
    let back_label = hikari_i18n::t("hikari::treemap.back", "Back");
    let back_style = format!(
        "inset-inline-end:{}",
        treemap_stage_back_inset_end(props.minimap_collapsed)
    );
    let back_click = {
        let on_pop = props.on_pop.clone();
        // Vue: `popTo(resolvedDrill.nodes.length - 1)`.
        let target = drill.nodes.len().saturating_sub(1);
        move |_event: MouseEvent| {
            if let Some(handler) = on_pop.as_ref() {
                handler.call(target);
            }
        }
    };
    let empty_text = props.empty_text.clone();
    let level_empty_text = props.empty_text.clone();

    rsx! {
        div { class: "hk-treemap-stage",
            if drilled {
                header { class: "hk-treemap-stage__head",
                    nav { class: "hk-treemap-stage__path", "aria-label": path_label,
                        ..crumb_nodes
                    }
                }
            }
            div { class: "hk-treemap-stage__body",
                div {
                    class: "hk-treemap-stage__canvas",
                    role: "application",
                    "aria-label": aria_label,
                    if has_data {
                        div { class: "hk-treemap-stage__surface", style: surface_style,
                            ..cell_nodes
                        }
                    }
                    if !has_data {
                        div { class: "hk-treemap__empty", {empty_text} }
                    }
                }
                if level_empty {
                    div { class: "hk-treemap-stage__empty", {level_empty_text} }
                }
                if drilled {
                    button {
                        "type": "button",
                        class: "hk-treemap-stage__back-float",
                        style: back_style,
                        "aria-label": back_label,
                        onclick: back_click,
                        Icon { icon: MdiIcon::ChevronLeft, size: 16 }
                    }
                }
            }
        }
    }
}

impl StyledComponent for TreemapStageComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTreemapStage.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "treemap-stage"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::treemap::{HK_TREEMAP_GROUP_HEADER_PX, HK_TREEMAP_GROUP_PAD_PX};

    fn leaf(id: &str, value: f64) -> TreemapNode {
        TreemapNode {
            id: id.to_string(),
            label: id.to_string(),
            value,
            ..Default::default()
        }
    }

    fn group(id: &str, children: Vec<TreemapNode>) -> TreemapNode {
        TreemapNode {
            id: id.to_string(),
            label: id.to_string(),
            children: Some(children),
            ..Default::default()
        }
    }

    fn drill(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| (*id).to_string()).collect()
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn treemap_stage_defaults_match_the_vue_props() {
        let props = TreemapStageProps::default();
        assert!(props.nodes.is_empty());
        assert_eq!(props.width, 320.0);
        assert_eq!(props.height, 320.0);
        assert!(props.drill_path.is_empty());
        assert_eq!(props.zoom_percent, TREEMAP_STAGE_DEFAULT_ZOOM);
        assert_eq!(props.pan_x, 0.0);
        assert_eq!(props.pan_y, 0.0);
        assert!(props.minimap_collapsed, "Vue's minimap starts collapsed");
        assert_eq!(props.empty_text, "No data");
        assert_eq!(props.aria_label, "Treemap");
        assert!(props.value_formatter.is_none());
        assert!(props.on_drill.is_none());
        assert!(props.on_select.is_none());
        assert!(props.on_pop.is_none());
    }

    // ── class-name mapping ─────────────────────────────────────────────

    #[test]
    fn treemap_stage_class_names_match_the_vue_sheet() {
        assert_eq!(
            treemap_stage_cell_classes(true),
            "hk-treemap__cell hk-treemap__cell--group hk-treemap-stage__cell hk-treemap-stage__cell--drillable"
        );
        assert_eq!(
            treemap_stage_cell_classes(false),
            "hk-treemap__cell hk-treemap-stage__cell"
        );
    }

    // ── the camera (pure) ──────────────────────────────────────────────

    #[test]
    fn treemap_stage_zoom_clamps_and_steps_like_vue() {
        assert_eq!(treemap_stage_clamp_zoom(100.0), 100.0);
        assert_eq!(treemap_stage_clamp_zoom(0.0), TREEMAP_STAGE_MIN_ZOOM);
        assert_eq!(treemap_stage_clamp_zoom(500.0), TREEMAP_STAGE_MAX_ZOOM);
        assert_eq!(treemap_stage_clamp_zoom(100.4), 100.0);
        assert_eq!(
            treemap_stage_clamp_zoom(f64::NAN),
            TREEMAP_STAGE_DEFAULT_ZOOM
        );
        assert_eq!(treemap_stage_step_zoom(100.0, 1), 110.0);
        assert_eq!(treemap_stage_step_zoom(100.0, -1), 90.0);
        // Neither rung may escape the band.
        assert_eq!(treemap_stage_step_zoom(200.0, 1), TREEMAP_STAGE_MAX_ZOOM);
        assert_eq!(treemap_stage_step_zoom(50.0, -1), TREEMAP_STAGE_MIN_ZOOM);
        assert_eq!(treemap_stage_step_zoom(100.0, 0), 100.0);
    }

    #[test]
    fn treemap_stage_transform_and_back_inset_carry_the_camera_geometry() {
        assert_eq!(
            treemap_stage_transform(0.0, 0.0, 100.0),
            "translate(0px, 0px) scale(1)"
        );
        assert_eq!(
            treemap_stage_transform(-12.5, 40.0, 150.0),
            "translate(-12.5px, 40px) scale(1.5)"
        );
        // The cluster is folded (30px) or expanded (160px): 12 + width + 8.
        assert_eq!(treemap_stage_back_inset_end(true), "50px");
        assert_eq!(treemap_stage_back_inset_end(false), "180px");
    }

    #[test]
    fn treemap_stage_rescale_pan_keeps_the_anchor_stationary() {
        // No-op cases: unchanged zoom, non-positive previous zoom.
        assert_eq!(
            treemap_stage_rescale_pan(10.0, 20.0, 100.0, 100.0, 50.0, 50.0),
            (10.0, 20.0)
        );
        assert_eq!(
            treemap_stage_rescale_pan(10.0, 20.0, 0.0, 200.0, 50.0, 50.0),
            (10.0, 20.0)
        );
        // Zooming 100% → 200% about the origin doubles the pan.
        assert_eq!(
            treemap_stage_rescale_pan(10.0, 20.0, 100.0, 200.0, 0.0, 0.0),
            (20.0, 40.0)
        );
        // Zooming about a non-origin anchor keeps that world point fixed:
        // under translate(pan) scale(k) the anchor maps to
        // pan + anchor*k — assert it before and after.
        let (pan_before_x, pan_before_y) = (30.0, -10.0);
        let (anchor_x, anchor_y) = (120.0, 80.0);
        let (after_x, after_y) =
            treemap_stage_rescale_pan(pan_before_x, pan_before_y, 100.0, 150.0, anchor_x, anchor_y);
        // translate(pan) scale(k) puts world w at screen pan + w*k, so the
        // world point under a screen anchor is (anchor - pan) / k.
        let world_before = (
            (anchor_x - pan_before_x) / 1.0,
            (anchor_y - pan_before_y) / 1.0,
        );
        let world_after = ((anchor_x - after_x) / 1.5, (anchor_y - after_y) / 1.5);
        assert!((world_before.0 - world_after.0).abs() < 1e-9);
        assert!((world_before.1 - world_after.1).abs() < 1e-9);
        // A single element with no zoom change cannot move the camera.
        assert_eq!(
            treemap_stage_rescale_pan(0.0, 0.0, 100.0, 100.0, 33.0, 44.0),
            (0.0, 0.0)
        );
    }

    // ── the drill resolution (pure) ───────────────────────────────────

    #[test]
    fn treemap_stage_resolve_drill_truncates_at_the_first_missing_hop() {
        let layout = treemap_build_layout(&[group("g", vec![group("h", vec![leaf("a", 1.0)])])]);

        let root = treemap_stage_resolve_drill(&layout, &[]);
        assert!(root.ids.is_empty() && root.nodes.is_empty());
        assert_eq!(root.siblings.len(), 1);

        let one = treemap_stage_resolve_drill(&layout, &drill(&["g"]));
        assert_eq!(one.ids, drill(&["g"]));
        assert_eq!(one.nodes.len(), 1);
        assert_eq!(one.siblings.len(), 1);
        assert_eq!(one.siblings[0].children.as_ref().map(|c| c.len()), Some(1));

        let two = treemap_stage_resolve_drill(&layout, &drill(&["g", "h"]));
        assert_eq!(two.ids, drill(&["g", "h"]));
        assert!(
            two.siblings[0].children.is_none(),
            "h's children are leaves"
        );

        // A hop the current layout no longer carries truncates the path (the
        // Vue contract after a live refresh removed it).
        let stale = treemap_stage_resolve_drill(&layout, &drill(&["g", "gone", "h"]));
        assert_eq!(stale.ids, drill(&["g"]));
        assert_eq!(stale.nodes.len(), 1);

        // The empty layout resolves to nothing at all.
        let empty = treemap_stage_resolve_drill(&TreemapLayout::default(), &drill(&["g"]));
        assert!(empty.ids.is_empty() && empty.nodes.is_empty() && empty.siblings.is_empty());
    }

    // ── the nested preview (pure) ─────────────────────────────────────

    #[test]
    fn treemap_stage_nested_preview_needs_a_roomy_group_and_keeps_the_origin() {
        let layout = treemap_build_layout(&[
            group("g", vec![leaf("a", 6.0), leaf("b", 4.0)]),
            leaf("c", 10.0),
        ]);
        let cells = treemap_layout_cells(&layout.nodes, 0.0, 0.0, 400.0, 200.0);
        let group_cell = cells.iter().find(|c| c.node.id == "g").expect("group");
        let leaf_cell = cells.iter().find(|c| c.node.id == "c").expect("leaf");

        // A leaf never previews its inside.
        assert!(treemap_stage_nested_preview(leaf_cell, 1.0).is_empty());
        // A group too small on screen at this zoom renders no preview.
        assert!(treemap_stage_nested_preview(group_cell, 0.25).is_empty());
        let preview = treemap_stage_nested_preview(group_cell, 1.0);
        assert_eq!(preview.len(), 2, "both children preview");
        for entry in &preview {
            assert_eq!(entry.depth, 0);
            // Coordinates are relative to the TOP-LEVEL group cell.
            assert!(entry.x >= HK_TREEMAP_GROUP_PAD_PX - 1e-9);
            assert!(entry.y >= HK_TREEMAP_GROUP_HEADER_PX - 1e-9);
            assert!(entry.key.starts_with("nested:g/"));
            assert!(!entry.is_group);
        }
        assert!(
            (preview[0].x + preview[0].w <= group_cell.w + 1e-9),
            "the previews stay inside the group cell"
        );
    }

    #[test]
    fn treemap_stage_nested_preview_caps_the_depth() {
        // Five nested levels, each big enough to recurse at 100%.
        let mut node = leaf("leaf", 1.0);
        for level in 0..5 {
            node = group(&format!("l{level}"), vec![node]);
        }
        let layout = treemap_build_layout(&[node]);
        let cells = treemap_layout_cells(&layout.nodes, 0.0, 0.0, 2000.0, 1600.0);
        let preview = treemap_stage_nested_preview(&cells[0], 1.0);
        assert!(!preview.is_empty());
        let deepest = preview.iter().map(|entry| entry.depth).max().unwrap_or(0);
        assert!(
            deepest <= TREEMAP_STAGE_NESTED_MAX_DEPTH,
            "the recursion must stop at depth {TREEMAP_STAGE_NESTED_MAX_DEPTH}, got {deepest}"
        );
        // The walk is deterministic (same input, same entries, same order).
        assert_eq!(preview, treemap_stage_nested_preview(&cells[0], 1.0));
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn treemap_stage_root_level_renders_cells_without_a_header() {
        let html = TreemapStage(TreemapStageProps {
            nodes: vec![
                group("g", vec![leaf("a", 6.0), leaf("b", 4.0)]),
                leaf("c", 10.0),
            ],
            width: 400.0,
            height: 200.0,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-treemap-stage\"",
            "hk-treemap-stage__body",
            "hk-treemap-stage__canvas",
            "hk-treemap-stage__surface",
            "transform:translate(0px, 0px) scale(1);transform-origin:0 0",
            "hk-treemap-stage__cell--drillable",
            "role=\"button\"",
            "tabindex=\"0\"",
            "hk-treemap-stage__nested-cell",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // At root there is NO header, no breadcrumb and no back button.
        assert!(!html.contains("hk-treemap-stage__head"), "{html}");
        assert!(!html.contains("hk-treemap-stage__crumb"), "{html}");
        assert!(!html.contains("hk-treemap-stage__back-float"), "{html}");
    }

    #[test]
    fn treemap_stage_drilled_level_renders_breadcrumbs_and_the_back_button() {
        let html = TreemapStage(TreemapStageProps {
            nodes: vec![group("g", vec![group("h", vec![leaf("a", 1.0)])])],
            drill_path: drill(&["g", "h"]),
            width: 400.0,
            height: 200.0,
            zoom_percent: 150.0,
            pan_x: -20.0,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-treemap-stage__head",
            "hk-treemap-stage__path",
            "hk-treemap-stage__crumb",
            "data-root=\"\"",
            "data-last=\"\"",
            "aria-current=\"page\"",
            "hk-treemap-stage__back-float",
            "inset-inline-end:50px",
            "scale(1.5)",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // `h`'s only child is the leaf `a`, so the level renders that cell.
        assert!(html.contains("hk-treemap-stage__cell"), "{html}");
    }

    #[test]
    fn treemap_stage_renders_the_empty_state() {
        let html = TreemapStage(TreemapStageProps {
            empty_text: "Nothing yet".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-treemap__empty"), "{html}");
        assert!(html.contains("Nothing yet"), "{html}");
        assert!(!html.contains("hk-treemap-stage__surface"), "{html}");
    }

    #[test]
    fn treemap_stage_styles_come_from_the_canonical_vue_sheet() {
        let css = TreemapStageComponent::styles();
        assert!(
            css.contains(".hk-treemap-stage")
                && css.contains(".hk-treemap-stage__surface")
                && css.contains(".hk-treemap-stage__nested-cell"),
            "treemap stage css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored treemap stage sheet"
        );
        assert_eq!(TreemapStageComponent::name(), "treemap-stage");
    }
}
