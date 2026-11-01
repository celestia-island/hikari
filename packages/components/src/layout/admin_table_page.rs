// hi-components/src/layout/admin_table_page.rs
// AdminTablePage — mirror of the canonical Vue `HkAdminTablePage` (the CRUD
// table-page scaffold every admin roster hangs on).
//
// NO HIKARI SHEET, on purpose. The Vue component ships none either: it is pure
// composition — `HkPageHeader` supplies the page header, `HkAlert` /
// `HkSpinner` / `HkEmptyState` the three body generations, `HkCrossfade` the
// exchange between them and `HkCard` + `HkTable` the default card — and the
// only class it writes itself is the HOST-scoped pair
// `hk-admin-table-page-filter` / `hk-admin-table-page-body` (styled by the
// host, not by a component sheet). `styles()` therefore returns `""` and this
// file invents no CSS; the dress arrives from the mirrored primitives'
// registered sheets.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   div
//     ── title ──
//     div.hk-page-header                                  (mirrored PageHeader)
//       div.hk-page-header-main
//         h1.hk-page-header-title > span.hk-page-header-title-text {title}
//         p.hk-page-header-subtitle?                      (subtitle)
//       div.hk-page-header-actions {actions slot}
//     ── title empty but actions given ──
//     div (style: display:flex;justify-content:flex-end;
//                  margin-bottom:var(--space-16, 1rem))
//     ── filter slot ──
//     div.hk-admin-table-page-filter {filter}
//     ── stale_error && !error ──
//     div.hk-alert…                                       (mirrored Alert)
//     ── the three body generations, through the crossfade ──
//     div.hk-crossfade …                                   (mirrored Crossfade)
//       error            → div.hk-alert…                  (mirrored Alert)
//       loading && empty → div.hk-spinner-wrapper …       (mirrored Spinner, centered)
//       empty            → div.hk-empty-state--boxed …    (mirrored EmptyState)
//                            {empty_action} inside div.hk-empty-action
//       body slot        → div.hk-admin-table-page-body {body}
//       else             → div.hk-card.hk-card-body-unpadded > table.hk-table…
//     {create_modal}
//     {edit_modal}
//
// STATE CONTRACT (ledger L48). Vue keeps NO local state at all: `rows`,
// `loading`, `error` and `staleError` are props. The only thing the mirror has
// to translate is the props' SHAPE — see the deltas — and the crossfade key,
// which is a pure function of those props here ([`admin_table_page_body_key`]),
// exactly like Vue's inline `swapKey` ternary.
//
// The error model is Vue's, unchanged: `error` is the HARD failure (no data —
// it replaces the table), while `stale_error` renders a banner ABOVE rows that
// are still on screen after a failed refresh, so a failed reload never hides
// data the user already had. The two are mutually exclusive by construction:
// the banner's precondition (rows on screen) is exactly what the error branch
// removes.
//
// Deltas vs Vue (documented, not accidental):
//   * ROWS AND COLUMNS ARE THE MIRRORED TABLE'S SHAPES. Vue forwards
//     `Record<string, unknown>[]` + `rowKey` and lets HTable read `row[rowKey]`;
//     the mirrored `HTable` is positional (`TableRow::cells`) and carries its
//     identity in `TableRow::key`. So the page takes `Vec<TableRow>` /
//     `Vec<TableColumn>` and has NO `row_key` prop — the key rides each row
//     (see `data/table.rs`'s own migration note).
//   * NO PER-CELL SLOTS (`cell-<key>`): they are not mirrored by the table this
//     wave (a cell is text), so the page cannot forward them either. The `body`
//     slot is the escape hatch for custom compounds.
//   * `manageable` is a BOOLEAN (Vue: `boolean | HkRowManageGate`); the per-row
//     verdict rides `TableRow::manage`, because a function prop cannot be a
//     `PartialEq` props field (the table mirror's rule).
//   * `on_manage` carries the resolved row KEY (Vue: `(row, opener)`), and
//     `on_reorder` carries the table mirror's [`TableReorder`] payload (Vue:
//     `(fromIndex, toIndex)`).
//   * `icon` is an Element (Vue: a `Component`), rendered by the mirrored
//     `PageHeader` inside `span.hk-page-header-icon`.
//   * No `HkPlaceholderMarquee`/page transition machinery beyond the mirrored
//     crossfade: the exchange itself is Vue's (`HkCrossfade`), driven by the
//     `swap_key` below.
//
// Behaviour taken from the Vue component: the empty title falls back to the
// i18n default (`emptyTitle || t("…")`), the loading branch only renders while
// there are NO rows (a refresh keeps the table and shows the stale banner
// instead), and the two modal slots render last so a dialog can cover the card.

