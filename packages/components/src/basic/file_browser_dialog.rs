// hi-components/src/basic/file_browser_dialog.rs
// FileBrowserDialog — mirror of the canonical Vue `HkFileBrowserDialog`: the
// remote half of the file-picker family. The host supplies the listing and
// this dialog renders the whole browsing surface inside the mirrored
// [`Modal`] frame: breadcrumb path bar with copy-path, quick-link chips, a
// layout toggle + type filter, the directory/file rows (list or grid), and a
// Cancel/Confirm footer.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFileBrowserDialog.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-file-browser-*` class names are literal
// and identical in both forms. The modal CHROME comes from the mirrored
// [`Modal`] (`feedback::modal`, `.hk-modal*`), exactly like Vue's `HModal`.
// DOM contract (mirrors the Vue render output):
//
//   div.hk-modal-root …                       (the Modal frame: header/footer)
//     div.hk-modal-body > … > div.hk-modal-body-inner
//       div.hk-file-browser
//         div.hk-file-browser-pathbar
//           nav.hk-file-browser-crumbs [aria-label]
//             span.hk-file-browser-crumb [data-current]   (the current dir)
//             button.hk-file-browser-crumb                (ancestors)
//           button.hk-file-browser-copy-path [aria-label] [title]
//             svg                                          (link glyph)
//         div.hk-file-browser-chips                          (quick links)
//           span.hk-file-browser-chips-label
//           button.hk-file-browser-chip [data-active]
//         div.hk-file-browser-toolbar
//           div.hk-file-browser-ops [role=group]
//             button.hk-file-browser-tool [data-op=refresh]
//           div.hk-file-browser-toolbar-side
//             div.hk-file-browser-filter > select           (type filter)
//             div.hk-file-browser-layout [role=group]
//               button.hk-file-browser-layout-btn [data-layout] [data-active]
//         div.hk-file-browser-entries [data-layout=list|grid]
//           div.hk-file-browser-loading                     (loading)
//           div.hk-file-browser-error [role=alert]          (load failure)
//           div.hk-file-browser-empty                       (healthy + empty)
//           div.hk-file-browser-list
//             div.hk-file-browser-list-head.hk-scroll-pin [data-side=top]
//             button.hk-file-browser-row [data-kind] [data-selected]
//                    [aria-pressed]
//               span.hk-file-browser-col-name|size|modified
//           div.hk-file-browser-grid                          (grid layout)
//             button.hk-file-browser-tile [data-kind] [data-selected]
//               span.hk-file-browser-tile-name
//               span.hk-file-browser-tile-meta
//     div.hk-modal-footer
//       div.hk-file-browser-footer
//         div.hk-file-browser-footer-form                   (footer_form slot)
//         div.hk-file-browser-footer-actions
//           button.hk-btn.hk-btn-secondary.hk-btn-md.hk-file-browser-cancel
//           button.hk-btn.hk-btn-primary.hk-btn-md.hk-file-browser-confirm
//
// Vue prop mapping: `modelValue` → [`FileBrowserDialogProps::open`],
// `update:modelValue` → [`FileBrowserDialogProps::on_close`], `confirm` →
// [`FileBrowserDialogProps::on_confirm`], `title` / `multiple` / `accept` /
// `initialPath`(→ `current_path`) / `quickLinks` / `pickDirectory` /
// `confirmLabel` / `cancelLabel` / `#footerForm` pass through under the same
// names. The glyphs are re-drawn to the same 24-unit lucide geometry Vue
// imports (`Link2` / `RotateCw` / `List` / `LayoutGrid`) — the Vue source
// imports lucide components, so it carries no literal path markup to copy —
// and every one rides `dangerous_inner_html` on a dedicated
// `display:contents` host (the crate-wide SVG rule).
//
// Behaviour deltas vs Vue (each one deliberate, none silent):
//   * THE ADAPTER IS GONE; THE HOST SUPPLIES THE LISTING. Vue takes a
//     `RemoteFsAdapter` and `await`s `adapter.list(path)` internally, then
//     sorts and stores the result. tairitsu 0.5.22 cannot await a host
//     promise, so the listing arrives as
//     [`FileBrowserDialogProps::entries`] together with the fetch status
//     (`loading` / `load_error`) and the host drives `on_navigate` /
//     `on_refresh` however it likes. The mirror still sorts exactly like Vue
//     (`sort_entries`: directories first, then name-ascending) and filters
//     through the same extension rule.
//   * EVERY PIECE OF VUE'S INTERNAL STATE IS A CONTROLLED PROP. `currentPath`
//     → `current_path`, `selected` (a `Set`) → `selected`, `layout`,
//     `filterExt`, `loading`, `loadError` all live in props; the mirror owns
//     nothing (no `use_signal`/`use_state` in this host) and reports through
//     `on_navigate` / `on_selection_change` / `on_layout_change` /
//     `on_filter_change` / `on_refresh` / `on_close`. Vue's open-watcher
//     session reset (re-seed path, drop selection/filter/clipboard on every
//     open) is therefore the HOST's job: the mirror never resets a prop.
//   * the FILE-MANAGEMENT TOOLBAR IS NOT MIRRORED. Vue's cut / copy / paste /
//     rename ops each need an async adapter mutation PLUS internal staging
//     state (the clipboard entry, the inline rename prompt and its validation
//     error). That is four async host calls and three more controlled values
//     for a flow this wave cannot complete; the entries area stays READ-ONLY
//     and only the always-available Refresh op ships. Hosts that need those
//     ops drive them outside the dialog (the sheet's `.hk-file-browser-tool`
//     styles remain available if they re-add the row).
//   * the TYPE FILTER degrades from `HkSelect` to a native `<select>` inside
//     the same `.hk-file-browser-filter` box: the mirrored `Select` needs
//     `open` + `highlighted_index` as two MORE controlled props of this
//     dialog, so the popout/sheet chrome is not worth the surface here. The
//     options, the "All" default and the extension match rule are Vue's; the
//     prune that drops names the fresh filter hides follows the selection to
//     the host (it owns `selected`), and `confirm_files` already skips names
//     the listing no longer shows.
//   * COPY-PATH DOES NOT WRITE THE CLIPBOARD. Vue calls
//     `useClipboardWithToast`; this host has no clipboard API, so the button
//     emits [`FileBrowserDialogProps::on_copy_path`] with the path and the
//     host (and its toast) decides.
//   * `formatModified` cannot localize. Vue renders epoch millis through
//     `formatDateTime`; the mirror has no locale/date formatter in this
//     crate, so [`format_modified`] passes an ISO string through verbatim
//     and renders a numeric/millis value as-is (documented degradation — the
//     host should hand over display strings).
//   * NO `HkScrollPin` CONTRACT. Vue imports `HkScrollPin.scss` and rides the
//     scroll host's gutter contract on the pinned list head; that sheet is not
//     mirrored in this wave, so the head keeps its `hk-file-browser-list-head
//     hk-scroll-pin` classes and `data-side`/`data-strategy` markers (so a host
//     that ships the layer gets the pin) but pins flush otherwise.
//   * no `<Teleport>` / focus trap / Escape-ownership: inherited from the
//     mirrored [`Modal`] (its header documents the same deltas). The rename
//     row's local Enter/Escape interception goes with the rename op.
//   * double-click activation is kept (`on_dblclick`): a double-click names
//     exactly ONE file and confirms immediately, even in `multiple` mode, the
//     same one-file-confirm Vue implements.

