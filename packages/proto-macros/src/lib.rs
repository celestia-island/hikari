extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput, Path};

#[proc_macro_attribute]
pub fn register_routes(arg: TokenStream, input: TokenStream) -> TokenStream {
    let app_page_props = parse_macro_input!(arg as Path);
    let input = parse_macro_input!(input as DeriveInput);

    let root_struct = &input.ident;

    quote!(
        #input

        impl hikari_proto::WebClient<#app_page_props> for #root_struct {
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

            fn ContextShell(&self, props: &hikari_proto::ContextProps<#app_page_props>) -> yew::Html {
               use yew::prelude::*;

                html! {
                    <div></div>
                }
            }
        }
    )
    .into()
}
