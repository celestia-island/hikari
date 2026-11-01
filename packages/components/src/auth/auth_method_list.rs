// hi-components/src/auth/auth_method_list.rs
// AuthMethodList — mirror of the canonical Vue `HkAuthMethodList`: the auth
// card's third-party sign-in block (the "other ways to sign in" row).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAuthMethodList.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.s-auth-method*`
// class names are literal and identical in both forms. DOM contract (mirrors
// the Vue render output one-to-one):
//
//   div.s-auth-methods-list                       (display: contents wrapper)
//     div.s-auth-methods-divider                  (only when `divider` is set)
//       span                                      (the divider text)
//     div.s-auth-methods-tiles                    (the centered row)
//       span.hk-tooltip-wrapper                   (per tile — mirrored Tooltip)
//         span.hk-tooltip-trigger
//           button.s-auth-methods-tile
//               type="button" data-key aria-label [disabled] [data-selected]
//             span.s-auth-methods-tile-icon aria-hidden="true"
//               {icon} | span.s-auth-methods-tile-initial
//         div.hk-tooltip-popup                    (the bubble, lazily shown)
//
// The block is deliberately NOT a button group (Vue: 2026-09-14 user
// direction): every provider owns its own frame, and the wrapper is
// `display: contents`, so the divider and the tile row stay layout children
// of the host's `.s-auth-methods` container.
//
// Prop mapping: `divider` → [`AuthMethodListProps::divider`], `methods` →
// [`AuthMethodListProps::methods`] ([`HkAuthMethodEntry`], Vue's
// `HkAuthMethodListEntry`), the `select` emit →
// [`AuthMethodListProps::on_select`] (fires with the entry `key`).
//
// Adaptation deltas vs Vue (documented, not accidental):
//   * **`icon` is an `Element` slot, not a loose vnode.** Vue accepts `unknown`
//     (a brand SVG, an `<img>`, a lucide component); the Rust form takes the
//     built vnode (conventionally `Icon { icon: MdiIcon::…, size: 22 }`), so
//     the icon box keeps Vue's `.s-auth-methods-tile-icon` shell and the
//     missing-icon fallback stays the label's initial.
//   * **`description` is a Rust-side field** (Vue's entry has no description).
//     The tiles are icon-only — the sheet gives the label no visible slot — so
//     the description is folded into the hover text
//     (`"{label} — {description}"`, see [`auth_method_tooltip_text`]) instead
//     of inventing a sheet class the Vue form does not ship.
//   * **`selected` is a presence marker only.** Vue's tiles are independent
//     actions with no selection state, and the sheet defines no selected
//     rule; the field therefore emits `data-selected="true"` (absent when
//     false) as a host styling hook for callers that promote the list to a
//     sign-in-method chooser. It carries no ARIA selection semantics: a
//     `role="group"` / `radiogroup` wrapper would contradict the Vue test that
//     pins the absence of group semantics.
//   * the initial falls back to the first `char` (a Unicode scalar), not
//     Vue's first UTF-16 code unit: identical for every BMP label, and a
//     better edge for astral ones (an emoji stays whole instead of
//     half-surrogate).
//   * the hover text rides the crate's mirrored `Tooltip`, so that component's
//     own documented deltas apply — its geometry is the minimal
//     (no-zoom, no-clamp) variant, i.e. the bubble keeps its anchor placement
//     instead of Vue's measure-and-clamp / flip pass. The popup markup itself
//     is identical.
//   * no `class` / `style` props: Vue spreads no attributes onto this
//     component either (its root is `display: contents`, where a host class
//     or inline style would have no box to apply to).

use crate::feedback::{TOOLTIP_DEFAULT_DELAY_MS, Tooltip, TooltipPlacement};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AuthMethodListComponent;

/// The sheet's class names, spelled once so the DOM and the tests read one
/// source (Vue inlines them at each call site).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AuthMethodListClass {
    /// The `display: contents` wrapper.
    List,
    /// The "other ways to sign in" divider row.
    Divider,
    /// The centered tile row.
    Tiles,
    /// One provider tile (the framed square button).
    Tile,
    /// The icon box inside a tile.
    TileIcon,
    /// The label-initial fallback inside the icon box.
    TileInitial,
}

impl AuthMethodListClass {
    /// The class exactly as the Vue sheet spells it.
    pub fn class_name(self) -> &'static str {
        match self {
            AuthMethodListClass::List => "s-auth-methods-list",
            AuthMethodListClass::Divider => "s-auth-methods-divider",
            AuthMethodListClass::Tiles => "s-auth-methods-tiles",
            AuthMethodListClass::Tile => "s-auth-methods-tile",
            AuthMethodListClass::TileIcon => "s-auth-methods-tile-icon",
            AuthMethodListClass::TileInitial => "s-auth-methods-tile-initial",
        }
    }
}

