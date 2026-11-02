// hi-components/src/data/tree.rs
// Tree — mirror of the canonical Vue `HkTree` (nested rows, expand / collapse,
// select, keyboard cursor, lazy-load shell).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTree.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-tree*` class names are literal and
// identical in both forms. DOM contract (mirrors the Vue render output — the
// nesting is load-bearing: the sheet's size rules and the children guide line
// both hang off `.hk-tree-node` / `.hk-tree-children`):
//
//   div.hk-tree [data-size=sm] [host class] role=tree tabindex=0
//       [aria-activedescendant=…]
//     div.hk-tree-node                                   (key = item id)
//       div.hk-tree-row id={idPrefix + itemId}
//           role=treeitem [aria-level=N]
//           [data-status] [data-selected] [aria-selected] [data-selection]
//           [data-loading] [data-active]
//         span.hk-tree-indent  (style: width={depth × indent}px)   (depth > 0)
//         span.hk-tree-toggle [data-parent] [data-open] [data-loading]
//           span[style="display:contents"]                  (chevron svg markup)
//           ── or, for a leaf ──
//           span.hk-tree-leaf
//         span.hk-tree-icon [.icon-class]?                  (icon)
//         span.hk-tree-label
//           span.hk-tree-label-tag?  " "?  {label text}
//       div.hk-tree-children (style: --guide-left={depth × indent + 16}px)
//         …recursive nodes…                              (has children && open)
//
// State contract (tairitsu 0.5.22, ledger L48): Vue keeps `expanded` in a local
// `ref<Set>`. `use_signal` allocates a fresh signal per render and `use_state`
// shares ONE slot per component type, so the set is a CONTROLLED prop here
// (`expanded_keys`) and every transition leaves through a callback
// (`on_toggle`). The mirror stores nothing itself.
//
// Deltas vs Vue (documented, not accidental):
//   * `defaultExpandAll` is NOT a prop: it seeds Vue's local set once, and a
//     controlled component cannot seed itself. Call
//     [`tree_expandable_keys`] once and pass the result as `expanded_keys` —
//     the same value Vue computes, reachable again after a collapse.
//   * selection is a mirror EXTENSION: Vue only emits `select` and paints
//     nothing. `selected_keys` + `on_selected_change` … (see next bullet)
//     give the host the state, and a row reports it as `data-selected` /
//     `aria-selected="true"`; the three-way roll-up of a subtree is
//     [`tree_selection_state`] and lands on the row as
//     `data-selection="all|partial"`. Both markers are paint-inert facts —
//     the canonical sheet has no selected-row or checkbox rule, so no
//     checkbox markup is invented here.
//   * `active_key` + `on_active_change`: Vue has NO keyboard support at all.
//     The mirror adds the tree's standard roving cursor ([`tree_keydown_action`])
//     on the focusable root (`role=tree`, `tabindex=0`,
//     `aria-activedescendant`), so a keyboard user can walk, expand, collapse
//     and select. Row ids are `id_prefix + item.id`; a host mounting several
//     trees should give each one a prefix.
//   * lazy loading is a mirror EXTENSION (Vue always receives the whole tree):
//     a node declared as a parent with no children loaded yet carries
//     [`TreeItem::expandable`], renders the parent chevron, and an EXPANSION
//     request emits `on_load` once (toggle press, row click with
//     `expand_on_click`, or keyboard expand) while `lazy` is on. `loading_keys`
//     marks the rows the host is fetching as `data-loading` (paint-inert: the
//     sheet has no spinner). Nothing is allocated or remembered here — the
//     host fills `children` and drops the key.
//   * the row's leading icon is a typed `MdiIcon` (Vue takes a component) at
//     Vue's `size: 13`, rendered through the crate's `Icon`.
//   * `TreeNodeRow`'s `slots.row` custom row renderer is not mirrored: the
//     row body is data (`icon` / `status` / `tag` / `tagLabel` / `label`).
//   * a row click also reports the active row (the keyboard cursor follows the
//     pointer), so a host never has to wire the two separately.
//
// MIGRATION (this file replaces the legacy `Tree`; the exported names `Tree` /
// `TreeProps` / `TreeComponent` are kept so `styled.rs` and `prelude.rs` keep
// resolving):
//   * `data: Vec<TreeNodeData>` → `nodes: Vec<TreeItem>` (Vue's `TreeNode`:
//     `id` / `label` / `icon` / `iconClass` / `status` / `tag` / `tagLabel` /
//     `children`). The legacy node key is Vue's `id`; `TreeNodeData` itself
//     stays for `data/node.rs`'s own component.
//   * `default_expanded_keys` → `expanded_keys` (CONTROLLED, Vue's local set).
//   * `default_selected_keys` → `selected_keys` (CONTROLLED; Vue has no
//     selection state — see the delta).
//   * `checkable` is GONE: the canonical sheet has no checkbox rule, so the
//     tri-state is exposed as [`tree_selection_state`] +
//     `data-selection` instead of unstyled checkboxes.
//   * `show_line` is GONE: the guide line is unconditional in the canonical
//     sheet (`--guide-left` on `.hk-tree-children::before`).
//   * the legacy `TreeNodeData::disabled` field is GONE (Vue expresses
//     "inactive" with `status`, which the sheet paints: `completed` / `failed`
//     / `in_progress` / `running` / `warning` / `muted`).
//   * the legacy `on_select` / `on_expand` callbacks emitted a bare key; the
//     mirror keeps those names (`on_select` / `on_toggle`) and adds
//     `on_load` / `on_active_change`.
//   * the legacy container's `role=treegroup`/`multiselectable` stub and its
//     dead keydown `prevent_default` are replaced by the real tree roles and
//     the cursor contract above.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TreeComponent;

