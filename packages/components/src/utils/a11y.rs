use tairitsu_vdom::{VElement, VNode, VText};

#[must_use]
pub fn aria(name: &'static str, value: &'static str) -> (&'static str, &'static str) {
    (name, value)
}

#[must_use]
pub fn aria_label(label: &'static str) -> (&'static str, &'static str) {
    ("aria-label", label)
}

#[must_use]
pub fn aria_labelledby(id: &'static str) -> (&'static str, &'static str) {
    ("aria-labelledby", id)
}

#[must_use]
pub fn aria_describedby(id: &'static str) -> (&'static str, &'static str) {
    ("aria-describedby", id)
}

#[must_use]
pub fn aria_controls(id: &'static str) -> (&'static str, &'static str) {
    ("aria-controls", id)
}

#[must_use]
pub fn aria_expanded(expanded: bool) -> (&'static str, String) {
    ("aria-expanded", expanded.to_string())
}

#[must_use]
pub fn aria_checked(checked: bool) -> (&'static str, String) {
    ("aria-checked", checked.to_string())
}

#[must_use]
pub fn aria_selected(selected: bool) -> (&'static str, String) {
    ("aria-selected", selected.to_string())
}

#[must_use]
pub fn aria_disabled(disabled: bool) -> (&'static str, String) {
    ("aria-disabled", disabled.to_string())
}

#[must_use]
pub fn aria_hidden(hidden: bool) -> (&'static str, String) {
    ("aria-hidden", hidden.to_string())
}

#[must_use]
pub fn aria_invalid(invalid: bool) -> (&'static str, String) {
    ("aria-invalid", invalid.to_string())
}

#[must_use]
pub fn aria_modal(modal: bool) -> (&'static str, String) {
    ("aria-modal", modal.to_string())
}

#[must_use]
pub fn aria_live(live: AriaLive) -> (&'static str, &'static str) {
    ("aria-live", live.as_str())
}

#[must_use]
pub fn aria_haspopup(popup: AriaHasPopup) -> (&'static str, &'static str) {
    ("aria-haspopup", popup.as_str())
}

#[must_use]
pub fn aria_valuenow(value: f64) -> (&'static str, String) {
    ("aria-valuenow", format!("{value}"))
}

#[must_use]
pub fn aria_valuemin(value: f64) -> (&'static str, String) {
    ("aria-valuemin", format!("{value}"))
}

#[must_use]
pub fn aria_valuemax(value: f64) -> (&'static str, String) {
    ("aria-valuemax", format!("{value}"))
}

#[must_use]
pub fn aria_current(current: AriaCurrent) -> (&'static str, &'static str) {
    ("aria-current", current.as_str())
}

#[must_use]
pub fn role(role: AriaRole) -> &'static str {
    role.as_str()
}

