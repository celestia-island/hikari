use proc_macro2::TokenStream;
use quote::quote;
use syn::parse::{Parse, ParseStream};
use syn::{DeriveInput, Ident};

pub struct DeriveAppProps {
    ident: Ident,
}

impl Parse for DeriveAppProps {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, .. } = input.parse()?;

        Ok(Self { ident })
    }
}

pub fn root(input: DeriveAppProps) -> TokenStream {
    let DeriveAppProps { ident, .. } = &input;

    quote! {
        #[automatically_derived]
        impl ::hikari_boot::DeriveAppPropsTrait for #ident {
            type AppProps = Self;
        }
    }
}
