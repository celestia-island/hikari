use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Path};

pub(crate) fn as_routes(arg: TokenStream, input: TokenStream) -> TokenStream {
    let app_page_props = parse_macro_input!(arg as Path);
    let input = parse_macro_input!(input as DeriveInput);

    let root_struct_name = &input.ident;

    quote!(
        #input

        impl hikari_proto::WebClient<#app_page_props> for #root_struct_name {
            fn App(&self) -> yew::Html {
                use yew::prelude::*;

                html! {
                    <div></div>
                }
            }

            fn ServerApp(&self, props: &hikari_proto::AppProps<#app_page_props>) -> yew::Html {
                use yew::prelude::*;

                html! {
                    <div></div>
                }
            }
        }
    )
    .into()
}
