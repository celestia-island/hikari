#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};

    use hikari_proto_macros::register_routes;

    #[derive(PartialEq, Clone, Debug, Serialize, Deserialize)]
    pub enum AppPageProps {
        Portal {
            id: String,
            thread_list: Vec<String>,
        },

        Personal {
            id: String,
            name: String,
            email: String,
        },

        Thread {
            id: String,
            title: String,
            content: String,
            comments: Vec<String>,
        },
    }

    impl Default for AppPageProps {
        fn default() -> Self {
            AppPageProps::Portal {
                id: "".into(),
                thread_list: vec![],
            }
        }
    }

    #[register_routes(AppPageProps)]
    pub struct WebApp {}

    #[test]
    fn try_to_serialize() {
        use hikari_proto::WebClient;

        let t = WebApp {};

        println!("{:?}", t.App());
    }
}
