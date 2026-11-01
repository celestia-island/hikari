// hi-components/src/data/card_list.rs
// CardList + ListRow — mirror of the canonical Vue `HkCardList` /
// `HkListRow` pair (one file upstream too).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCardList.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`.
//
//   Card(padded=false)
//     div.hk-card-list[role=list]            (rows present)
//     ── or the empty slot ──                (no rows)
//
//   div.hk-list-row [.hk-list-row-clickable] role=listitem [tabindex=0]
//     IconChip (icon + iconTone)             (when `icon` is set)
//     div.hk-list-row-main
//       div.hk-list-row-title?               (title)
//       div.hk-list-row-subtitle?            (subtitle)
//       {children}                           (default slot)
//     div.hk-list-row-trailing?              (trailing slot)
//
// Deltas vs Vue (documented): the leading icon is a typed `MdiIcon` (Vue
// takes a component) and renders through the mirrored `IconChip`; the
// "did the default slot render anything?" probe becomes an explicit
// `has_rows` flag, because a Rust `Element` is always present (Vue inspects
// the vnode array for a Comment placeholder).

use hikari_icons::MdiIcon;

use crate::basic::{Card, CardProps, IconChip, IconChipProps, IconChipTone};
use crate::data::stat_card::StatTone;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CardListComponent;

/// The IconChip tone that corresponds to a `StatTone` (the two mirrors share
/// the same palette; `muted` and `error` map onto IconChip's own names).
pub fn card_list_icon_tone(tone: StatTone) -> IconChipTone {
    match tone {
        StatTone::Success => IconChipTone::Success,
        StatTone::Warning => IconChipTone::Warning,
        StatTone::Error => IconChipTone::Error,
        StatTone::Info => IconChipTone::Info,
        StatTone::Primary => IconChipTone::Primary,
        StatTone::Muted => IconChipTone::Muted,
    }
}

#[define_props]
pub struct CardListProps {
    /// Whether the default slot actually rendered any row (Vue probes the
    /// vnode array; see the header delta).
    #[default]
    pub has_rows: bool,

    /// The empty slot: rendered INSTEAD of the list surface when
    /// `has_rows` is false (Vue: the `empty` slot).
    pub empty: Option<Element>,

    pub children: Element,
}

#[component]
pub fn CardList(props: CardListProps) -> Element {
    let body = if !props.has_rows {
        match &props.empty {
            Some(empty) => empty.clone(),
            None => empty_vnode(),
        }
    } else {
        rsx! {
            div {
                class: "hk-card-list",
                "role": "list",
                {props.children.clone()}
            }
        }
    };
    rsx! {
        Card {
            padded: false,
            children: body,
        }
    }
}

impl StyledComponent for CardListComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCardList.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "card-list"
    }
}

#[define_props]
pub struct ListRowProps {
    /// The leading glyph (Vue: an icon component through `HkIconChip`).
    pub icon: Option<MdiIcon>,

    #[default]
    pub icon_tone: StatTone,

    pub title: Option<String>,

    pub subtitle: Option<String>,

    /// Whole-row click (drill-through).
    #[default]
    pub clickable: bool,

    pub onclick: Option<EventHandler<MouseEvent>>,

    /// The trailing slot: badges, switches, actions.
    pub trailing: Option<Element>,

    pub children: Element,
}