use hikari_i18n::t;

use crate::basic::{Card, CardProps};
use crate::data::{Table, TableColumn, TableProps, TableReorder, TableRow};
use crate::display::{Crossfade, CrossfadeProps, EmptyState, EmptyStateProps};
use crate::feedback::{Alert, AlertProps, Spinner, SpinnerProps};
use crate::layout::page_header::{PageHeader, PageHeaderProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AdminTablePageComponent;

/// Which generation the scaffold's body is on (Vue's inline `swapKey`
/// ternary). The crossfade's key: `loading` and `empty` collapse into ONE
/// `placeholder` generation — spinner → empty is a data arrival, not a slot
/// identity change worth animating.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AdminTablePageBodyKey {
    Error,
    #[default]
    Placeholder,
    Content,
}

impl AdminTablePageBodyKey {
    /// The `data-crossfade-key` / `swap_key` string exactly as Vue emits it.
    pub fn as_str(self) -> &'static str {
        match self {
            AdminTablePageBodyKey::Error => "error",
            AdminTablePageBodyKey::Placeholder => "placeholder",
            AdminTablePageBodyKey::Content => "content",
        }
    }
}

/// Which branch the body RENDERS (the key above collapses two of them).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AdminTablePageBody {
    /// The hard failure: an alert replaces everything.
    Error,
    /// No rows yet and a fetch in flight: the centered spinner.
    Loading,
    /// No rows and no fetch: the boxed empty state.
    Empty,
    /// Rows on screen through the host's `body` slot.
    Body,
    /// Rows on screen through the default `HkCard` + `HkTable`.
    Table,
}

/// Vue's `swapKey` ternary. `loading` is accepted (the caller has it at hand
/// and Vue's expression reads it) but does NOT change the key: loading and
/// empty are one `placeholder` generation by design — spinner → empty is a data
/// arrival, not a slot identity change worth animating.
pub fn admin_table_page_body_key(
    error: Option<&str>,
    _loading: bool,
    row_count: usize,
) -> AdminTablePageBodyKey {
    if error.is_some() {
        return AdminTablePageBodyKey::Error;
    }
    if row_count == 0 {
        return AdminTablePageBodyKey::Placeholder;
    }
    AdminTablePageBodyKey::Content
}

/// The render branch: the same three-way gate, split where `loading` matters.
pub fn admin_table_page_body(
    error: Option<&str>,
    loading: bool,
    row_count: usize,
    has_body_slot: bool,
) -> AdminTablePageBody {
    if error.is_some() {
        return AdminTablePageBody::Error;
    }
    if row_count == 0 {
        return if loading {
            AdminTablePageBody::Loading
        } else {
            AdminTablePageBody::Empty
        };
    }
    if has_body_slot {
        AdminTablePageBody::Body
    } else {
        AdminTablePageBody::Table
    }
}

/// Which header band renders (Vue's ternary chain: the page header, the bare
/// right-aligned actions row, or nothing at all).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AdminTablePageHeader {
    /// A titled `HkPageHeader` with the actions slot on its right.
    Title,
    /// `title` is empty but the host passed actions: the right-aligned row.
    ActionsOnly,
    /// Neither: no band at all.
    None,
}

