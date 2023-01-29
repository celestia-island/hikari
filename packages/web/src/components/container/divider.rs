use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub(crate) struct DividerProps {
    #[prop_or(false)]
    pub(crate) is_vertical: bool,

    #[prop_or(true)]
    pub(crate) is_horizontal: bool,
}

#[styled_component]
pub(crate) fn Divider(props: &DividerProps) -> Html {
    html! {
        <div
            class={css!(r#"
                display: fixed;
                align-items: center;
                justify-content: center;
            "#)}
        >
          {
              if props.is_vertical {
                  html! {
                      <div
                          class={css!(r#"
                              width: 1px;
                              height: 100%;
                              background: black;
                          "#)}
                      />
                  }
              } else if props.is_horizontal {
                  html! {
                      <div
                          class={css!(r#"
                              width: 100%;
                              height: 1px;
                              background: black;
                          "#)}
                      />
                  }
              } else {
                  html! {}
              }
          }
        </div>
    }
}