// ── trusted static SVG markup ─────────────────────────────────────────────
// The chevron class rides the `<svg>` itself: `.hk-tree-chevron[data-open]`
// rotates the glyph, and `rsx!` has no SVG namespace path in this host stack,
// so the markup goes through `dangerous_inner_html` on a paint-inert
// `display:contents` host.
const CHEVRON_SVG: &str = r#"<svg viewBox="0 0 16 16" width="12" height="12" class="hk-tree-chevron"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>"#;
const CHEVRON_OPEN_SVG: &str = r#"<svg viewBox="0 0 16 16" width="12" height="12" class="hk-tree-chevron" data-open=""><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>"#;

fn svg_host(markup: &'static str) -> Element {
    VNode::Element(Box::new(
        VElement::new("span")
            .style("display:contents")
            .dangerous_inner_html(markup),
    ))
}

/// Size step (Vue: `xs | sm | md`, default `sm`). Rides the root's
/// `data-size`, which is how the sheet's row-height rules select.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TreeSize {
    Xs,
    #[default]
    Sm,
    Md,
}

impl TreeSize {
    /// The `data-size` token exactly as Vue emits it.
    pub fn data_size(self) -> &'static str {
        match self {
            TreeSize::Xs => "xs",
            TreeSize::Sm => "sm",
            TreeSize::Md => "md",
        }
    }
}

/// The three-way selection roll-up of a key set (a subtree, for the tree).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TreeSelectionState {
    #[default]
    None,
    Partial,
    All,
}

impl TreeSelectionState {
    pub fn is_all(self) -> bool {
        matches!(self, TreeSelectionState::All)
    }

    /// The paint-inert `data-selection` token (`None` emits no attribute).
    pub fn data_selection(self) -> Option<&'static str> {
        match self {
            TreeSelectionState::None => None,
            TreeSelectionState::Partial => Some("partial"),
            TreeSelectionState::All => Some("all"),
        }
    }
}

/// One node (Vue: the `TreeNode` interface).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreeItem {
    /// Identity and DOM key (Vue: `id`).
    pub id: String,

    /// Row text (Vue: `label`).
    pub label: String,

    /// Leading glyph (Vue: an icon component; the mirror takes the crate's
    /// typed icon).
    pub icon: Option<MdiIcon>,

    /// Extra class on the icon box (Vue: `iconClass`).
    pub icon_class: String,

    /// Status paint token (Vue: `status`, free-form; the sheet knows
    /// `completed` / `failed` / `in_progress` / `running` / `warning` /
    /// `muted`).
    pub status: Option<String>,

    /// Render the label as the toned chip (Vue: `tag`).
    pub tag: bool,

    /// Chip text when the row keeps its plain label beside the chip (Vue:
    /// `tagLabel`).
    pub tag_label: Option<String>,

    /// Child nodes (Vue: `children`).
    pub children: Vec<TreeItem>,

    /// Lazy shell: this row is a parent whose children are not loaded yet, so
    /// it renders the parent chevron even with an empty `children`. Vue infers
    /// parenthood from `children.length` only.
    pub expandable: bool,
}

impl TreeItem {
    pub fn new(id: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            ..Default::default()
        }
    }

    pub fn children(mut self, children: Vec<TreeItem>) -> Self {
        self.children = children;
        self
    }

    pub fn icon(mut self, icon: MdiIcon) -> Self {
        self.icon = Some(icon);
        self
    }

    pub fn icon_class(mut self, icon_class: impl Into<String>) -> Self {
        self.icon_class = icon_class.into();
        self
    }

    pub fn status(mut self, status: impl Into<String>) -> Self {
        self.status = Some(status.into());
        self
    }

    pub fn tag_label(mut self, tag_label: impl Into<String>) -> Self {
        self.tag_label = Some(tag_label.into());
        self
    }

    /// Mark the row as the toned chip itself (Vue: `tag`).
    pub fn tag(mut self) -> Self {
        self.tag = true;
        self
    }

    /// Declare a lazy parent whose children are not loaded yet.
    pub fn expandable(mut self) -> Self {
        self.expandable = true;
        self
    }
}

/// One row of the FLATTENED, currently visible tree — the list the keyboard
/// cursor walks (Vue has no such list: it renders recursively only).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreeVisibleRow {
    pub id: String,
    pub depth: usize,
    pub has_children: bool,
    pub expanded: bool,
    /// Whether the row already carries loaded `children` — false for a leaf
    /// and for a lazy parent whose fetch is still pending.
    pub children_loaded: bool,
}

