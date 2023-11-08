#[cfg(test)]
mod test {
    use hikari_proto::generate_app;

    fn generate() {
        generate_app! {
          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub enum Route {
            #[at("/")]
            Portal { recommend_list: Vec<String> }

            #[at("/u/:id")]
            Personal { id: String, name: String, email: String }

            #[at("/t/:id")]
            Thread { id: String, title: String, content: String, comments: Vec<String> }

            #[not_found]
            #[at("/404")]
            NotFound
          }

          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub struct Theme {
            pub primary_color: String,
            pub secondary_color: String,
          }

          #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
          pub struct UserToken {
            pub token: String,
          }
        }
    }

    #[test]
    fn render_at_client() {
        generate().hydrate(web_sys::window()?.document()?.get_element_by_id("_root")?);
    }

    #[test]
    fn render_at_server() {
        generate().render_to_string(Route::Personal {
            id: "114514",
            name: "homo",
            email: "homo@red.tea",
        });

        let stream = generate().render_to_stream();
    }
}
