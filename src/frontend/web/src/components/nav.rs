use yew::prelude::*;
use yew_router::prelude::*;

use crate::app::Route;

mod styles {
    use stylist::*;

    lazy_static! {
        pub static ref NAV_OUTSIDE: String = style!(
            r#"
                position: sticky;
                top: 0;
                left: 0;
                right: 0;
                height: 64px;
                z-index: 1000;
                box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                display: flex;
                align-items: center;
                justify-content: flex-start;
                user-select: none;
            "#
        )
        .unwrap()
        .get_class_name()
        .into();
        pub static ref NAV_BUTTON: String = style!(
            r#"
                width: min-content;
                height: 24px;
                margin: 0px 8px;
                padding: 0px 8px;
                border: none;
                outline: none;
                text-decoration: none;
                background: #6cf;
                color: #fff;
                font-size: 16px;
                box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
                border-radius: 4px;
                user-select: none;
                transition: all 0.3s;

                &:hover {
                    filter: brightness(1.2);
                }
                &:active {
                    filter: brightness(0.8);
                }
            "#
        )
        .unwrap()
        .get_class_name()
        .into();
    }
}

#[function_component]
pub fn Nav() -> Html {
    html! {
        <nav class={classes!(styles::NAV_OUTSIDE.to_string())}>
            <h1 style={r#"
                margin-left: 16px;
            "#}>
                { "Hikari" }
            </h1>
            <Link<Route> classes={classes!(styles::NAV_BUTTON.to_string())} to={Route::Home}>
                { "Home" }
            </Link<Route>>
        </nav>
    }
}