/// What a key press asks the host to do (see [`tree_keydown_action`]).
#[derive(Clone, PartialEq, Debug, Default)]
pub enum TreeKeyAction {
    /// No cursor semantics for this key.
    #[default]
    None,
    /// Move the cursor to another row.
    Move(String),
    /// Open this row's children.
    Expand(String),
    /// Close this row's children.
    Collapse(String),
    /// Select this row (Enter / Space).
    Select(String),
}

/// The resolved label of a row: Vue's `tagLabel` / `tag` / plain-label
/// precedence.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreeLabelParts {
    /// The chip text, when the row paints one.
    pub tag: Option<String>,

    /// Whether a literal space sits between the chip and the plain label
    /// (Vue returns `[tagSpan, " ", label]` for the `tagLabel` branch).
    pub separator: bool,

    /// The plain label text (empty for the chip-only branch).
    pub text: String,
}

// ── pure helpers ──────────────────────────────────────────────────────────

/// Whether the row paints the parent chevron: it has loaded children, or it is
/// declared as a not-yet-loaded parent.
pub fn tree_has_children(item: &TreeItem) -> bool {
    item.expandable || !item.children.is_empty()
}

/// Vue's label composition: `tagLabel` wins over `tag`, `tag` turns the label
/// itself into the chip, and everything else is the plain label.
pub fn tree_label_parts(item: &TreeItem) -> TreeLabelParts {
    if let Some(tag_label) = &item.tag_label {
        return TreeLabelParts {
            tag: Some(tag_label.clone()),
            separator: true,
            text: item.label.clone(),
        };
    }
    if item.tag {
        return TreeLabelParts {
            tag: Some(item.label.clone()),
            separator: false,
            text: String::new(),
        };
    }
    TreeLabelParts {
        tag: None,
        separator: false,
        text: item.label.clone(),
    }
}

/// Vue's `defaultExpandAll` value: every parent, depth-first in document order
/// (an unloaded lazy parent counts too — expanding it is what asks for the
/// children).
pub fn tree_expandable_keys(nodes: &[TreeItem]) -> Vec<String> {
    let mut keys = Vec::new();
    fn walk(list: &[TreeItem], keys: &mut Vec<String>) {
        for item in list {
            if tree_has_children(item) {
                keys.push(item.id.clone());
                walk(&item.children, keys);
            }
        }
    }
    walk(nodes, &mut keys);
    keys
}

/// The ancestor ids of `target`, root first, EXCLUDING the target itself —
/// what a lazy host expands to reveal a node it just loaded. Empty for a root
/// node and for an unknown id (a path with no ancestors is the same thing to
/// the caller: nothing to open).
pub fn tree_ancestor_path(nodes: &[TreeItem], target: &str) -> Vec<String> {
    fn walk(list: &[TreeItem], target: &str, trail: &mut Vec<String>) -> bool {
        for item in list {
            if item.id == target {
                return true;
            }
            trail.push(item.id.clone());
            if walk(&item.children, target, trail) {
                return true;
            }
            trail.pop();
        }
        false
    }
    let mut trail = Vec::new();
    if walk(nodes, target, &mut trail) {
        trail
    } else {
        Vec::new()
    }
}

/// `item`'s own id plus every descendant id, in document order.
pub fn tree_subtree_keys(item: &TreeItem) -> Vec<String> {
    let mut keys = vec![item.id.clone()];
    fn walk(list: &[TreeItem], keys: &mut Vec<String>) {
        for child in list {
            keys.push(child.id.clone());
            walk(&child.children, keys);
        }
    }
    walk(&item.children, &mut keys);
    keys
}

/// The roll-up state of `keys` against `selected` (the tree's third state:
/// a parent with SOME selected descendants is `Partial`).
pub fn tree_selection_state(selected: &[String], keys: &[String]) -> TreeSelectionState {
    if keys.is_empty() {
        return TreeSelectionState::None;
    }
    let hits = keys
        .iter()
        .filter(|key| selected.iter().any(|chosen| chosen == *key))
        .count();
    if hits == 0 {
        TreeSelectionState::None
    } else if hits == keys.len() {
        TreeSelectionState::All
    } else {
        TreeSelectionState::Partial
    }
}

/// The flattened, visible rows in document order — depth-first, descending only
/// into OPEN parents.
pub fn tree_visible_rows(nodes: &[TreeItem], expanded: &[String]) -> Vec<TreeVisibleRow> {
    fn walk(list: &[TreeItem], depth: usize, expanded: &[String], out: &mut Vec<TreeVisibleRow>) {
        for item in list {
            let has_children = tree_has_children(item);
            let is_open = has_children && expanded.iter().any(|key| key == &item.id);
            out.push(TreeVisibleRow {
                id: item.id.clone(),
                depth,
                has_children,
                expanded: is_open,
                children_loaded: !item.children.is_empty(),
            });
            if is_open {
                walk(&item.children, depth + 1, expanded, out);
            }
        }
    }
    let mut out = Vec::new();
    walk(nodes, 0, expanded, &mut out);
    out
}