use hikari_i18n::t;

use crate::basic::button::{Button, ButtonSize, ButtonVariant};
use crate::basic::file_field::PickedFile;
use crate::feedback::modal::Modal;
use crate::feedback::spinner::{Spinner, SpinnerSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FileBrowserDialogComponent;

/// One row's kind (Vue: `"file" | "dir"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum RemoteEntryKind {
    #[default]
    File,
    Dir,
}

impl RemoteEntryKind {
    /// The `data-kind` token exactly as Vue emits it.
    pub fn data_value(self) -> &'static str {
        match self {
            RemoteEntryKind::File => "file",
            RemoteEntryKind::Dir => "dir",
        }
    }
}

/// One row in a remote directory listing (Vue: `RemoteFileEntry`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct RemoteFileEntry {
    pub name: String,
    pub kind: RemoteEntryKind,
    /// Byte size; directories usually omit it.
    pub size: Option<u64>,
    /// Best-effort display timestamp. Vue accepts an ISO string OR epoch
    /// millis; the mirror takes the string the host already formatted (see
    /// the header delta on `formatModified`).
    pub modified_at: Option<String>,
}

/// A bookmark chip above the toolbar (Vue: `FileQuickLink`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FileQuickLink {
    pub label: String,
    pub path: String,
}

/// One breadcrumb segment (Vue: the `breadcrumbs` computed).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FileBreadcrumb {
    pub name: String,
    pub path: String,
    /// The directory currently listed (rendered as a span, not a button).
    pub current: bool,
}

/// The entries layout (Vue: `BrowserLayout`, default `list`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum FileBrowserLayout {
    #[default]
    List,
    Grid,
}

impl FileBrowserLayout {
    /// The `data-layout` token exactly as Vue emits it.
    pub fn data_value(self) -> &'static str {
        match self {
            FileBrowserLayout::List => "list",
            FileBrowserLayout::Grid => "grid",
        }
    }
}

/// Vue's `joinPath`: a bare entry name onto a directory path (`"/" + "a"` →
/// `"/a"`, `"/a" + "b"` → `"/a/b"`).
pub fn join_path(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

/// Vue's `compareEntries`: directories first, then name-ascending. Vue calls
/// `localeCompare`; the mirror uses the byte order, so the ordering is stable
/// across hosts instead of locale-dependent (documented delta).
pub fn sort_entries(entries: &[RemoteFileEntry]) -> Vec<RemoteFileEntry> {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|a, b| {
        let kind_order = match (a.kind, b.kind) {
            (RemoteEntryKind::Dir, RemoteEntryKind::File) => std::cmp::Ordering::Less,
            (RemoteEntryKind::File, RemoteEntryKind::Dir) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        };
        kind_order.then_with(|| a.name.cmp(&b.name))
    });
    sorted
}

/// Vue's `formatSize`: the picker's B / KB / MB / GB scale, `""` when the
/// size is unknown.
pub fn format_size(size: Option<u64>) -> String {
    let Some(size) = size else {
        return String::new();
    };
    const KB: f64 = 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    let bytes = size as f64;
    if bytes < KB {
        format!("{size} B")
    } else if bytes < MB {
        format!("{:.1} KB", bytes / KB)
    } else if bytes < GB {
        format!("{:.1} MB", bytes / MB)
    } else {
        format!("{:.1} GB", bytes / GB)
    }
}

/// Vue's `formatModified`, minus the locale formatter (header delta): the
/// host's display string passes through, an unknown timestamp renders `""`.
pub fn format_modified(modified_at: Option<&str>) -> String {
    modified_at.unwrap_or_default().to_string()
}

/// Vue's `acceptExtensions` (`filePicker.ts`): a native accept string
/// (`.csv,.json`) parsed into lowercase extensions. Parts without a leading
/// dot (MIME types, `image/*`) are dropped, exactly like Vue.
pub fn accept_extensions(accept: Option<&str>) -> Vec<String> {
    let Some(accept) = accept else {
        return Vec::new();
    };
    accept
        .split(',')
        .map(|part| part.trim().to_lowercase())
        .filter(|part| part.starts_with('.'))
        .collect()
}

/// Vue's `visibleEntries`: with an active filter, directories always pass and
/// a file must end with the (lowercased) extension.
pub fn visible_entries(entries: &[RemoteFileEntry], filter_ext: &str) -> Vec<RemoteFileEntry> {
    let sorted = sort_entries(entries);
    if filter_ext.is_empty() {
        return sorted;
    }
    let ext = filter_ext.to_lowercase();
    sorted
        .into_iter()
        .filter(|entry| {
            entry.kind == RemoteEntryKind::Dir || entry.name.to_lowercase().ends_with(&ext)
        })
        .collect()
}

/// Vue's `breadcrumbs` computed: the root, then one crumb per path segment.
pub fn breadcrumbs(path: &str) -> Vec<FileBreadcrumb> {
    let mut crumbs = vec![FileBreadcrumb {
        name: "/".to_string(),
        path: "/".to_string(),
        current: path == "/",
    }];
    let mut accumulated = String::new();
    for part in path.split('/') {
        if part.is_empty() {
            continue;
        }
        accumulated.push('/');
        accumulated.push_str(part);
        crumbs.push(FileBreadcrumb {
            name: part.to_string(),
            path: accumulated.clone(),
            current: accumulated == path,
        });
    }
    crumbs
}