#[must_use]
pub fn tabindex(index: i32) -> (&'static str, String) {
    ("tabindex", index.to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AriaLive {
    Off,
    Polite,
    Assertive,
}

impl AriaLive {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            AriaLive::Off => "off",
            AriaLive::Polite => "polite",
            AriaLive::Assertive => "assertive",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AriaHasPopup {
    False,
    True,
    Menu,
    ListBox,
    Dialog,
    Grid,
    Tree,
}

impl AriaHasPopup {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            AriaHasPopup::False => "false",
            AriaHasPopup::True => "true",
            AriaHasPopup::Menu => "menu",
            AriaHasPopup::ListBox => "listbox",
            AriaHasPopup::Dialog => "dialog",
            AriaHasPopup::Grid => "grid",
            AriaHasPopup::Tree => "tree",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AriaCurrent {
    False,
    True,
    Page,
    Step,
    Location,
    Date,
    Time,
}

impl AriaCurrent {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            AriaCurrent::False => "false",
            AriaCurrent::True => "true",
            AriaCurrent::Page => "page",
            AriaCurrent::Step => "step",
            AriaCurrent::Location => "location",
            AriaCurrent::Date => "date",
            AriaCurrent::Time => "time",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AriaRole {
    Alert,
    AlertDialog,
    Application,
    Article,
    Banner,
    Button,
    Cell,
    Checkbox,
    ColumnHeader,
    ComboBox,
    Complementary,
    ContentInfo,
    Definition,
    Dialog,
    Directory,
    Document,
    Feed,
    Figure,
    Form,
    Grid,
    GridCell,
    Group,
    Heading,
    Img,
    Link,
    List,
    ListBox,
    ListItem,
    Log,
    Main,
    Marquee,
    Math,
    Menu,
    MenuBar,
    MenuItem,
    MenuItemCheckbox,
    MenuItemRadio,
    Navigation,
    None,
    Note,
    Option,
    Presentation,
    ProgressBar,
    Radio,
    RadioGroup,
    Region,
    Row,
    RowGroup,
    RowHeader,
    Scrollbar,
    Search,
    SearchBox,
    Separator,
    Slider,
    SpinButton,
    Status,
    Switch,
    Tab,
    Table,
    TabList,
    TabPanel,
    Term,
    TextBox,
    Timer,
    Toolbar,
    Tooltip,
    Tree,
    TreeGrid,
    TreeItem,
}

impl AriaRole {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            AriaRole::Alert => "alert",
            AriaRole::AlertDialog => "alertdialog",
            AriaRole::Application => "application",
            AriaRole::Article => "article",
            AriaRole::Banner => "banner",
            AriaRole::Button => "button",
            AriaRole::Cell => "cell",
            AriaRole::Checkbox => "checkbox",
            AriaRole::ColumnHeader => "columnheader",
            AriaRole::ComboBox => "combobox",
            AriaRole::Complementary => "complementary",
            AriaRole::ContentInfo => "contentinfo",
            AriaRole::Definition => "definition",
            AriaRole::Dialog => "dialog",
            AriaRole::Directory => "directory",
            AriaRole::Document => "document",
            AriaRole::Feed => "feed",
            AriaRole::Figure => "figure",
            AriaRole::Form => "form",
            AriaRole::Grid => "grid",
            AriaRole::GridCell => "gridcell",
            AriaRole::Group => "group",
            AriaRole::Heading => "heading",
            AriaRole::Img => "img",
            AriaRole::Link => "link",
            AriaRole::List => "list",
            AriaRole::ListBox => "listbox",
            AriaRole::ListItem => "listitem",
            AriaRole::Log => "log",
            AriaRole::Main => "main",
            AriaRole::Marquee => "marquee",
            AriaRole::Math => "math",
            AriaRole::Menu => "menu",
            AriaRole::MenuBar => "menubar",
            AriaRole::MenuItem => "menuitem",
            AriaRole::MenuItemCheckbox => "menuitemcheckbox",
            AriaRole::MenuItemRadio => "menuitemradio",
            AriaRole::Navigation => "navigation",
            AriaRole::None => "none",
            AriaRole::Note => "note",
            AriaRole::Option => "option",
            AriaRole::Presentation => "presentation",
            AriaRole::ProgressBar => "progressbar",
            AriaRole::Radio => "radio",
            AriaRole::RadioGroup => "radiogroup",
            AriaRole::Region => "region",
            AriaRole::Row => "row",
            AriaRole::RowGroup => "rowgroup",
            AriaRole::RowHeader => "rowheader",
            AriaRole::Scrollbar => "scrollbar",
            AriaRole::Search => "search",
            AriaRole::SearchBox => "searchbox",
            AriaRole::Separator => "separator",
            AriaRole::Slider => "slider",
            AriaRole::SpinButton => "spinbutton",
            AriaRole::Status => "status",
            AriaRole::Switch => "switch",
            AriaRole::Tab => "tab",
            AriaRole::Table => "table",
            AriaRole::TabList => "tablist",
            AriaRole::TabPanel => "tabpanel",
            AriaRole::Term => "term",
            AriaRole::TextBox => "textbox",
            AriaRole::Timer => "timer",
            AriaRole::Toolbar => "toolbar",
            AriaRole::Tooltip => "tooltip",
            AriaRole::Tree => "tree",
            AriaRole::TreeGrid => "treegrid",
            AriaRole::TreeItem => "treeitem",
        }
    }
}

#[must_use]
pub fn visually_hidden() -> &'static str {
    "hk-visually-hidden"
}

#[must_use]
pub fn sr_only() -> &'static str {
    visually_hidden()
}

#[must_use]
pub fn screen_reader_only_text(text: &str) -> VNode {
    VNode::Element(
        VElement::new("span")
            .class(visually_hidden())
            .child(VNode::Text(VText::new(text))),
    )
}

#[must_use]
pub fn skip_nav_link(target_id: &str, label: &str) -> VNode {
    VNode::Element(
        VElement::new("a")
            .attr("href", format!("#{target_id}"))
            .class("hk-skip-nav")
            .child(VNode::Text(VText::new(label))),
    )
}

#[must_use]
pub fn live_region(live: AriaLive, content: VNode) -> VNode {
    VNode::Element(
        VElement::new("div")
            .attr("aria-live", live.as_str())
            .attr("role", AriaRole::Status.as_str())
            .child(content),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aria_helpers() {
        assert_eq!(aria_label("Close"), ("aria-label", "Close"));
        assert_eq!(aria_labelledby("title"), ("aria-labelledby", "title"));
        assert_eq!(aria_describedby("err"), ("aria-describedby", "err"));
        assert_eq!(aria_controls("panel"), ("aria-controls", "panel"));
        assert_eq!(aria_expanded(true), ("aria-expanded", "true".to_string()));
        assert_eq!(aria_checked(false), ("aria-checked", "false".to_string()));
        assert_eq!(aria_selected(true), ("aria-selected", "true".to_string()));
        assert_eq!(aria_disabled(true), ("aria-disabled", "true".to_string()));
        assert_eq!(aria_hidden(true), ("aria-hidden", "true".to_string()));
        assert_eq!(aria_invalid(true), ("aria-invalid", "true".to_string()));
        assert_eq!(aria_modal(true), ("aria-modal", "true".to_string()));
    }

    #[test]
    fn test_aria_live_enum() {
        assert_eq!(AriaLive::Polite.as_str(), "polite");
        assert_eq!(AriaLive::Assertive.as_str(), "assertive");
        assert_eq!(AriaLive::Off.as_str(), "off");
        assert_eq!(aria_live(AriaLive::Polite), ("aria-live", "polite"));
    }

    #[test]
    fn test_aria_haspopup_enum() {
        assert_eq!(AriaHasPopup::Menu.as_str(), "menu");
        assert_eq!(AriaHasPopup::Dialog.as_str(), "dialog");
        assert_eq!(AriaHasPopup::True.as_str(), "true");
    }

    #[test]
    fn test_aria_current_enum() {
        assert_eq!(AriaCurrent::Page.as_str(), "page");
        assert_eq!(AriaCurrent::Step.as_str(), "step");
        assert_eq!(AriaCurrent::True.as_str(), "true");
    }

    #[test]
    fn test_aria_role_enum() {
        assert_eq!(AriaRole::Button.as_str(), "button");
        assert_eq!(AriaRole::Dialog.as_str(), "dialog");
        assert_eq!(AriaRole::TabList.as_str(), "tablist");
        assert_eq!(AriaRole::Switch.as_str(), "switch");
        assert_eq!(AriaRole::Alert.as_str(), "alert");
        assert_eq!(AriaRole::Navigation.as_str(), "navigation");
    }

    #[test]
    fn test_tabindex() {
        assert_eq!(tabindex(0), ("tabindex", "0".to_string()));
        assert_eq!(tabindex(-1), ("tabindex", "-1".to_string()));
    }

    #[test]
    fn test_visually_hidden() {
        assert_eq!(visually_hidden(), "hk-visually-hidden");
        assert_eq!(sr_only(), "hk-visually-hidden");
    }

    #[test]
    fn test_screen_reader_only_text() {
        let node = screen_reader_only_text("Loading...");
        match node {
            VNode::Element(_) => {}
            _ => panic!("Expected element"),
        }
    }

    #[test]
    fn test_skip_nav_link() {
        let node = skip_nav_link("main-content", "Skip to main");
        match node {
            VNode::Element(_) => {}
            _ => panic!("Expected element"),
        }
    }

    #[test]
    fn test_live_region() {
        let node = live_region(AriaLive::Assertive, VNode::Text(VText::new("Error!")));
        match node {
            VNode::Element(_) => {}
            _ => panic!("Expected element"),
        }
    }
}