/// The keyboard contract of the tree cursor, resolved from the visible rows:
///
/// * `ArrowDown` / `ArrowUp` walk the flattened list (no wrap — a list end is
///   a no-op, exactly like a focusable listbox);
/// * `ArrowRight` opens a closed parent, otherwise steps INTO an open one;
/// * `ArrowLeft` closes an open parent, otherwise steps OUT to its parent;
/// * `Home` / `End` jump to the first / last visible row;
/// * `Enter` / `Space` select the focused row.
pub fn tree_keydown_action(
    key: &str,
    active: Option<&str>,
    rows: &[TreeVisibleRow],
) -> TreeKeyAction {
    let position = active.and_then(|id| rows.iter().position(|row| row.id == id));
    let Some(index) = position else {
        // No cursor yet: a step forward lands on the first row, everything
        // else waits for one.
        return match key {
            "ArrowDown" | "Home" => rows
                .first()
                .map(|row| TreeKeyAction::Move(row.id.clone()))
                .unwrap_or_default(),
            "End" => rows
                .last()
                .map(|row| TreeKeyAction::Move(row.id.clone()))
                .unwrap_or_default(),
            _ => TreeKeyAction::None,
        };
    };
    let row = &rows[index];
    match key {
        "ArrowDown" => rows
            .get(index + 1)
            .map(|next| TreeKeyAction::Move(next.id.clone()))
            .unwrap_or_default(),
        "ArrowUp" => rows
            .get(index.wrapping_sub(1))
            .filter(|_| index > 0)
            .map(|previous| TreeKeyAction::Move(previous.id.clone()))
            .unwrap_or_default(),
        "ArrowRight" => {
            if !row.has_children {
                TreeKeyAction::None
            } else if !row.expanded {
                TreeKeyAction::Expand(row.id.clone())
            } else {
                rows.get(index + 1)
                    .filter(|next| next.depth == row.depth + 1)
                    .map(|next| TreeKeyAction::Move(next.id.clone()))
                    .unwrap_or_default()
            }
        }
        "ArrowLeft" => {
            if row.has_children && row.expanded {
                TreeKeyAction::Collapse(row.id.clone())
            } else if row.depth == 0 {
                TreeKeyAction::None
            } else {
                rows[..index]
                    .iter()
                    .rfind(|parent| parent.depth + 1 == row.depth)
                    .map(|parent| TreeKeyAction::Move(parent.id.clone()))
                    .unwrap_or_default()
            }
        }
        "Home" => rows
            .first()
            .map(|first| TreeKeyAction::Move(first.id.clone()))
            .unwrap_or_default(),
        "End" => rows
            .last()
            .map(|last| TreeKeyAction::Move(last.id.clone()))
            .unwrap_or_default(),
        "Enter" | " " => TreeKeyAction::Select(row.id.clone()),
        _ => TreeKeyAction::None,
    }
}

/// The event wiring a row shares with its host. `EventHandler` is cloneable, so
/// a row hands out copies instead of borrowing the props (an `rsx!` handler
/// must be `'static`).
#[derive(Clone)]
struct TreeWiring {
    on_select: Option<EventHandler<String>>,
    on_toggle: Option<EventHandler<String>>,
    on_load: Option<EventHandler<String>>,
    on_active_change: Option<EventHandler<String>>,
    expand_on_click: bool,
    lazy: bool,
}

impl TreeWiring {
    fn select(&self, id: &str) {
        if let Some(handler) = self.on_select.as_ref() {
            handler.call(id.to_string());
        }
    }

    fn activate(&self, id: &str) {
        if let Some(handler) = self.on_active_change.as_ref() {
            handler.call(id.to_string());
        }
    }

    fn toggle(&self, id: &str) {
        if let Some(handler) = self.on_toggle.as_ref() {
            handler.call(id.to_string());
        }
    }

    /// A requested EXPANSION of a lazy parent with nothing loaded yet also asks
    /// for the children (the lazy shell's only fetch trigger).
    fn request(&self, id: &str, expanded: bool, children_loaded: bool) {
        self.toggle(id);
        if !expanded
            && self.lazy
            && !children_loaded
            && let Some(handler) = self.on_load.as_ref()
        {
            handler.call(id.to_string());
        }
    }
}

/// Everything a recursive row render needs, built once per tree.
struct TreeRenderContext {
    expanded: Vec<String>,
    selected: Vec<String>,
    loading: Vec<String>,
    active: Option<String>,
    id_prefix: String,
    indent: u32,
    wiring: TreeWiring,
}

#[define_props]
pub struct TreeProps {
    /// The roots (Vue: `nodes`, default `[]`).
    pub nodes: Vec<TreeItem>,

    /// Size step, carried as the root's `data-size`.
    #[default]
    pub size: TreeSize,

    /// Indent step in px (Vue: `indent`, default 16).
    #[default(16)]
    pub indent: u32,

    /// A row click also toggles a parent (Vue: `expandOnClick`).
    #[default]
    pub expand_on_click: bool,

    /// Controlled open ids (Vue: the local `expanded` set). Seed it with
    /// [`tree_expandable_keys`] for Vue's `defaultExpandAll`.
    #[default]
    pub expanded_keys: Vec<String>,

    /// Controlled selected ids (mirror extension — Vue emits `select` only).
    #[default]
    pub selected_keys: Vec<String>,

    /// The keyboard cursor's row (mirror extension).
    pub active_key: Option<String>,

    /// Lazy-load shell: an expansion request on an unloaded parent emits
    /// [`TreeProps::on_load`].
    #[default]
    pub lazy: bool,

    /// Rows whose children the host is fetching (`data-loading`).
    #[default]
    pub loading_keys: Vec<String>,