/// Vue's header ternary chain.
pub fn admin_table_page_header(title: &str, has_actions: bool) -> AdminTablePageHeader {
    if !title.is_empty() {
        AdminTablePageHeader::Title
    } else if has_actions {
        AdminTablePageHeader::ActionsOnly
    } else {
        AdminTablePageHeader::None
    }
}

/// Vue's `emptyTitle || t("…", "No data")`: an empty string falls through to
/// the i18n default.
pub fn admin_table_page_empty_title(empty_title: &str) -> String {
    if empty_title.is_empty() {
        t("components.hk.tablePage.emptyTitle", "No data")
    } else {
        empty_title.to_string()
    }
}

/// The stale banner is Vue's `staleError && !error`: it must never render
/// alongside the error branch.
pub fn admin_table_page_shows_stale_banner(stale_error: Option<&str>, error: Option<&str>) -> bool {
    match stale_error {
        Some(message) => error.is_none() && !message.is_empty(),
        None => false,
    }
}

/// Vue's bare-actions-row style (`display:flex;justify-content:flex-end;
/// margin-bottom:var(--space-16, 1rem)`), verbatim.
pub const ADMIN_TABLE_PAGE_ACTIONS_ROW_STYLE: &str =
    "display:flex;justify-content:flex-end;margin-bottom:var(--space-16, 1rem)";

#[define_props]
pub struct AdminTablePageProps {
    /// The page title; empty hides the page header (see [`AdminTablePageProps::actions`]).
    #[default]
    pub title: String,

    /// Secondary line under the title (forwarded to `PageHeader`).
    pub subtitle: Option<String>,

    /// Leading glyph node inside `span.hk-page-header-icon` (Vue: the `icon`
    /// Component prop).
    pub icon: Option<Element>,

    /// Compact page header (`hk-page-header-dense`).
    #[default]
    pub dense: bool,

    /// A fetch is in flight. Only renders the spinner while there are NO rows —
    /// a refresh keeps the table on screen.
    #[default]
    pub loading: bool,

    /// The hard failure: replaces the table entirely.
    pub error: Option<String>,

    /// A refresh failed while rows are still on screen: a banner ABOVE them.
    pub stale_error: Option<String>,

    /// The rows (see the header delta: the mirrored table's positional shape).
    #[default]
    pub rows: Vec<TableRow>,

    /// The columns.
    #[default]
    pub columns: Vec<TableColumn>,

    /// The empty state's heading; `""` falls back to the i18n default.
    #[default]
    pub empty_title: String,

    /// The empty state's supporting copy.
    pub empty_description: Option<String>,

    /// Left grip column with drag-to-reorder (forwarded to the table).
    #[default]
    pub draggable: bool,

    /// Trailing row-actions column (the per-row verdict rides
    /// `TableRow::manage`).
    #[default]
    pub manageable: bool,

    /// Page header actions (e.g. a "Create" button).
    pub actions: Option<Element>,

    /// Filter chrome (HkFilterBar) between the header and the table.
    pub filter: Option<Element>,

    /// Replaces the default table card wholesale (card-list rosters,
    /// multi-table compounds); the loading / error / empty generations still
    /// come from the scaffold.
    pub body: Option<Element>,

    /// Action inside the empty state (Retry, …).
    pub empty_action: Option<Element>,

    /// Create dialog, rendered after the table.
    pub create_modal: Option<Element>,

    /// Edit dialog, rendered after the table.
    pub edit_modal: Option<Element>,

    /// Fires with Vue's `reorder(from, to)` payload.
    pub on_reorder: Option<EventHandler<TableReorder>>,

    /// Fires with the resolved row key when a ⋯ trigger is pressed (Vue:
    /// `manage(row, opener)`).
    pub on_manage: Option<EventHandler<String>>,
}