/// Vue's `onEntryClick` selection rule: `multiple` toggles one name,
/// single-select replaces (and a second click on the only name clears it).
pub fn toggle_selection(selected: &[String], name: &str, multiple: bool) -> Vec<String> {
    let mut next: Vec<String> = selected.to_vec();
    if multiple {
        if let Some(index) = next.iter().position(|candidate| candidate == name) {
            next.remove(index);
        } else {
            next.push(name.to_string());
        }
        return next;
    }
    if next.len() == 1 && next[0] == name {
        return Vec::new();
    }
    vec![name.to_string()]
}

/// Vue's confirmed-file shape for one entry: the listing path + the entry's
/// name and (optional) size.
pub fn confirmed_entry(current_path: &str, entry: &RemoteFileEntry) -> PickedFile {
    PickedFile {
        name: entry.name.clone(),
        path: Some(join_path(current_path, &entry.name)),
        size: entry.size,
    }
}

/// Vue's `confirmSelection` (file mode): map the selected names onto the
/// listing, in LISTING order (Vue walks its insertion-ordered `Set`; the
/// sorted listing is the deterministic equivalent), skipping names the fresh
/// listing no longer shows. Vue does not re-check the entry kind, so neither
/// does the mirror — a directory name can only be selected by a host that put
/// it there itself.
pub fn confirm_files(
    current_path: &str,
    entries: &[RemoteFileEntry],
    selected: &[String],
) -> Vec<PickedFile> {
    entries
        .iter()
        .filter(|entry| selected.iter().any(|name| name == &entry.name))
        .map(|entry| confirmed_entry(current_path, entry))
        .collect()
}

/// Vue's directory-mode pick: the folder currently listed IS the choice, and
/// its bare leaf name is the display name (`/` keeps `/`).
pub fn directory_pick(current_path: &str) -> PickedFile {
    let trimmed = current_path.trim_end_matches('/');
    let name = trimmed
        .split('/')
        .rfind(|part: &&str| !part.is_empty())
        .unwrap_or("/");
    PickedFile {
        name: name.to_string(),
        path: Some(current_path.to_string()),
        size: None,
    }
}

/// Vue's confirm-button gate: disabled while no file is selected (directory
/// mode always has an answer — the listed folder).
pub fn confirm_disabled(pick_directory: bool, selected_len: usize) -> bool {
    !pick_directory && selected_len == 0
}

/// Vue's tile meta line: `[size, modified].filter(Boolean).join(" · ")`.
pub fn tile_meta(entry: &RemoteFileEntry) -> String {
    let size = if entry.kind == RemoteEntryKind::File {
        format_size(entry.size)
    } else {
        String::new()
    };
    let modified = format_modified(entry.modified_at.as_deref());
    [size, modified]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" · ")
}

/// The path-bar copy glyph (lucide `Link2`, 14px — the size Vue passes).
const LINK_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>"#;

/// The refresh glyph (lucide `RotateCw`, 16px).
const ROTATE_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>"#;

/// The list-layout glyph (lucide `List`, 16px).
const LIST_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>"#;

/// The grid-layout glyph (lucide `LayoutGrid`, 16px).
const LAYOUT_GRID_SVG: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>"#;

#[define_props]
pub struct FileBrowserDialogProps {
    /// Controlled open state (Vue: `modelValue`, required).
    #[default]
    pub open: bool,

    /// Header title; falls back to the localized default.
    pub title: Option<String>,

    /// The directory currently listed (Vue: internal `currentPath`, seeded by
    /// `initialPath`).
    #[default("/".to_string())]
    pub current_path: String,

    /// The listing, fetched by the host (see the header delta on the adapter).
    pub entries: Vec<RemoteFileEntry>,

    /// Busy flag while the host fetches (Vue: `loading`).
    #[default]
    pub loading: bool,

    /// Last lister failure message; `None`/empty = healthy (Vue: `loadError`).
    pub load_error: Option<String>,

    /// Selected entry NAMES (Vue: internal `Set`); directories never select.
    pub selected: Vec<String>,

    /// Allow multi-selection (a file click toggles instead of replacing).
    #[default]
    pub multiple: bool,

    /// Native accept string driving the type filter (`.csv,.json`).
    pub accept: Option<String>,

    /// Active type filter: `""` = All, otherwise an extension (`.csv`).
    #[default]
    pub filter_ext: String,

    /// Entries layout (Vue: internal `layout`).
    #[default]
    pub layout: FileBrowserLayout,

    /// Bookmark chips above the toolbar.
    pub quick_links: Vec<FileQuickLink>,

    /// Directory-picking mode: confirm chooses the folder currently listed
    /// (entries only navigate) instead of selecting files.
    #[default]
    pub pick_directory: bool,

    pub confirm_label: Option<String>,

    pub cancel_label: Option<String>,

    /// Extra form fields rendered ABOVE the footer action buttons (Vue:
    /// the `#footerForm` slot).
    pub footer_form: Option<Element>,

    /// Fired when the user asks to close (✕ / overlay / Esc / Cancel, and
    /// after a confirm). Vue's `update:modelValue(false)`.
    pub on_close: Option<EventHandler<MouseEvent>>,

    /// Fired with the requested directory (breadcrumb, chip, or a directory
    /// row click).
    pub on_navigate: Option<EventHandler<String>>,

    /// Fired with the whole next selection (a file click).
    pub on_selection_change: Option<EventHandler<Vec<String>>>,

    /// Fired with the chosen extension filter (or `""` for All).
    pub on_filter_change: Option<EventHandler<String>>,

    /// Fired with the requested layout.
    pub on_layout_change: Option<EventHandler<FileBrowserLayout>>,

    /// Fired on a Refresh press: the host re-lists the current path.
    pub on_refresh: Option<EventHandler<()>>,

    /// Fired with the path to copy (the mirror writes no clipboard).
    pub on_copy_path: Option<EventHandler<String>>,

    /// Fired with the confirmed files (Vue: the `confirm` emit).
    pub on_confirm: Option<EventHandler<Vec<PickedFile>>>,
}

