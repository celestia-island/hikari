use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(Properties, Debug, PartialEq)]
pub struct DividerProps {
    #[prop_or(false)]
    pub is_vertical: bool,

    #[prop_or(true)]
    pub is_horizontal: bool,
}

#[styled_component]
pub fn Divider(props: &DividerProps) -> Html {
    html! {
        <div
            class={css!(r#"
                display: flex;
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