#[component]
pub fn AdminTablePage(props: AdminTablePageProps) -> Element {
    let header = admin_table_page_header(&props.title, props.actions.is_some());
    let body = admin_table_page_body(
        props.error.as_deref(),
        props.loading,
        props.rows.len(),
        props.body.is_some(),
    );
    let swap_key =
        admin_table_page_body_key(props.error.as_deref(), props.loading, props.rows.len())
            .as_str()
            .to_string();
    let empty_title = admin_table_page_empty_title(&props.empty_title);
    let show_stale =
        admin_table_page_shows_stale_banner(props.stale_error.as_deref(), props.error.as_deref());

    // The header band: the mirrored PageHeader when titled, the bare row when
    // only actions were given.
    let header_band: Option<Element> = match header {
        AdminTablePageHeader::Title => Some(PageHeader(PageHeaderProps {
            title: props.title.clone(),
            subtitle: props.subtitle.clone(),
            icon: props.icon.clone(),
            dense: props.dense,
            actions: props.actions.clone(),
            ..Default::default()
        })),
        AdminTablePageHeader::ActionsOnly => Some(rsx! {
            div {
                style: ADMIN_TABLE_PAGE_ACTIONS_ROW_STYLE,
                {props.actions.clone().unwrap_or_else(empty_vnode)}
            }
        }),
        AdminTablePageHeader::None => None,
    };

    // The generation inside the crossfade.
    let generation: Element = match body {
        AdminTablePageBody::Error => Alert(AlertProps {
            message: props.error.clone().unwrap_or_default(),
            ..Default::default()
        }),
        AdminTablePageBody::Loading => Spinner(SpinnerProps {
            center: true,
            ..Default::default()
        }),
        AdminTablePageBody::Empty => EmptyState(EmptyStateProps {
            title: Some(empty_title),
            description: props.empty_description.clone(),
            boxed: true,
            action: props.empty_action.clone(),
            ..Default::default()
        }),
        AdminTablePageBody::Body => rsx! {
            div { class: "hk-admin-table-page-body",
                {props.body.clone().unwrap_or_else(empty_vnode)}
            }
        },
        AdminTablePageBody::Table => Card(CardProps {
            padded: false,
            children: Table(TableProps {
                columns: props.columns.clone(),
                rows: props.rows.clone(),
                draggable: props.draggable,
                manageable: props.manageable,
                on_reorder: props.on_reorder.clone(),
                on_manage: props.on_manage.clone(),
                ..Default::default()
            }),
            ..Default::default()
        }),
    };

    let stale_banner: Option<Element> = if show_stale {
        Some(Alert(AlertProps {
            message: props.stale_error.clone().unwrap_or_default(),
            ..Default::default()
        }))
    } else {
        None
    };

    rsx! {
        div {
            if let Some(band) = &header_band {
                {band.clone()}
            }
            if let Some(filter) = &props.filter {
                div { class: "hk-admin-table-page-filter", {filter.clone()} }
            }
            if let Some(banner) = &stale_banner {
                {banner.clone()}
            }
            {Crossfade(CrossfadeProps {
                swap_key,
                children: generation,
                ..Default::default()
            })}
            if let Some(modal) = &props.create_modal {
                {modal.clone()}
            }
            if let Some(modal) = &props.edit_modal {
                {modal.clone()}
            }
        }
    }
}

