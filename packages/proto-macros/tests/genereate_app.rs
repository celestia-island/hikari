#[cfg(test)]
mod test {
    fn generate() {
        generate_app! {
          #[routes]
          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub enum Route {
            #[at("/")]
            Portal { recommend_list: Vec<String> }

            #[at("/u/:id")]
            #[at("/:id")]
            #[url_params({ id: String })]
            Personal { id: String, name: String, email: String }

            #[at("/t/:id")]
            #[url_params({ id: String })]
            Thread { id: String, title: String, content: String, comments: Vec<String> }

            #[not_found]
            #[at("/404")]
            NotFound
          }

          #[global_state]
          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub struct Theme {
            pub primary_color: String,
            pub secondary_color: String,
          }

          #[global_state]
          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub struct UserToken {
            pub token: String,
          }
        }
    }

    #[test]
    fn render_at_client() {
        generate().render_to_element("#root");
    }

    #[test]
    fn render_at_server() {
        generate().render_to_string();

        let stream = generate().render_to_stream();
    }
}