#[component]
pub fn ListRow(props: ListRowProps) -> Element {
    let classes = if props.clickable {
        "hk-list-row hk-list-row-clickable"
    } else {
        "hk-list-row"
    };
    let click_handler = {
        let onclick = props.onclick.clone();
        move |event: MouseEvent| {
            if let Some(handler) = onclick.as_ref() {
                handler.call(event.clone());
            }
        }
    };
    let key_handler = {
        let onclick = props.onclick.clone();
        move |event: KeyboardEvent| {
            if event.key != "Enter" && event.key != " " {
                return;
            }
            event.prevent_default();
            if let Some(handler) = onclick.as_ref() {
                handler.call(MouseEvent::default());
            }
        }
    };

    let icon_markup = match props.icon {
        Some(icon) => rsx! {
            IconChip {
                icon,
                tone: card_list_icon_tone(props.icon_tone),
            }
        },
        None => empty_vnode(),
    };

    let mut main = VElement::new("div").class("hk-list-row-main");
    if let Some(title) = &props.title {
        main = main.child(rsx! { div { class: "hk-list-row-title", "{title}" } });
    }
    if let Some(subtitle) = &props.subtitle {
        main = main.child(rsx! { div { class: "hk-list-row-subtitle", "{subtitle}" } });
    }
    main = main.child(props.children.clone());

    let trailing_markup = match &props.trailing {
        Some(trailing) => rsx! { div { class: "hk-list-row-trailing", {trailing.clone()} } },
        None => empty_vnode(),
    };

    let mut row = VElement::new("div").class(classes).attr("role", "listitem");
    if props.clickable {
        row = row
            .attr("tabindex", "0")
            .on_click(click_handler)
            .on_keydown(key_handler);
    }
    VNode::Element(Box::new(
        row.child(icon_markup)
            .child(VNode::Element(Box::new(main)))
            .child(trailing_markup),
    ))
}

/// ListRow has no sheet of its own: its rules live in the CardList sheet, so
/// the registry already carries them under `card-list`.
pub struct ListRowComponent;

impl StyledComponent for ListRowComponent {
    fn styles() -> &'static str {
        CardListComponent::styles()
    }

    fn name() -> &'static str {
        "list-row"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_list_icon_tone_maps_the_shared_palette() {
        assert_eq!(
            card_list_icon_tone(StatTone::Primary),
            IconChipTone::Primary
        );
        assert_eq!(card_list_icon_tone(StatTone::Error), IconChipTone::Error);
        assert_eq!(card_list_icon_tone(StatTone::Muted), IconChipTone::Muted);
    }

    #[test]
    fn card_list_defaults_match_the_vue_props() {
        let props = CardListProps::default();
        assert!(!props.has_rows);
        assert!(props.empty.is_none());
    }

    #[test]
    fn card_list_renders_rows_inside_an_unpadded_card() {
        let html = CardList(CardListProps {
            has_rows: true,
            children: rsx! { ListRow { title: Some("Row".to_string()) } },
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("hk-card-body hk-card-body-unpadded"),
            "{html}"
        );
        assert!(html.contains("hk-card-list"), "{html}");
        assert!(html.contains("role=\"list\""), "{html}");
    }

    #[test]
    fn card_list_empty_slot_replaces_the_list_surface() {
        let html = CardList(CardListProps {
            has_rows: false,
            empty: Some(rsx! { span { class: "empty", "none" } }),
            children: empty_vnode(),
        })
        .render_to_html();
        assert!(html.contains("class=\"empty\""), "{html}");
        assert!(!html.contains("hk-card-list"), "{html}");
    }

    #[test]
    fn list_row_renders_the_row_shell() {
        let html = ListRow(ListRowProps {
            title: Some("T".to_string()),
            subtitle: Some("S".to_string()),
            icon: Some(MdiIcon::Help),
            trailing: Some(rsx! { span { "R" } }),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-list-row",
            "hk-icon-chip",
            "hk-list-row-main",
            "hk-list-row-title",
            "hk-list-row-subtitle",
            "hk-list-row-trailing",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains("role=\"listitem\""), "{html}");
    }

    #[test]
    fn list_row_clickable_gets_the_button_contract() {
        let html = ListRow(ListRowProps {
            clickable: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-list-row-clickable"), "{html}");
        assert!(html.contains("tabindex=\"0\""), "{html}");
    }

    #[test]
    fn card_list_styles_come_from_the_canonical_vue_sheet() {
        let css = CardListComponent::styles();
        assert!(
            css.contains("hk-card-list") && css.contains("hk-list-row"),
            "{css}"
        );
        assert!(!css.contains("CSS generation failed"), "scss failed");
    }
}