/// One provider tile (Vue: `HkAuthMethodListEntry`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct HkAuthMethodEntry {
    /// Stable identity — the value `select` carries and the `data-key` hook.
    pub key: String,

    /// Accessible name AND the tooltip text (Vue: `label`).
    pub label: String,

    /// Rust-side addition (see the header): the second line of the hover
    /// text. Empty keeps the tooltip at the plain label.
    pub description: String,

    /// The framed glyph (Vue: a prebuilt icon vnode). `None` falls back to
    /// the label's initial, exactly like Vue's missing-icon arm.
    pub icon: Option<Element>,

    /// A dead tile: it keeps its place and swallows clicks (Vue:
    /// `disabled?: boolean`).
    pub disabled: bool,

    /// Presence marker (`data-selected="true"`) — see the header delta.
    pub selected: bool,
}

impl HkAuthMethodEntry {
    /// The common case — a live tile with no glyph (the initial shows) and no
    /// description.
    pub fn new(key: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            label: label.into(),
            description: String::new(),
            icon: None,
            disabled: false,
            selected: false,
        }
    }
}

/// Vue's missing-icon fallback: `method.label.charAt(0).toUpperCase()`.
///
/// The mirror takes the first Unicode scalar (see the header) and upper-cases
/// it; an empty label stays empty (Vue's `charAt(0)` on `""` is `""`, whose
/// `toUpperCase()` is `""` — no initial, never a broken box).
pub fn auth_method_initial(label: &str) -> String {
    match label.chars().next() {
        Some(first) => first.to_uppercase().collect(),
        None => String::new(),
    }
}

/// The hover text: the label, extended with the description when one is set.
/// An empty description (or one that is only whitespace) leaves the label
/// alone, so the plain Vue tooltip is reproduced byte for byte.
pub fn auth_method_tooltip_text(entry: &HkAuthMethodEntry) -> String {
    let description = entry.description.trim();
    if description.is_empty() {
        entry.label.clone()
    } else {
        format!("{} — {}", entry.label, description)
    }
}

/// Whether the tile is dead. Vue tests `method.disabled === true`, i.e. only
/// the strict `true` kills the tile; the mirror reads the same bool field, so
/// this is the identity — kept as a named predicate because the click handler
/// and the DOM marker must agree (one source, two call sites).
pub fn auth_method_entry_live(entry: &HkAuthMethodEntry) -> bool {
    !entry.disabled
}

/// Vue's `props.divider && …` guard: only a non-empty divider renders the row.
pub fn auth_method_shows_divider(divider: &str) -> bool {
    !divider.is_empty()
}

/// The `data-selected` presence attribute (`Some("true")` / absent), the same
/// presence-marker convention `basic/badge.rs` uses for its boolean markers.
pub fn auth_method_selected_attr(selected: bool) -> Option<&'static str> {
    if selected { Some("true") } else { None }
}

#[define_props]
pub struct AuthMethodListProps {
    /// Divider text above the row (Vue: `divider`, consumer-localized on
    /// purpose — hikari ships no dictionary for it).
    #[default]
    pub divider: String,

    /// Provider entries in render order (Vue: `methods`, required there;
    /// the Rust default is the empty row, which renders shell-intact).
    #[default]
    pub methods: Vec<HkAuthMethodEntry>,

    /// A provider tile was pressed; carries the entry `key` (Vue: the
    /// `select` emit).
    pub on_select: Option<EventHandler<String>>,
}

/// The icon box's inner node: the host glyph, or Vue's initial fallback.
fn auth_method_glyph(entry: &HkAuthMethodEntry) -> Element {
    match &entry.icon {
        Some(icon) => icon.clone(),
        None => {
            let initial = auth_method_initial(&entry.label);
            rsx! {
                span {
                    class: AuthMethodListClass::TileInitial.class_name(),
                    "{initial}"
                }
            }
        }
    }
}

/// One provider tile: the framed button plus its icon box.
fn auth_method_tile(
    entry: &HkAuthMethodEntry,
    on_select: &Option<EventHandler<String>>,
) -> Element {
    let live = auth_method_entry_live(entry);
    let mut tile = VElement::new("button")
        .class(AuthMethodListClass::Tile.class_name())
        .attr("type", "button")
        .attr("data-key", entry.key.clone())
        .attr("aria-label", entry.label.clone());
    if !live {
        tile = tile.attr("disabled", "disabled");
    }
    if let Some(marker) = auth_method_selected_attr(entry.selected) {
        tile = tile.attr("data-selected", marker);
    }

    let icon_box = rsx! {
        span {
            class: AuthMethodListClass::TileIcon.class_name(),
            "aria-hidden": "true",
            {auth_method_glyph(entry)}
        }
    };
    tile = tile.child(icon_box);

    let key = entry.key.clone();
    let handler = on_select.clone();
    tile = tile.on_click(move |_event: MouseEvent| {
        // Vue relies on the native `disabled` attribute alone; the guard keeps
        // a synthetic click (host test harness, programmatic dispatch) honest.
        if !live {
            return;
        }
        if let Some(handler) = handler.as_ref() {
            handler.call(key.clone());
        }
    });

    VNode::Element(Box::new(tile))
}

