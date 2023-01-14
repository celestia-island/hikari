use stylist::yew::styled_component;
use yew::prelude::*;

#[styled_component]
pub fn Inside() -> Html {
    html! {
        <div class={css!(r#"
            width: 200px;
            height: 200px;
            border-radius: 5px;

            background: black;

            padding: 15px;
            box-sizing: border-box;

            box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.7);
            color: white;
        "#)}>
            {"The quick brown fox jumps over the lazy dog"}
        </div>
    }
}

#[styled_component]
pub fn Home() -> Html {
    html! {
        <>
            <h1>{"Yew Integration"}</h1>
            <div class={css!(r#"
                box-shadow: 0 0 5px 1px rgba(0, 0, 0, 0.7);
                height: 500px;
                width: 500px;
                border-radius: 5px;

                display: flex;
                justify-content: space-around;
                align-items: center;

                padding: 15px;
                box-sizing: border-box;

                flex-direction: column;
                background-color: white;
            "#)} id="yew-sample-content">
                <Inside />
            </div>
        </>
    }
}