/// A plain text child node.
fn text_node(text: &str) -> VNode {
    VNode::Text(VText::new(text))
}

/// One `span` cell of a list row / grid tile.
fn cell(class: &str, text: &str) -> VNode {
    VNode::Element(Box::new(
        VElement::new("span").class(class).child(text_node(text)),
    ))
}

/// One `option` row of the type-filter select (native control, see the
/// header delta).
fn filter_option(value: &str, label: &str, selected: bool) -> VNode {
    let mut option = VElement::new("option")
        .attr("value", value)
        .child(text_node(label));
    if selected {
        option = option.attr("selected", Some(""));
    }
    VNode::Element(Box::new(option))
}

/// The per-row click routing both layouts share. Cloned per row; it owns only
/// cheap values + the caller's callbacks (the listing itself is NOT captured —
/// double-click confirms the row it was built from).
#[derive(Clone)]
struct RowContext {
    current_path: String,
    selected: Vec<String>,
    multiple: bool,
    pick_directory: bool,
    on_navigate: Option<EventHandler<String>>,
    on_selection_change: Option<EventHandler<Vec<String>>>,
    on_confirm: Option<EventHandler<Vec<PickedFile>>>,
    on_close: Option<EventHandler<MouseEvent>>,
}

impl RowContext {
    /// Vue's `onEntryClick`: a directory navigates, a file toggles selection
    /// (and does nothing at all while picking a directory).
    fn entry_click(&self, entry: &RemoteFileEntry, path: &str) {
        if entry.kind == RemoteEntryKind::Dir {
            if let Some(handler) = self.on_navigate.as_ref() {
                handler.call(path.to_string());
            }
            return;
        }
        if self.pick_directory {
            return;
        }
        let next = toggle_selection(&self.selected, &entry.name, self.multiple);
        if let Some(handler) = self.on_selection_change.as_ref() {
            handler.call(next);
        }
    }

    /// Vue's `onEntryActivate`: a double-click names ONE file and confirms it
    /// immediately, then closes.
    fn entry_activate(&self, entry: &RemoteFileEntry) {
        if entry.kind != RemoteEntryKind::File || self.pick_directory {
            return;
        }
        if let Some(handler) = self.on_confirm.as_ref() {
            handler.call(vec![confirmed_entry(&self.current_path, entry)]);
        }
        if let Some(handler) = self.on_close.as_ref() {
            handler.call(MouseEvent::default());
        }
    }

    fn row(&self, entry: &RemoteFileEntry) -> VNode {
        let is_selected = self
            .selected
            .iter()
            .any(|candidate| candidate == &entry.name);
        let path = join_path(&self.current_path, &entry.name);
        let size_text = if entry.kind == RemoteEntryKind::File {
            format_size(entry.size)
        } else {
            "—".to_string()
        };
        let modified_text = format_modified(entry.modified_at.as_deref());

        let click = {
            let context = self.clone();
            let entry = entry.clone();
            let path = path.clone();
            move |_: MouseEvent| context.entry_click(&entry, &path)
        };
        let activate = {
            let context = self.clone();
            let entry = entry.clone();
            move |_: MouseEvent| context.entry_activate(&entry)
        };

        let row = VElement::new("button")
            .attr("type", "button")
            .class("hk-file-browser-row")
            .attr("data-kind", entry.kind.data_value())
            .attr("data-selected", if is_selected { Some("") } else { None })
            .attr("aria-pressed", if is_selected { "true" } else { "false" })
            .on_click(click)
            .on_dblclick(activate)
            .key(&entry.name)
            .child(cell("hk-file-browser-col-name", &entry.name))
            .child(cell("hk-file-browser-col-size", &size_text))
            .child(cell("hk-file-browser-col-modified", &modified_text));
        VNode::Element(Box::new(row))
    }

    fn tile(&self, entry: &RemoteFileEntry) -> VNode {
        let is_selected = self
            .selected
            .iter()
            .any(|candidate| candidate == &entry.name);
        let path = join_path(&self.current_path, &entry.name);
        let meta = tile_meta(entry);

        let click = {
            let context = self.clone();
            let entry = entry.clone();
            let path = path.clone();
            move |_: MouseEvent| context.entry_click(&entry, &path)
        };
        let activate = {
            let context = self.clone();
            let entry = entry.clone();
            move |_: MouseEvent| context.entry_activate(&entry)
        };

        let tile = VElement::new("button")
            .attr("type", "button")
            .class("hk-file-browser-tile")
            .attr("data-kind", entry.kind.data_value())
            .attr("data-selected", if is_selected { Some("") } else { None })
            .attr("aria-pressed", if is_selected { "true" } else { "false" })
            .on_click(click)
            .on_dblclick(activate)
            .key(&entry.name)
            .child(cell("hk-file-browser-tile-name", &entry.name))
            .child(cell("hk-file-browser-tile-meta", &meta));
        VNode::Element(Box::new(tile))
    }
}