#[component]
pub fn AuthMethodList(props: AuthMethodListProps) -> Element {
    let divider = props.divider.clone();
    let mut tiles: Vec<VNode> = Vec::with_capacity(props.methods.len());
    for entry in &props.methods {
        let tile = auth_method_tile(entry, &props.on_select);
        // Vue wraps every tile in an HkTooltip carrying the provider label;
        // the crate's mirrored Tooltip keeps the same wrapper/popup markup.
        tiles.push(rsx! {
            Tooltip {
                text: auth_method_tooltip_text(entry),
                placement: TooltipPlacement::Top,
                delay: TOOLTIP_DEFAULT_DELAY_MS,
                children: tile,
            }
        });
    }

    rsx! {
        div {
            class: AuthMethodListClass::List.class_name(),
            if auth_method_shows_divider(&divider) {
                div {
                    class: AuthMethodListClass::Divider.class_name(),
                    span { "{divider}" }
                }
            }
            div {
                class: AuthMethodListClass::Tiles.class_name(),
                {VNode::Fragment(tiles)}
            }
        }
    }
}

impl StyledComponent for AuthMethodListComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-auth-method*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAuthMethodList.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "auth-method-list"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, label: &str) -> HkAuthMethodEntry {
        HkAuthMethodEntry::new(key, label)
    }

    #[test]
    fn auth_method_class_names_match_the_sheet() {
        assert_eq!(
            AuthMethodListClass::List.class_name(),
            "s-auth-methods-list"
        );
        assert_eq!(
            AuthMethodListClass::Divider.class_name(),
            "s-auth-methods-divider"
        );
        assert_eq!(
            AuthMethodListClass::Tiles.class_name(),
            "s-auth-methods-tiles"
        );
        assert_eq!(
            AuthMethodListClass::Tile.class_name(),
            "s-auth-methods-tile"
        );
        assert_eq!(
            AuthMethodListClass::TileIcon.class_name(),
            "s-auth-methods-tile-icon"
        );
        assert_eq!(
            AuthMethodListClass::TileInitial.class_name(),
            "s-auth-methods-tile-initial"
        );
    }

    #[test]
    fn auth_method_list_defaults_match_the_vue_props() {
        let props = AuthMethodListProps::default();
        assert_eq!(props.divider, "");
        assert!(props.methods.is_empty());
        assert!(props.on_select.is_none());

        let entry = HkAuthMethodEntry::default();
        assert_eq!(entry.key, "");
        assert_eq!(entry.label, "");
        assert_eq!(entry.description, "");
        assert!(entry.icon.is_none());
        assert!(!entry.disabled);
        assert!(!entry.selected);
    }

    #[test]
    fn auth_method_initial_is_the_upper_cased_first_char() {
        assert_eq!(auth_method_initial("GitHub"), "G");
        assert_eq!(auth_method_initial("linuxdo"), "L");
        // Vue's `charAt(0)` on an empty label is empty — never a broken box.
        assert_eq!(auth_method_initial(""), "");
        // The mirror takes the first Unicode SCALAR (see the header delta):
        // a CJK label keeps its whole glyph, an astral one is not cut in half.
        assert_eq!(auth_method_initial("飞书"), "飞");
        assert_eq!(auth_method_initial("🌟star"), "🌟");
    }

    #[test]
    fn auth_method_tooltip_text_folds_the_description_in() {
        let plain = entry("github", "GitHub");
        assert_eq!(auth_method_tooltip_text(&plain), "GitHub");

        let described = HkAuthMethodEntry {
            description: "OAuth via the forge".to_string(),
            ..entry("github", "GitHub")
        };
        assert_eq!(
            auth_method_tooltip_text(&described),
            "GitHub — OAuth via the forge"
        );

        // A whitespace-only description is "no description", so the plain
        // Vue tooltip is reproduced instead of a dangling separator.
        let blank = HkAuthMethodEntry {
            description: "   ".to_string(),
            ..entry("github", "GitHub")
        };
        assert_eq!(auth_method_tooltip_text(&blank), "GitHub");
    }

    #[test]
    fn auth_method_entry_state_predicates_match_vue() {
        assert!(auth_method_entry_live(&entry("gh", "GitHub")));
        assert!(!auth_method_entry_live(&HkAuthMethodEntry {
            disabled: true,
            ..entry("gh", "GitHub")
        }));
        // Vue's `props.divider &&` truthiness: an empty string renders no row.
        assert!(auth_method_shows_divider("or"));
        assert!(!auth_method_shows_divider(""));
        // Presence marker, never a serialized "false".
        assert_eq!(auth_method_selected_attr(true), Some("true"));
        assert_eq!(auth_method_selected_attr(false), None);
    }

    #[test]
    fn auth_method_list_renders_the_vue_tile_contract() {
        let html = AuthMethodList(AuthMethodListProps {
            divider: "Or continue with".to_string(),
            methods: vec![entry("github", "GitHub"), entry("linuxdo", "LinuxDo")],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="s-auth-methods-list""#,
            r#"class="s-auth-methods-divider""#,
            "Or continue with",
            r#"class="s-auth-methods-tiles""#,
            r#"class="s-auth-methods-tile""#,
            r#"class="s-auth-methods-tile-icon""#,
            r#"class="s-auth-methods-tile-initial""#,
            r#"aria-label="GitHub""#,
            r#"aria-label="LinuxDo""#,
            r#"data-key="github""#,
            r#"data-key="linuxdo""#,
            r#"type="button""#,
            r#"aria-hidden="true""#,
            // Every tile is tooltip-wrapped, exactly like Vue.
            r#"class="hk-tooltip-wrapper""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Icon-only: the label is the accessible name + hover text, never
        // visible tile text (Vue's own suite pins the same rule).
        assert_eq!(html.matches("s-auth-methods-tile\"").count(), 2, "{html}");
        assert_eq!(html.matches("hk-tooltip-wrapper").count(), 2, "{html}");
        // The two initials are the labels' first letters.
        assert!(html.contains(">G</span>"), "{html}");
        assert!(html.contains(">L</span>"), "{html}");
        // A plain row, deliberately NOT a button group (Vue pins the absence).
        assert!(!html.contains("hk-icon-group"), "{html}");
        assert!(!html.contains(r#"role="group""#), "{html}");
        assert!(!html.contains(r#"role="radiogroup""#), "{html}");
        // The tooltip owns the hover text: no native `title` attribute.
        assert!(!html.contains("title="), "{html}");
    }

    #[test]
    fn auth_method_list_renders_the_icon_disabled_and_selected_arms() {
        let html = AuthMethodList(AuthMethodListProps {
            methods: vec![
                HkAuthMethodEntry {
                    icon: Some(rsx! {
                        span { class: "brand-gh" }
                    }),
                    ..entry("gh", "GitHub")
                },
                HkAuthMethodEntry {
                    disabled: true,
                    ..entry("ld", "LinuxDo")
                },
                HkAuthMethodEntry {
                    selected: true,
                    description: "Forge login".to_string(),
                    ..entry("fs", "Feishu")
                },
            ],
            ..Default::default()
        })
        .render_to_html();

        // The host glyph renders inside the icon box instead of an initial.
        assert!(html.contains(r#"class="brand-gh""#), "{html}");
        assert_eq!(
            html.matches("s-auth-methods-tile-initial").count(),
            2,
            "{html}"
        );
        // Disabled entries render dead …
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        // … selected ones only carry the presence marker.
        assert!(html.contains(r#"data-selected="true""#), "{html}");
        // The description joined the hover text.
        assert!(html.contains("Forge login"), "{html}");
        // No divider text → no divider row at all.
        assert!(!html.contains("s-auth-methods-divider"), "{html}");
    }

    #[test]
    fn auth_method_list_renders_an_empty_row_shell() {
        let html = AuthMethodList(AuthMethodListProps::default()).render_to_html();
        // Vue keeps the wrapper and the row; only the tiles are gone.
        assert!(html.contains(r#"class="s-auth-methods-list""#), "{html}");
        assert!(html.contains(r#"class="s-auth-methods-tiles""#), "{html}");
        assert!(!html.contains("s-auth-methods-tile\""), "{html}");
        assert!(!html.contains("s-auth-methods-divider"), "{html}");
    }

    #[test]
    fn auth_method_list_styles_come_from_the_canonical_vue_sheet() {
        let css = AuthMethodListComponent::styles();
        for needle in [
            ".s-auth-methods-list",
            ".s-auth-methods-divider",
            ".s-auth-methods .s-auth-methods-tiles",
            ".s-auth-methods-tile",
            ".s-auth-methods-tile-icon",
            ".s-auth-methods-tile-initial",
            ".hk-tooltip-wrapper",
            "display: contents",
        ] {
            assert!(
                css.contains(needle),
                "auth-method-list css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored auth-method-list sheet"
        );
        assert_eq!(AuthMethodListComponent::name(), "auth-method-list");
    }
}
