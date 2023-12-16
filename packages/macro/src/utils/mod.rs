pub mod register_routes;

// register_routes!(
//     #[routes]
//     enum Routes {
//         #[at("/")]
//         Portal,

//         #[at("/t/:id")]
//         Thread { id: String },

//         #[at("/u/:id")]
//         Personal { id: String },

//         #[not_found]
//         #[at("/404")]
//         NotFound,
//     }

//     #[switch_fn]
//     fn switch(routes: Route) -> Html {
//         match routes {
//             Route::Portal => {
//                 html! { <Portal /> }
//             }
//             Route::Thread { id } => {
//                 html! { <Thread {id} /> }
//             }
//             Route::Personal { id } => {
//                 html! { <Personal {id} /> }
//             }
//             Route::NotFound => {
//                 html! { <PageNotFound /> }
//             }
//         }
//     }

//     #[app_state]
//     #[derive(Debug, PartialEq, Eq, Clone)]
//     struct Theme {
//         pub color: String,
//         pub text_size: TextSize,
//     }

//     #[app_props]
//     #[derive(PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
//     pub enum AppPageProps {
//         Portal {
//             id: String,
//             thread_list: Vec<String>,
//         },

//         Personal {
//             id: String,
//             name: String,
//             email: String,
//             sex: Sex,
//         },

//         Thread {
//             id: String,
//             title: String,
//             content: String,
//             comments: Vec<String>,
//         },
//     }
// );