#[component]
pub fn FileBrowserDialog(props: FileBrowserDialogProps) -> Element {
    let pick_directory = props.pick_directory;
    let multiple = props.multiple;
    let layout = props.layout;
    let current_path = props.current_path.clone();
    let selected = props.selected.clone();
    let load_error = props.load_error.clone().filter(|text| !text.is_empty());
    let sorted_entries = sort_entries(&props.entries);
    let rows = visible_entries(&props.entries, &props.filter_ext);
    let extensions = accept_extensions(props.accept.as_deref());
    let crumbs = breadcrumbs(&current_path);

    let on_close = props.on_close.clone();
    let on_navigate = props.on_navigate.clone();
    let on_selection_change = props.on_selection_change.clone();
    let on_confirm = props.on_confirm.clone();
    let on_refresh = props.on_refresh.clone();
    let on_filter_change = props.on_filter_change.clone();
    let on_layout_change = props.on_layout_change.clone();
    let on_copy_path = props.on_copy_path.clone();

    let title = props
        .title
        .clone()
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| {
            if pick_directory {
                t("hikari::filePicker.titleFolder", "Browse folders")
            } else {
                t("hikari::filePicker.title", "Browse files")
            }
        });

    // ── path bar ────────────────────────────────────────────────────────────
    let mut crumb_nodes: Vec<VNode> = Vec::new();
    for crumb in &crumbs {
        if crumb.current {
            crumb_nodes.push(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-file-browser-crumb")
                    .attr("data-current", Some(""))
                    .child(text_node(&crumb.name)),
            )));
        } else {
            let handler = on_navigate.clone();
            let target = crumb.path.clone();
            let label = crumb.name.clone();
            crumb_nodes.push(VNode::Element(Box::new(
                VElement::new("button")
                    .attr("type", "button")
                    .class("hk-file-browser-crumb")
                    .on_click(move |_: MouseEvent| {
                        if let Some(handler) = handler.as_ref() {
                            handler.call(target.clone());
                        }
                    })
                    .child(text_node(&label)),
            )));
        }
    }
    let crumbs_label = t("hikari::filePicker.currentPath", "Current path");
    let copy_path_label = t("hikari::filePicker.copyPath", "Copy path");
    let copy_target = current_path.clone();
    let pathbar = {
        let handler = on_copy_path.clone();
        rsx! {
            div { class: "hk-file-browser-pathbar",
                nav { class: "hk-file-browser-crumbs", "aria-label": crumbs_label,
                    {VNode::Fragment(crumb_nodes)}
                }
                button {
                    class: "hk-file-browser-copy-path",
                    "type": "button",
                    "aria-label": copy_path_label.clone(),
                    title: copy_path_label.clone(),
                    onclick: move |_: MouseEvent| {
                        if let Some(handler) = handler.as_ref() {
                            handler.call(copy_target.clone());
                        }
                    },
                    div {
                        style: "display:contents",
                        dangerous_inner_html: LINK_SVG,
                    }
                }
            }
        }
    };

    // ── quick-link chips ────────────────────────────────────────────────────
    // Vue renders the row only when `quickLinks` is non-empty; `empty_vnode()`
    // is the crate's "render nothing" node, so the body keeps one child shape.
    let chips_row = if props.quick_links.is_empty() {
        empty_vnode()
    } else {
        let mut chips: Vec<VNode> = vec![VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-file-browser-chips-label")
                .child(text_node(&t(
                    "hikari::filePicker.quickLinks",
                    "Quick links",
                ))),
        ))];
        for link in &props.quick_links {
            let handler = on_navigate.clone();
            let target = link.path.clone();
            let active = link.path == current_path;
            let mut chip = VElement::new("button")
                .attr("type", "button")
                .class("hk-file-browser-chip")
                .child(text_node(&link.label))
                .on_click(move |_: MouseEvent| {
                    if let Some(handler) = handler.as_ref() {
                        handler.call(target.clone());
                    }
                });
            if active {
                chip = chip.attr("data-active", Some(""));
            }
            chips.push(VNode::Element(Box::new(chip)));
        }
        rsx! {
            div {
                class: "hk-file-browser-chips",
                "aria-label": t("hikari::filePicker.quickLinks", "Quick links"),
                {VNode::Fragment(chips)}
            }
        }
    };

    // ── toolbar: refresh + type filter + layout toggle ──────────────────────
    // The file-management ops (cut/copy/paste/rename) are not mirrored — see
    // the header delta.
    let refresh_click = {
        let handler = on_refresh.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(());
            }
        }
    };
    let filter_control = if extensions.is_empty() {
        empty_vnode()
    } else {
        let mut options: Vec<VNode> = Vec::with_capacity(extensions.len() + 1);
        options.push(filter_option(
            "",
            &t("hikari::filePicker.filterAll", "All"),
            props.filter_ext.is_empty(),
        ));
        for ext in &extensions {
            options.push(filter_option(
                ext,
                ext,
                props.filter_ext.eq_ignore_ascii_case(ext),
            ));
        }
        let handler = on_filter_change.clone();
        rsx! {
            div { class: "hk-file-browser-filter",
                select {
                    class: "hk-file-browser-filter-select",
                    // The native control fills the sheet's 9rem filter box
                    // (header delta: HkSelect is not mounted here).
                    style: "width:100%",
                    "aria-label": t("hikari::filePicker.filterAll", "All"),
                    onchange: move |event: ChangeEvent| {
                        if let Some(handler) = handler.as_ref() {
                            handler.call(event.value.clone());
                        }
                    },
                    {VNode::Fragment(options)}
                }
            }
        }
    };
    let list_layout_label = t("hikari::filePicker.listLayout", "List");
    let grid_layout_label = t("hikari::filePicker.gridLayout", "Grid");
    let layout_list_click = {
        let handler = on_layout_change.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(FileBrowserLayout::List);
            }
        }
    };
    let layout_grid_click = {
        let handler = on_layout_change.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(FileBrowserLayout::Grid);
            }
        }
    };
    let toolbar = rsx! {
        div { class: "hk-file-browser-toolbar",
            div { class: "hk-file-browser-ops", "role": "group",
                button {
                    class: "hk-file-browser-tool",
                    "type": "button",
                    "data-op": "refresh",
                    "aria-label": t("hikari::filePicker.refresh", "Refresh"),
                    title: t("hikari::filePicker.refresh", "Refresh"),
                    onclick: refresh_click,
                    div {
                        style: "display:contents",
                        dangerous_inner_html: ROTATE_SVG,
                    }
                }
            }
            div { class: "hk-file-browser-toolbar-side",
                {filter_control}
                div { class: "hk-file-browser-layout", "role": "group",
                    button {
                        class: "hk-file-browser-layout-btn",
                        "type": "button",
                        "data-layout": "list",
                        "data-active": layout == FileBrowserLayout::List,
                        "aria-label": list_layout_label.clone(),
                        title: list_layout_label.clone(),
                        onclick: layout_list_click,
                        div {
                            style: "display:contents",
                            dangerous_inner_html: LIST_SVG,
                        }
                    }
                    button {
                        class: "hk-file-browser-layout-btn",
                        "type": "button",
                        "data-layout": "grid",
                        "data-active": layout == FileBrowserLayout::Grid,
                        "aria-label": grid_layout_label.clone(),
                        title: grid_layout_label.clone(),
                        onclick: layout_grid_click,
                        div {
                            style: "display:contents",
                            dangerous_inner_html: LAYOUT_GRID_SVG,
                        }
                    }
                }
            }
        }
    };

    // ── entries area ────────────────────────────────────────────────────────
    let row_context = RowContext {
        current_path: current_path.clone(),
        selected: selected.clone(),
        multiple,
        pick_directory,
        on_navigate: on_navigate.clone(),
        on_selection_change: on_selection_change.clone(),
        on_confirm: on_confirm.clone(),
        on_close: on_close.clone(),
    };
    let entries_area = if props.loading {
        rsx! {
            div { class: "hk-file-browser-loading",
                Spinner {
                    size: SpinnerSize::Sm,
                    center: true,
                    text: Some(t("hikari::filePicker.loading", "Loading…")),
                }
            }
        }
    } else {
        let mut nodes: Vec<VNode> = Vec::new();
        if let Some(error) = load_error.as_deref() {
            let list_error_label = t("hikari::filePicker.listError", "Failed to list directory");
            let error_text = format!("{list_error_label}: {error}");
            let retry_click = {
                let handler = on_refresh.clone();
                move |_: MouseEvent| {
                    if let Some(handler) = handler.as_ref() {
                        handler.call(());
                    }
                }
            };
            nodes.push(rsx! {
                div { class: "hk-file-browser-error", "role": "alert",
                    span { class: "hk-file-browser-error-text",
                        "{error_text}"
                    }
                    Button {
                        variant: ButtonVariant::Secondary,
                        size: ButtonSize::Sm,
                        class: "hk-file-browser-retry".to_string(),
                        onclick: Some(EventHandler::new(retry_click)),
                        children: text_node(&t("hikari::filePicker.retry", "Retry")),
                    }
                }
            });
        }
        if rows.is_empty() && load_error.is_none() {
            // An empty hint only means "empty" on a healthy listing — a
            // failed one stays silent so the error band speaks alone.
            nodes.push(rsx! {
                div { class: "hk-file-browser-empty",
                    {t("hikari::filePicker.empty", "This folder is empty")}
                }
            });
        } else if layout == FileBrowserLayout::List {
            let head = rsx! {
                div {
                    class: "hk-file-browser-list-head hk-scroll-pin",
                    "data-side": "top",
                    "data-strategy": "offset",
                    "aria-hidden": "true",
                    span { class: "hk-file-browser-col-name",
                        {t("hikari::filePicker.name", "Name")}
                    }
                    span { class: "hk-file-browser-col-size",
                        {t("hikari::filePicker.size", "Size")}
                    }
                    span { class: "hk-file-browser-col-modified",
                        {t("hikari::filePicker.modified", "Modified")}
                    }
                }
            };
            let mut list = VElement::new("div")
                .class("hk-file-browser-list")
                .child(head);
            for entry in &rows {
                list = list.child(row_context.row(entry));
            }
            nodes.push(VNode::Element(Box::new(list)));
        } else {
            let mut grid = VElement::new("div").class("hk-file-browser-grid");
            for entry in &rows {
                grid = grid.child(row_context.tile(entry));
            }
            nodes.push(VNode::Element(Box::new(grid)));
        }
        VNode::Fragment(nodes)
    };

    let body = rsx! {
        div { class: "hk-file-browser",
            {pathbar}
            {chips_row}
            {toolbar}
            div {
                class: "hk-file-browser-entries",
                "data-layout": layout.data_value(),
                {entries_area}
            }
        }
    };

    // ── footer ──────────────────────────────────────────────────────────────
    let cancel_label = props
        .cancel_label
        .clone()
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| t("hikari::filePicker.cancel", "Cancel"));
    let confirm_label = props
        .confirm_label
        .clone()
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| {
            if pick_directory {
                t("hikari::filePicker.chooseFolder", "Choose this folder")
            } else {
                t("hikari::filePicker.confirm", "Confirm")
            }
        });
    let cancel_click = {
        let handler = on_close.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(MouseEvent::default());
            }
        }
    };
    let confirm_click = {
        let handler = on_confirm.clone();
        let close = on_close.clone();
        let path = current_path.clone();
        let entries = sorted_entries.clone();
        let selected = selected.clone();
        move |_: MouseEvent| {
            let files = if pick_directory {
                vec![directory_pick(&path)]
            } else {
                confirm_files(&path, &entries, &selected)
            };
            // File mode: Vue returns without emitting when nothing is selected.
            if files.is_empty() {
                return;
            }
            if let Some(handler) = handler.as_ref() {
                handler.call(files);
            }
            // Vue closes after the confirm emit.
            if let Some(handler) = close.as_ref() {
                handler.call(MouseEvent::default());
            }
        }
    };
    let confirm_off = confirm_disabled(pick_directory, selected.len());
    let footer_form = props.footer_form.clone();
    let footer = rsx! {
        div { class: "hk-file-browser-footer",
            if let Some(form) = footer_form {
                div { class: "hk-file-browser-footer-form",
                    {form}
                }
            }
            div { class: "hk-file-browser-footer-actions",
                Button {
                    variant: ButtonVariant::Secondary,
                    size: ButtonSize::Md,
                    class: "hk-file-browser-cancel".to_string(),
                    onclick: Some(EventHandler::new(cancel_click)),
                    children: text_node(&cancel_label),
                }
                Button {
                    variant: ButtonVariant::Primary,
                    size: ButtonSize::Md,
                    disabled: confirm_off,
                    class: "hk-file-browser-confirm".to_string(),
                    onclick: Some(EventHandler::new(confirm_click)),
                    children: text_node(&confirm_label),
                }
            }
        }
    };

    // Chrome dismiss (✕ / overlay / Esc) rides the same chokepoint as the
    // Cancel button: with no close channel wired the frame stays inert
    // instead of showing a ✕ that cannot act.
    let closable = on_close.is_some();
    rsx! {
        Modal {
            open: props.open,
            title: Some(title),
            closable,
            // Vue passes the literal "56rem" (an arbitrary max-width, not the
            // `lg` preset) — the Modal mirror resolves it through the same
            // preset/gutter cap.
            width: "56rem".to_string(),
            children: body,
            footer: Some(footer),
            on_close,
        }
    }
}

