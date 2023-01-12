use yew::prelude::*;

#[function_component(App)]
pub fn app() -> Html {
    html! {
        <main>
            <style>
                {"
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(to bottom right, #444444, #009a5b);
  font-size: 1.5rem;
}

main {
  color: #fff6d5;
  font-family: sans-serif;
  text-align: center;
}

.logo {
  height: 8em;
}

.heart:after {
  content: \"❤️\";

  font-size: 1.75em;
}

h1 + .subtitle {
  display: block;
  margin-top: -1em;
}
"}
            </style>
            <img class="logo" src="https://cor-games.com/logo-s.png" alt="logo" />
            <h1>{ "Hello World!" }</h1>
            <span class="subtitle">{ "from Yew with " }<i class="heart" /></span>
        </main>
    }
}