    /// Prefix for the row ids (`id_prefix + item.id`), so several trees on one
    /// page keep `aria-activedescendant` unique.
    #[default]
    pub id_prefix: String,

    /// Fires with the toggled row id (Vue: the `toggle` emit, node payload).
    pub on_toggle: Option<EventHandler<String>>,

    /// Fires with the selected row id (Vue: the `select` emit, node payload).
    pub on_select: Option<EventHandler<String>>,

    /// Fires with the row id the cursor moved to (mirror extension).
    pub on_active_change: Option<EventHandler<String>>,

    /// Fires with a lazy parent's id when its children should be fetched
    /// (mirror extension).
    pub on_load: Option<EventHandler<String>>,

    /// Appended to `div.hk-tree`.
    #[default]
    pub class: String,
}

fn render_tree_node(item: &TreeItem, depth: usize, ctx: &TreeRenderContext) -> Element {
    let has_children = tree_has_children(item);
    let is_open = has_children && ctx.expanded.iter().any(|key| key == &item.id);
    let is_selected = ctx.selected.iter().any(|key| key == &item.id);
    let is_active = ctx.active.as_ref() == Some(&item.id);
    let is_loading = ctx.loading.iter().any(|key| key == &item.id);
    let children_loaded = !item.children.is_empty();
    // No selection at all is the common case: skip the per-node subtree walk.
    let selection = if ctx.selected.is_empty() {
        TreeSelectionState::None
    } else {
        tree_selection_state(&ctx.selected, &tree_subtree_keys(item))
    };
    let indent = ctx.indent as usize;

    // ── row parts ────────────────────────────────────────────────────────
    let mut parts: Vec<Element> = Vec::new();

    if depth > 0 {
        parts.push(rsx! {
            span {
                class: "hk-tree-indent",
                style: format!("width:{}px", depth * indent),
            }
        });
    }

    let toggle_wiring = ctx.wiring.clone();
    let toggle_id = item.id.clone();
    let toggle_open = is_open;
    let toggle_loaded = children_loaded;
    // Vue stops the toggle's click so the row handler never doubles it up.
    let toggle_click = move |event: MouseEvent| {
        event.stop_propagation();
        if !has_children {
            return;
        }
        toggle_wiring.request(&toggle_id, toggle_open, toggle_loaded);
    };
    parts.push(rsx! {
        span {
            class: "hk-tree-toggle",
            "data-parent": has_children.then_some(""),
            "data-open": is_open.then_some(""),
            "data-loading": is_loading.then_some(""),
            onclick: toggle_click,
            if has_children {
                {svg_host(if is_open { CHEVRON_OPEN_SVG } else { CHEVRON_SVG })}
            } else {
                span { class: "hk-tree-leaf" }
            }
        }
    });

    if let Some(icon) = item.icon {
        let mut icon_classes = String::from("hk-tree-icon");
        if !item.icon_class.is_empty() {
            icon_classes.push(' ');
            icon_classes.push_str(&item.icon_class);
        }
        parts.push(rsx! {
            span {
                class: icon_classes,
                {Icon(IconProps { icon, size: 13, ..Default::default() })}
            }
        });
    }

    let label = tree_label_parts(item);
    parts.push(rsx! {
        span {
            class: "hk-tree-label",
            if let Some(tag) = label.tag {
                span { class: "hk-tree-label-tag",
                    {tag}
                }
            }
            if label.separator {
                " "
            }
            {label.text}
        }
    });

    // ── the row ──────────────────────────────────────────────────────────
    let row_wiring = ctx.wiring.clone();
    let row_id = item.id.clone();
    let row_has_children = has_children;
    let row_open = is_open;
    let row_loaded = children_loaded;
    let row_click = move |_event: MouseEvent| {
        row_wiring.select(&row_id);
        row_wiring.activate(&row_id);
        if row_wiring.expand_on_click && row_has_children {
            row_wiring.request(&row_id, row_open, row_loaded);
        }
    };

    let row = rsx! {
        div {
            class: "hk-tree-row",
            // `aria-activedescendant` on the root points here, so the row id is
            // the host-prefixed item id.
            id: format!("{}{}", ctx.id_prefix, item.id),
            "role": "treeitem",
            "aria-level": depth + 1,
            "data-status": item.status.as_deref(),
            "data-selected": is_selected.then_some(""),
            "aria-selected": is_selected.then_some("true"),
            "data-selection": selection.data_selection(),
            "data-loading": is_loading.then_some(""),
            "data-active": is_active.then_some(""),
            onclick: row_click,
            ..parts
        }
    };

    // ── the node (row + its open children) ───────────────────────────────
    let mut node = VElement::new("div")
        .class("hk-tree-node")
        .key(item.id.as_str());
    node = node.child(row);
    if has_children && is_open {
        let children: Vec<Element> = item
            .children
            .iter()
            .map(|child| render_tree_node(child, depth + 1, ctx))
            .collect();
        // Vue: `guideLeft = depth * indent + 16`.
        let guide_left = depth * indent + 16;
        node = node.child(rsx! {
            div {
                class: "hk-tree-children",
                style: format!("--guide-left:{guide_left}px"),
                ..children
            }
        });
    }
    VNode::Element(Box::new(node))
}