impl StyledComponent for FileBrowserDialogComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-file-browser-*` names literal so this CSS matches the Vue
        // build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFileBrowserDialog.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "file-browser-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, kind: RemoteEntryKind) -> RemoteFileEntry {
        RemoteFileEntry {
            name: name.to_string(),
            kind,
            ..Default::default()
        }
    }

    fn file(name: &str, size: u64) -> RemoteFileEntry {
        RemoteFileEntry {
            name: name.to_string(),
            kind: RemoteEntryKind::File,
            size: Some(size),
            ..Default::default()
        }
    }

    #[test]
    fn file_browser_dialog_defaults_match_the_vue_props() {
        let props = FileBrowserDialogProps::default();
        assert!(!props.open);
        assert_eq!(props.title, None);
        assert_eq!(props.current_path, "/");
        assert!(props.entries.is_empty());
        assert!(!props.loading);
        assert_eq!(props.load_error, None);
        assert!(props.selected.is_empty());
        assert!(!props.multiple);
        assert_eq!(props.accept, None);
        assert_eq!(props.filter_ext, "");
        assert_eq!(props.layout, FileBrowserLayout::List);
        assert!(props.quick_links.is_empty());
        // Vue's `pickDirectory` default is false (pick FILES).
        assert!(!props.pick_directory);
        assert_eq!(props.confirm_label, None);
        assert_eq!(props.cancel_label, None);
        assert!(props.footer_form.is_none());
        assert!(props.on_close.is_none());
        assert!(props.on_navigate.is_none());
        assert!(props.on_selection_change.is_none());
        assert!(props.on_confirm.is_none());
    }

    #[test]
    fn file_browser_dialog_data_tokens_match_vue() {
        // The markers the mirrored sheet selects on.
        assert_eq!(RemoteEntryKind::File.data_value(), "file");
        assert_eq!(RemoteEntryKind::Dir.data_value(), "dir");
        assert_eq!(FileBrowserLayout::List.data_value(), "list");
        assert_eq!(FileBrowserLayout::Grid.data_value(), "grid");
    }

    #[test]
    fn file_browser_dialog_join_path_matches_vue() {
        assert_eq!(join_path("/", "a"), "/a");
        assert_eq!(join_path("/a", "b"), "/a/b");
        assert_eq!(join_path("/a/", "b"), "/a/b");
        assert_eq!(join_path("", "a"), "/a");
    }

    #[test]
    fn file_browser_dialog_sorts_directories_first() {
        let sorted = sort_entries(&[
            file("b.txt", 1),
            entry("zeta", RemoteEntryKind::Dir),
            file("a.txt", 1),
            entry("alpha", RemoteEntryKind::Dir),
        ]);
        let names: Vec<&str> = sorted.iter().map(|entry| entry.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "zeta", "a.txt", "b.txt"]);
    }

    #[test]
    fn file_browser_dialog_format_size_uses_the_picker_scale() {
        assert_eq!(format_size(None), "");
        assert_eq!(format_size(Some(0)), "0 B");
        assert_eq!(format_size(Some(1023)), "1023 B");
        assert_eq!(format_size(Some(1024)), "1.0 KB");
        assert_eq!(format_size(Some(1536)), "1.5 KB");
        assert_eq!(format_size(Some(1024 * 1024)), "1.0 MB");
        assert_eq!(format_size(Some(1024 * 1024 * 1024)), "1.0 GB");
    }

    #[test]
    fn file_browser_dialog_format_modified_passes_the_host_string() {
        assert_eq!(format_modified(None), "");
        assert_eq!(
            format_modified(Some("2026-01-02 03:04")),
            "2026-01-02 03:04"
        );
        assert_eq!(tile_meta(&file("a", 2048)), "2.0 KB");
        assert_eq!(
            tile_meta(&RemoteFileEntry {
                modified_at: Some("2026-01-02".to_string()),
                ..file("a", 2048)
            }),
            "2.0 KB · 2026-01-02"
        );
        // A directory carries no size in the meta line.
        assert_eq!(tile_meta(&entry("dir", RemoteEntryKind::Dir)), "");
    }

    #[test]
    fn file_browser_dialog_accept_extensions_matches_the_vue_parser() {
        assert!(accept_extensions(None).is_empty());
        assert!(accept_extensions(Some("")).is_empty());
        // MIME types / wildcards are dropped; case is folded.
        assert_eq!(
            accept_extensions(Some(" .CSV , image/*,.json")),
            vec![".csv".to_string(), ".json".to_string()]
        );
    }

    #[test]
    fn file_browser_dialog_filters_files_and_keeps_directories() {
        let entries = vec![
            entry("dir.csv", RemoteEntryKind::Dir),
            file("a.csv", 1),
            file("b.txt", 1),
            file("c.CSV", 1),
        ];
        // No filter = the whole (sorted) listing.
        assert_eq!(visible_entries(&entries, "").len(), 4);
        let filtered = visible_entries(&entries, ".csv");
        let names: Vec<&str> = filtered.iter().map(|entry| entry.name.as_str()).collect();
        // Directories always pass; file matching is case-insensitive.
        assert_eq!(names, vec!["dir.csv", "a.csv", "c.CSV"]);
    }

    #[test]
    fn file_browser_dialog_breadcrumbs_walk_the_path() {
        let root = breadcrumbs("/");
        assert_eq!(root.len(), 1);
        assert!(root[0].current);

        let nested = breadcrumbs("/srv/data");
        let names: Vec<&str> = nested.iter().map(|crumb| crumb.name.as_str()).collect();
        let paths: Vec<&str> = nested.iter().map(|crumb| crumb.path.as_str()).collect();
        assert_eq!(names, vec!["/", "srv", "data"]);
        assert_eq!(paths, vec!["/", "/srv", "/srv/data"]);
        assert!(!nested[0].current);
        assert!(nested[2].current);

        // A trailing slash does not add an empty crumb, but the LAST real
        // segment is not "current" then (`acc !== currentPath`) — Vue's exact
        // comparison.
        let trailing = breadcrumbs("/srv/");
        assert_eq!(trailing.len(), 2);
        assert!(trailing.iter().all(|crumb| !crumb.current));
    }

    #[test]
    fn file_browser_dialog_toggle_selection_matches_vue() {
        let a = "a".to_string();
        let b = "b".to_string();
        // multiple: append, then remove that one entry (order preserved).
        let picked = toggle_selection(&[], "a", true);
        assert_eq!(picked, vec![a.clone()]);
        let picked = toggle_selection(&picked, "b", true);
        assert_eq!(picked, vec![a.clone(), b.clone()]);
        let picked = toggle_selection(&picked, "a", true);
        assert_eq!(picked, vec![b.clone()]);
        // single: replace, and a second click on the only name clears it.
        let picked = toggle_selection(std::slice::from_ref(&a), "b", false);
        assert_eq!(picked, vec![b.clone()]);
        let picked = toggle_selection(&picked, "b", false);
        assert!(picked.is_empty());
    }

    #[test]
    fn file_browser_dialog_confirms_in_listing_order_with_paths() {
        let entries = vec![
            entry("dir", RemoteEntryKind::Dir),
            file("a.csv", 10),
            file("b.csv", 20),
        ];
        let selected = vec!["b.csv".to_string(), "a.csv".to_string(), "gone".to_string()];
        let files = confirm_files("/srv", &entries, &selected);
        // Listing order, not selection order; vanished names are skipped.
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].name, "a.csv");
        assert_eq!(files[0].path.as_deref(), Some("/srv/a.csv"));
        assert_eq!(files[0].size, Some(10));
        assert_eq!(files[1].name, "b.csv");
        assert_eq!(files[1].path.as_deref(), Some("/srv/b.csv"));
        // No selection = no confirm payload.
        assert!(confirm_files("/srv", &entries, &[]).is_empty());
    }

    #[test]
    fn file_browser_dialog_directory_pick_names_the_listed_folder() {
        assert_eq!(directory_pick("/srv/data").name, "data");
        assert_eq!(
            directory_pick("/srv/data").path.as_deref(),
            Some("/srv/data")
        );
        // Trailing slashes are trimmed for the NAME only.
        assert_eq!(directory_pick("/srv/data/").name, "data");
        assert_eq!(directory_pick("/").name, "/");
        assert_eq!(directory_pick("").name, "/");
        // Directory mode always has an answer; file mode needs a selection.
        assert!(!confirm_disabled(true, 0));
        assert!(confirm_disabled(false, 0));
        assert!(!confirm_disabled(false, 1));
    }

    #[test]
    fn file_browser_dialog_renders_the_vue_shell_inside_the_modal() {
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            current_path: "/srv".to_string(),
            entries: vec![entry("docs", RemoteEntryKind::Dir), file("a.csv", 2048)],
            selected: vec!["a.csv".to_string()],
            multiple: true,
            accept: Some(".csv".to_string()),
            quick_links: vec![FileQuickLink {
                label: "Home".to_string(),
                path: "/srv".to_string(),
            }],
            on_close: Some(EventHandler::new(|_: MouseEvent| {})),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // the mirrored Modal chrome
            "hk-modal-root",
            "hk-modal-content",
            "hk-modal-body-inner",
            "hk-modal-footer",
            // the browser body
            "hk-file-browser",
            "hk-file-browser-pathbar",
            "hk-file-browser-crumbs",
            "hk-file-browser-copy-path",
            "hk-file-browser-chips",
            "hk-file-browser-chip",
            "hk-file-browser-toolbar",
            "hk-file-browser-ops",
            "hk-file-browser-filter",
            "hk-file-browser-layout-btn",
            "hk-file-browser-entries",
            "hk-file-browser-list",
            "hk-file-browser-list-head",
            "hk-scroll-pin",
            "hk-file-browser-row",
            "hk-file-browser-col-name",
            "hk-file-browser-footer",
            "hk-file-browser-footer-actions",
            "hk-file-browser-cancel",
            "hk-file-browser-confirm",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Directory first, then the file; the current crumb is inert.
        assert!(html.contains(r#"data-kind="dir""#), "{html}");
        assert!(html.contains(r#"data-kind="file""#), "{html}");
        assert!(html.contains("data-current"), "{html}");
        // The selected row carries the sheet's presence marker + aria state.
        assert!(html.contains(r#"aria-pressed="true""#), "{html}");
        assert!(html.contains("data-selected"), "{html}");
        // The active quick link is marked.
        assert!(html.contains("data-active"), "{html}");
        // Vue's width lands on the frame's max-width cap.
        assert!(html.contains("max-width:min(56rem"), "{html}");
        // The confirmed size column uses the picker scale.
        assert!(html.contains("2.0 KB"), "{html}");
    }

    #[test]
    fn file_browser_dialog_closed_renders_nothing() {
        let html = FileBrowserDialog(FileBrowserDialogProps::default()).render_to_html();
        assert_eq!(html, "", "a closed dialog must not paint: {html}");
    }

    #[test]
    fn file_browser_dialog_states_render_like_vue() {
        // Loading wins over the listing.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            loading: true,
            entries: vec![file("a.csv", 1)],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-file-browser-loading"), "{html}");
        assert!(!html.contains("hk-file-browser-row"), "{html}");

        // A load failure speaks alone: the band + retry, no empty hint.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            load_error: Some("denied".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-file-browser-error"), "{html}");
        assert!(html.contains("denied"), "{html}");
        assert!(html.contains("hk-file-browser-retry"), "{html}");
        assert!(!html.contains("hk-file-browser-empty"), "{html}");

        // A healthy empty listing shows the empty hint.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-file-browser-empty"), "{html}");

        // Grid layout flips the area marker and renders tiles.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            layout: FileBrowserLayout::Grid,
            entries: vec![file("a.csv", 1)],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-layout="grid""#), "{html}");
        assert!(html.contains("hk-file-browser-tile"), "{html}");
        assert!(!html.contains("hk-file-browser-row"), "{html}");

        // Directory mode: the confirm copy changes and never disables.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            pick_directory: true,
            current_path: "/srv".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("Choose this folder"), "{html}");
        assert!(!html.contains("disabled"), "{html}");
        // No close channel wired → no ✕ that cannot act (Vue always has one
        // because the host owns `modelValue` there).
        assert!(!html.contains("hk-modal-close"), "{html}");

        // With a close channel the chrome is live.
        let html = FileBrowserDialog(FileBrowserDialogProps {
            open: true,
            on_close: Some(EventHandler::new(|_: MouseEvent| {})),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-modal-close"), "{html}");
    }

    #[test]
    fn file_browser_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = FileBrowserDialogComponent::styles();
        assert!(
            css.contains(".hk-file-browser")
                && css.contains(".hk-file-browser-pathbar")
                && css.contains(".hk-file-browser-row")
                && css.contains(".hk-file-browser-tile")
                && css.contains(".hk-file-browser-footer"),
            "file browser css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored file browser sheet"
        );
    }
}