impl StyledComponent for AdminTablePageComponent {
    fn styles() -> &'static str {
        // The Vue scaffold ships no sheet of its own: it is pure composition,
        // and its two own classes (`hk-admin-table-page-*`) are host-scoped
        // hooks. See the file header.
        ""
    }

    fn name() -> &'static str {
        "admin-table-page"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn column(key: &str, title: &str) -> TableColumn {
        TableColumn {
            key: key.to_string(),
            title: title.to_string(),
            ..Default::default()
        }
    }

    fn row(id: &str, cells: Vec<&str>) -> TableRow {
        TableRow::new(cells).key(id)
    }

    #[test]
    fn admin_table_page_defaults_match_the_vue_props() {
        let props = AdminTablePageProps::default();
        assert_eq!(props.title, "");
        assert!(props.subtitle.is_none());
        assert!(props.icon.is_none());
        assert!(!props.dense);
        assert!(!props.loading);
        assert!(props.error.is_none());
        assert!(props.stale_error.is_none());
        assert!(props.rows.is_empty());
        assert!(props.columns.is_empty());
        assert_eq!(props.empty_title, "");
        assert!(props.empty_description.is_none());
        assert!(!props.draggable);
        assert!(!props.manageable);
        assert!(props.actions.is_none());
        assert!(props.filter.is_none());
        assert!(props.body.is_none());
        assert!(props.empty_action.is_none());
        assert!(props.create_modal.is_none());
        assert!(props.edit_modal.is_none());
        assert!(props.on_reorder.is_none());
        assert!(props.on_manage.is_none());
    }

    #[test]
    fn admin_table_page_body_key_matches_the_vue_ternary() {
        // A hard error wins the whole body.
        assert_eq!(
            admin_table_page_body_key(Some("boom"), false, 12),
            AdminTablePageBodyKey::Error
        );
        assert_eq!(
            admin_table_page_body_key(Some("boom"), true, 0),
            AdminTablePageBodyKey::Error
        );
        // Loading and empty collapse into ONE placeholder generation.
        assert_eq!(
            admin_table_page_body_key(None, true, 0),
            AdminTablePageBodyKey::Placeholder
        );
        assert_eq!(
            admin_table_page_body_key(None, false, 0),
            AdminTablePageBodyKey::Placeholder
        );
        // Rows on screen are the content generation, refreshing or not.
        assert_eq!(
            admin_table_page_body_key(None, true, 3),
            AdminTablePageBodyKey::Content
        );
        assert_eq!(AdminTablePageBodyKey::Error.as_str(), "error");
        assert_eq!(AdminTablePageBodyKey::Placeholder.as_str(), "placeholder");
        assert_eq!(AdminTablePageBodyKey::Content.as_str(), "content");
    }

    #[test]
    fn admin_table_page_body_branch_splits_loading_from_empty() {
        assert_eq!(
            admin_table_page_body(Some("boom"), true, 0, true),
            AdminTablePageBody::Error
        );
        assert_eq!(
            admin_table_page_body(None, true, 0, false),
            AdminTablePageBody::Loading
        );
        assert_eq!(
            admin_table_page_body(None, false, 0, false),
            AdminTablePageBody::Empty
        );
        // A body slot replaces the DEFAULT CARD only — never the three
        // non-content generations.
        assert_eq!(
            admin_table_page_body(None, false, 2, true),
            AdminTablePageBody::Body
        );
        assert_eq!(
            admin_table_page_body(None, false, 2, false),
            AdminTablePageBody::Table
        );
        assert_eq!(
            admin_table_page_body(None, false, 0, true),
            AdminTablePageBody::Empty
        );
    }

    #[test]
    fn admin_table_page_header_ternary_matches_vue() {
        assert_eq!(
            admin_table_page_header("Providers", false),
            AdminTablePageHeader::Title
        );
        assert_eq!(
            admin_table_page_header("Providers", true),
            AdminTablePageHeader::Title
        );
        assert_eq!(
            admin_table_page_header("", true),
            AdminTablePageHeader::ActionsOnly
        );
        assert_eq!(
            admin_table_page_header("", false),
            AdminTablePageHeader::None
        );
    }

    #[test]
    fn admin_table_page_empty_title_falls_back_to_the_i18n_default() {
        assert_eq!(admin_table_page_empty_title(""), "No data");
        assert_eq!(admin_table_page_empty_title("No providers"), "No providers");
    }

    #[test]
    fn admin_table_page_stale_banner_never_rides_the_error_branch() {
        assert!(admin_table_page_shows_stale_banner(Some("stale"), None));
        assert!(!admin_table_page_shows_stale_banner(
            Some("stale"),
            Some("boom")
        ));
        assert!(!admin_table_page_shows_stale_banner(None, None));
        assert!(!admin_table_page_shows_stale_banner(Some(""), None));
    }

    #[test]
    fn admin_table_page_renders_the_empty_generation() {
        let html = AdminTablePage(AdminTablePageProps {
            title: "Providers".to_string(),
            columns: vec![column("name", "Name")],
            rows: Vec::new(),
            empty_action: Some(rsx! { button { "Retry" } }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-page-header",
            "hk-page-header-title-text",
            "Providers",
            "hk-empty-state",
            "hk-empty-state--boxed",
            "No data",
            "hk-empty-action",
            "Retry",
            "data-crossfade-key=\"placeholder\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-table"), "{html}");
        assert!(!html.contains("hk-spinner"), "{html}");
    }

    #[test]
    fn admin_table_page_renders_the_spinner_only_without_rows() {
        let html = AdminTablePage(AdminTablePageProps {
            columns: vec![column("name", "Name")],
            loading: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-spinner"), "{html}");
        assert!(html.contains("hk-spinner-centered"), "{html}");
        assert!(!html.contains("hk-empty-state"), "{html}");
        assert!(!html.contains("hk-table"), "{html}");
    }

    #[test]
    fn admin_table_page_renders_the_error_generation() {
        let html = AdminTablePage(AdminTablePageProps {
            columns: vec![column("name", "Name")],
            rows: vec![row("a", vec!["A"])],
            error: Some("Request failed".to_string()),
            // A stale banner must NOT ride along with the hard error.
            stale_error: Some("stale".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("Request failed"), "{html}");
        assert!(html.contains("hk-alert"), "{html}");
        assert!(!html.contains("stale"), "{html}");
        assert!(!html.contains("hk-table"), "{html}");
        assert!(html.contains("data-crossfade-key=\"error\""), "{html}");
    }

    #[test]
    fn admin_table_page_renders_the_table_card_and_the_banners() {
        let html = AdminTablePage(AdminTablePageProps {
            title: "Providers".to_string(),
            columns: vec![column("name", "Name")],
            rows: vec![row("a", vec!["Alpha"]), row("b", vec!["Beta"])],
            stale_error: Some("Refresh failed".to_string()),
            filter: Some(rsx! { div { "filters" } }),
            actions: Some(rsx! { button { "Create" } }),
            create_modal: Some(rsx! { div { class: "create-dialog" } }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-page-header-actions",
            "Create",
            "class=\"hk-admin-table-page-filter\"",
            "Refresh failed",
            "hk-crossfade",
            "data-crossfade-key=\"content\"",
            "hk-card",
            "hk-card-body-unpadded",
            "hk-table",
            "Alpha",
            "create-dialog",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn admin_table_page_body_slot_replaces_the_default_card() {
        let html = AdminTablePage(AdminTablePageProps {
            columns: vec![column("name", "Name")],
            rows: vec![row("a", vec!["Alpha"])],
            body: Some(rsx! { div { class: "roster" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-admin-table-page-body"), "{html}");
        assert!(html.contains("roster"), "{html}");
        assert!(!html.contains("hk-table"), "{html}");
        assert!(!html.contains("hk-card"), "{html}");
    }

    #[test]
    fn admin_table_page_actions_only_band_matches_the_vue_row() {
        let html = AdminTablePage(AdminTablePageProps {
            actions: Some(rsx! { button { "Create" } }),
            rows: vec![row("a", vec!["Alpha"])],
            columns: vec![column("name", "Name")],
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(ADMIN_TABLE_PAGE_ACTIONS_ROW_STYLE),
            "the bare actions row keeps Vue's inline style: {html}"
        );
        assert!(!html.contains("hk-page-header"), "{html}");
        assert!(html.contains("Create"), "{html}");
    }

    #[test]
    fn admin_table_page_has_no_sheet_of_its_own() {
        assert_eq!(
            <AdminTablePageComponent as StyledComponent>::styles(),
            "",
            "the Vue scaffold ships no sheet; the mirror must invent none"
        );
        assert_eq!(
            <AdminTablePageComponent as StyledComponent>::name(),
            "admin-table-page"
        );
    }
}