#[component]
pub fn Tree(props: TreeProps) -> Element {
    let ctx = TreeRenderContext {
        expanded: props.expanded_keys.clone(),
        selected: props.selected_keys.clone(),
        loading: props.loading_keys.clone(),
        active: props.active_key.clone(),
        id_prefix: props.id_prefix.clone(),
        indent: props.indent,
        wiring: TreeWiring {
            on_select: props.on_select.clone(),
            on_toggle: props.on_toggle.clone(),
            on_load: props.on_load.clone(),
            on_active_change: props.on_active_change.clone(),
            expand_on_click: props.expand_on_click,
            lazy: props.lazy,
        },
    };

    let nodes: Vec<Element> = props
        .nodes
        .iter()
        .map(|item| render_tree_node(item, 0, &ctx))
        .collect();

    let active_id = props
        .active_key
        .as_ref()
        .map(|key| format!("{}{}", props.id_prefix, key));
    let visible = tree_visible_rows(&props.nodes, &props.expanded_keys);
    let key_wiring = ctx.wiring.clone();
    let active_for_keys = props.active_key.clone();

    let keydown = move |event: KeyboardEvent| {
        let action = tree_keydown_action(&event.key, active_for_keys.as_deref(), &visible);
        if matches!(action, TreeKeyAction::None) {
            return;
        }
        event.prevent_default();
        match action {
            TreeKeyAction::Move(id) => key_wiring.activate(&id),
            TreeKeyAction::Expand(id) => {
                key_wiring.activate(&id);
                // The shell owes the children when the row is a lazy parent
                // with nothing loaded (the cursor path must agree with the
                // pointer path).
                let loaded = visible
                    .iter()
                    .find(|row| row.id == id)
                    .map(|row| row.children_loaded)
                    .unwrap_or(true);
                key_wiring.request(&id, false, loaded);
            }
            TreeKeyAction::Collapse(id) => key_wiring.toggle(&id),
            TreeKeyAction::Select(id) => {
                key_wiring.activate(&id);
                key_wiring.select(&id);
            }
            TreeKeyAction::None => {}
        }
    };

    let mut root_classes = String::from("hk-tree");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    rsx! {
        div {
            class: root_classes,
            "data-size": props.size.data_size(),
            "role": "tree",
            tabindex: 0,
            "aria-activedescendant": active_id,
            onkeydown: keydown,
            ..nodes
        }
    }
}

