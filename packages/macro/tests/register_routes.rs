#[allow(dead_code)]
#[cfg(test)]
mod test {
    use serde::{Deserialize, Serialize};

    #[derive(Clone, Debug)]
    pub struct Router;

    #[derive(PartialEq, Eq, Clone, Debug)]
    #[routes(Router)]
    enum Routes {
        #[at("/")]
        #[component(Portal)]
        Portal,

        #[at("/t/:id")]
        #[component(Thread)]
        Thread { id: String },

        #[at("/u/:id")]
        #[component(Personal)]
        Personal { id: String },

        #[not_found]
        #[at("/404")]
        #[component(PageNotFound)]
        NotFound,
    }

    #[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
    #[app_state(Router)]
    struct Theme {
        pub color: String,
    }

    #[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
    #[app_props(Router)]
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
}
