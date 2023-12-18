use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::spanned::Spanned;
use syn::{Data, DeriveInput, Ident};

pub struct DeriveApp {
    ident: Ident,
}

impl Parse for DeriveApp {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, data, .. } = input.parse()?;

        match data {
            Data::Enum(e) => {
                return Err(syn::Error::new(
                    e.enum_token.span(),
                    "expected struct, found enum",
                ))
            }
            Data::Struct(data) => data,
            Data::Union(u) => {
                return Err(syn::Error::new(
                    u.union_token.span(),
                    "expected enum, found union",
                ))
            }
        };

        Ok(Self { ident })
    }
}

pub fn root(input: DeriveApp) -> TokenStream {
    let DeriveApp { ident, .. } = &input;

    quote! {
        #[automatically_derived]
        impl ::hikari_boot::Application for #ident {
            #[allow(bindings_with_variant_name)]
            fn switch() -> ::yew::Html {
                todo!("implement switch")
            }

            fn App() -> yew::Html {
                todo!("implement App")
            }
            
            fn ServerApp(
                url: &String,
                props: &::hikari_boot::AppContext<<Self as ::hikari_boot::Application>::AppProps>
            ) -> yew::Html {
                todo!("implement ServerApp")
            }
        }
    }
}