impl StyledComponent for TreeComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-tree*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTree.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "tree"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_nodes() -> Vec<TreeItem> {
        vec![
            TreeItem::new("app", "App").children(vec![
                TreeItem::new("app-api", "API"),
                TreeItem::new("app-worker", "Worker")
                    .children(vec![TreeItem::new("app-worker-jobs", "Jobs")]),
            ]),
            TreeItem::new("docs", "Docs"),
        ]
    }

    #[test]
    fn tree_size_tokens_match_the_vue_data_size() {
        assert_eq!(TreeSize::Xs.data_size(), "xs");
        assert_eq!(TreeSize::Sm.data_size(), "sm");
        assert_eq!(TreeSize::Md.data_size(), "md");
    }

    #[test]
    fn tree_props_defaults_match_the_vue_props() {
        let props = TreeProps::default();
        assert!(props.nodes.is_empty());
        // Vue's HkTree default size is `sm` (not the crate-wide `md`).
        assert_eq!(props.size, TreeSize::Sm);
        assert_eq!(props.indent, 16);
        assert!(!props.expand_on_click);
        assert!(props.expanded_keys.is_empty());
        assert!(props.selected_keys.is_empty());
        assert_eq!(props.active_key, None);
        assert!(!props.lazy);
        assert!(props.loading_keys.is_empty());
        assert_eq!(props.id_prefix, "");
        assert_eq!(props.class, "");
        assert!(props.on_toggle.is_none());
        assert!(props.on_select.is_none());
        assert!(props.on_active_change.is_none());
        assert!(props.on_load.is_none());
    }

    #[test]
    fn tree_has_children_covers_loaded_and_lazy_parents() {
        assert!(!tree_has_children(&TreeItem::new("leaf", "Leaf")));
        assert!(tree_has_children(
            &TreeItem::new("parent", "P").children(vec![TreeItem::new("child", "C")])
        ));
        // The lazy shell: a declared parent with nothing loaded yet.
        assert!(tree_has_children(&TreeItem::new("lazy", "L").expandable()));
    }

    #[test]
    fn tree_label_parts_follow_the_vue_precedence() {
        // Plain label.
        let plain = tree_label_parts(&TreeItem::new("a", "Alpha"));
        assert_eq!(
            plain,
            TreeLabelParts {
                tag: None,
                separator: false,
                text: "Alpha".to_string()
            }
        );
        // `tagLabel`: chip + space + plain label.
        let both = tree_label_parts(&TreeItem::new("a", "Alpha").tag_label("v2"));
        assert_eq!(
            both,
            TreeLabelParts {
                tag: Some("v2".to_string()),
                separator: true,
                text: "Alpha".to_string()
            }
        );
        // `tag`: the label IS the chip.
        let chipped = tree_label_parts(&TreeItem::new("a", "Alpha").tag());
        assert_eq!(
            chipped,
            TreeLabelParts {
                tag: Some("Alpha".to_string()),
                separator: false,
                text: String::new()
            }
        );
    }

    #[test]
    fn tree_expandable_keys_walk_parents_in_document_order() {
        assert_eq!(
            tree_expandable_keys(&sample_nodes()),
            vec!["app".to_string(), "app-worker".to_string()],
            "parents only (a leaf is not an expand target), pre-order"
        );
        // A lazy parent counts even with nothing loaded.
        assert_eq!(
            tree_expandable_keys(&[TreeItem::new("lazy", "L").expandable()]),
            vec!["lazy".to_string()]
        );
        assert!(tree_expandable_keys(&[]).is_empty());
    }

    #[test]
    fn tree_ancestor_path_returns_the_chain_to_the_target() {
        assert_eq!(
            tree_ancestor_path(&sample_nodes(), "app-worker-jobs"),
            vec!["app".to_string(), "app-worker".to_string()]
        );
        assert_eq!(
            tree_ancestor_path(&sample_nodes(), "app-api"),
            vec!["app".to_string()]
        );
        // A root node has no ancestors, and neither has an unknown id.
        assert!(tree_ancestor_path(&sample_nodes(), "docs").is_empty());
        assert!(tree_ancestor_path(&sample_nodes(), "nope").is_empty());
    }

    #[test]
    fn tree_subtree_keys_include_the_node_and_its_descendants() {
        let nodes = sample_nodes();
        assert_eq!(
            tree_subtree_keys(&nodes[0]),
            vec![
                "app".to_string(),
                "app-api".to_string(),
                "app-worker".to_string(),
                "app-worker-jobs".to_string()
            ]
        );
        assert_eq!(tree_subtree_keys(&nodes[1]), vec!["docs".to_string()]);
    }

    #[test]
    fn tree_selection_state_rolls_up_a_subtree() {
        let keys = tree_subtree_keys(&sample_nodes()[0]);
        assert_eq!(tree_selection_state(&[], &keys), TreeSelectionState::None);
        assert_eq!(
            tree_selection_state(&["app-api".to_string()], &keys),
            TreeSelectionState::Partial
        );
        let mut all = keys.clone();
        all.sort();
        assert_eq!(tree_selection_state(&all, &keys), TreeSelectionState::All);
        // No keys at all is not "all selected".
        assert_eq!(tree_selection_state(&[], &[]), TreeSelectionState::None);
        assert_eq!(
            TreeSelectionState::Partial.data_selection(),
            Some("partial")
        );
        assert_eq!(TreeSelectionState::All.data_selection(), Some("all"));
        assert_eq!(TreeSelectionState::None.data_selection(), None);
    }

    #[test]
    fn tree_visible_rows_descend_only_into_open_parents() {
        let depth_first = tree_visible_rows(&sample_nodes(), &[]);
        assert_eq!(
            depth_first
                .iter()
                .map(|row| (row.id.as_str(), row.depth))
                .collect::<Vec<_>>(),
            vec![("app", 0), ("docs", 0)],
            "everything collapsed: the roots only"
        );

        let opened = tree_visible_rows(&sample_nodes(), &["app".to_string()]);
        assert_eq!(
            opened
                .iter()
                .map(|row| (row.id.as_str(), row.depth))
                .collect::<Vec<_>>(),
            vec![("app", 0), ("app-api", 1), ("app-worker", 1), ("docs", 0)]
        );
        // A leaf ignores an expanded key that names it.
        let leaf_expanded = tree_visible_rows(&sample_nodes(), &["docs".to_string()]);
        assert_eq!(leaf_expanded.len(), 2);
        assert!(!leaf_expanded[1].expanded);
        assert!(!leaf_expanded[1].has_children);
    }

    #[test]
    fn tree_keydown_walks_the_visible_rows() {
        let rows = tree_visible_rows(&sample_nodes(), &["app".to_string()]);
        let ids: Vec<&str> = rows.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(ids, vec!["app", "app-api", "app-worker", "docs"]);

        // No cursor yet: down / home land on the first row.
        assert_eq!(
            tree_keydown_action("ArrowDown", None, &rows),
            TreeKeyAction::Move("app".to_string())
        );
        assert_eq!(
            tree_keydown_action("ArrowDown", Some("app"), &rows),
            TreeKeyAction::Move("app-api".to_string())
        );
        assert_eq!(
            tree_keydown_action("ArrowUp", Some("app-api"), &rows),
            TreeKeyAction::Move("app".to_string())
        );
        // Ends do not wrap.
        assert_eq!(
            tree_keydown_action("ArrowDown", Some("docs"), &rows),
            TreeKeyAction::None
        );
        assert_eq!(
            tree_keydown_action("ArrowUp", Some("app"), &rows),
            TreeKeyAction::None
        );
        assert_eq!(
            tree_keydown_action("End", Some("app"), &rows),
            TreeKeyAction::Move("docs".to_string())
        );
        assert_eq!(
            tree_keydown_action("Home", Some("docs"), &rows),
            TreeKeyAction::Move("app".to_string())
        );
        // Enter / Space select.
        assert_eq!(
            tree_keydown_action("Enter", Some("app-api"), &rows),
            TreeKeyAction::Select("app-api".to_string())
        );
        assert_eq!(
            tree_keydown_action(" ", Some("app-api"), &rows),
            TreeKeyAction::Select("app-api".to_string())
        );
        // Anything else is not a cursor key.
        assert_eq!(
            tree_keydown_action("a", Some("app"), &rows),
            TreeKeyAction::None
        );
    }

    #[test]
    fn tree_keydown_expands_and_collapses_like_the_wai_aitree_pattern() {
        let rows = tree_visible_rows(&sample_nodes(), &["app".to_string()]);
        // Closed parent → open it.
        assert_eq!(
            tree_keydown_action("ArrowRight", Some("app-worker"), &rows),
            TreeKeyAction::Expand("app-worker".to_string())
        );
        // Open parent → step into its first child.
        assert_eq!(
            tree_keydown_action("ArrowRight", Some("app"), &rows),
            TreeKeyAction::Move("app-api".to_string())
        );
        // A leaf goes nowhere on ArrowRight.
        assert_eq!(
            tree_keydown_action("ArrowRight", Some("app-api"), &rows),
            TreeKeyAction::None
        );
        // Open parent → close it.
        assert_eq!(
            tree_keydown_action("ArrowLeft", Some("app"), &rows),
            TreeKeyAction::Collapse("app".to_string())
        );
        // Closed parent / leaf → step out to the parent row.
        assert_eq!(
            tree_keydown_action("ArrowLeft", Some("app-worker"), &rows),
            TreeKeyAction::Move("app".to_string())
        );
        assert_eq!(
            tree_keydown_action("ArrowLeft", Some("docs"), &rows),
            TreeKeyAction::None
        );
    }

    #[test]
    fn tree_styles_come_from_the_canonical_vue_sheet() {
        let css = TreeComponent::styles();
        assert!(
            css.contains(".hk-tree")
                && css.contains(".hk-tree-node")
                && css.contains(".hk-tree-row")
                && css.contains(".hk-tree-toggle")
                && css.contains(".hk-tree-chevron")
                && css.contains(".hk-tree-label-tag")
                && css.contains(".hk-tree-children"),
            "tree css must carry the vue row, toggle, label and guide classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored tree sheet"
        );
        // The retired legacy sheet's names must not come back.
        assert!(
            !css.contains("hk-tree-show-line") && !css.contains("hk-tree-checkbox"),
            "legacy tree classes are retired"
        );
    }

    #[test]
    fn tree_renders_nodes_with_indentation_and_a_guide_line() {
        let html = Tree(TreeProps {
            nodes: sample_nodes(),
            expanded_keys: vec!["app".to_string()],
            indent: 16,
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-tree\"",
            "data-size=\"sm\"",
            "role=\"tree\"",
            "tabindex=\"0\"",
            "class=\"hk-tree-node\"",
            "class=\"hk-tree-row\"",
            "role=\"treeitem\"",
            "aria-level=\"1\"",
            "aria-level=\"2\"",
            "class=\"hk-tree-toggle\"",
            "data-parent=\"\"",
            // The open parent's chevron carries `data-open` (the rotate hook).
            "data-open=\"\"",
            "hk-tree-chevron",
            "class=\"hk-tree-indent\"",
            // depth 1 × indent 16.
            "style=\"width:16px\"",
            "class=\"hk-tree-children\"",
            // depth 0 × indent 16 + 16.
            "style=\"--guide-left:16px\"",
            "class=\"hk-tree-label\"",
            ">API<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Collapsed sibling stays out of the DOM; the closed parent shows the
        // leaf-less chevron without `data-open`.
        assert!(!html.contains(">Jobs<"), "{html}");
        // No invented checkbox markup on the tree rows.
        assert!(!html.contains("hk-tree-checkbox"), "{html}");
    }

    #[test]
    fn tree_renders_selection_status_tags_and_the_lazy_shell() {
        let html = Tree(TreeProps {
            nodes: vec![
                TreeItem::new("run", "Build")
                    .status("running")
                    .tag_label("v2"),
                TreeItem::new("done", "Done").status("completed"),
                TreeItem::new("lazy", "Remote").expandable(),
            ],
            selected_keys: vec!["done".to_string()],
            loading_keys: vec!["lazy".to_string()],
            lazy: true,
            id_prefix: "tree-".to_string(),
            active_key: Some("run".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // Selection marker + the announced state.
            "data-selected=\"\"",
            "aria-selected=\"true\"",
            // Status paint tokens.
            "data-status=\"running\"",
            "data-status=\"completed\"",
            // Chip + plain label (Vue: `[tagSpan, " ", label]`).
            "hk-tree-label-tag",
            ">v2<",
            "Build</span>",
            // The prefixed row id backs `aria-activedescendant`.
            "id=\"tree-run\"",
            // Lazy shell: a parent chevron on an unloaded node + the fetch mark.
            "data-parent=\"\"",
            "data-loading=\"\"",
            // The keyboard cursor's row.
            "data-active=\"\"",
            // `aria-activedescendant` uses the host prefix.
            "aria-activedescendant=\"tree-run\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The selected leaf rolls up to `all` on its own subtree.
        assert!(html.contains("data-selection=\"all\""), "{html}");
    }
}
