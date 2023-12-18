use std::collections::HashMap;

use proc_macro2::TokenStream;
use quote::quote;
use syn::{
    parse::{Parse, ParseStream},
    punctuated::Punctuated,
    spanned::Spanned,
    Data, DeriveInput, Fields, Ident, Path, Type, Variant,
};

const COMPONENT_ATTR_IDENT: &str = "component";

#[derive(Debug, Clone, PartialEq)]
pub struct Component {
    component: Path,
    props: Option<Type>,
}

pub type Components = HashMap<Ident, Component>;

pub struct DeriveAppProps {
    ident: Ident,
    components: Components,
}

impl Parse for DeriveAppProps {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let DeriveInput { ident, data, .. } = input.parse()?;

        let data = match data {
            Data::Enum(data) => data,
            Data::Struct(s) => {
                return Err(syn::Error::new(
                    s.struct_token.span(),
                    "expected enum, found struct",
                ))
            }
            Data::Union(u) => {
                return Err(syn::Error::new(
                    u.union_token.span(),
                    "expected enum, found union",
                ))
            }
        };

        let components = parse_variants_attributes(&data.variants)?;

        Ok(Self { ident, components })
    }
}

fn parse_variants_attributes(
    variants: &Punctuated<Variant, syn::token::Comma>,
) -> syn::Result<Components> {
    let mut components: Components = Default::default();

    for variant in variants.iter() {
        let attrs = &variant.attrs;
        let at_attrs = attrs
            .iter()
            .filter(|attr| attr.path().is_ident(COMPONENT_ATTR_IDENT))
            .collect::<Vec<_>>();

        let attr = match at_attrs.len() {
            1 => *at_attrs.first().unwrap(),
            0 => {
                return Err(syn::Error::new(
                    variant.span(),
                    format!("{COMPONENT_ATTR_IDENT} attribute must be present on every variant"),
                ))
            }
            _ => {
                return Err(syn::Error::new_spanned(
                    quote! { #(#at_attrs)* },
                    format!("only one {COMPONENT_ATTR_IDENT} attribute must be present"),
                ))
            }
        };

        let component_path = attr.parse_args::<Path>()?;

        let field = match &variant.fields {
            Fields::Named(ref field) => {
                return Err(syn::Error::new(
                    field.span(),
                    "only unnamed fields are supported",
                ));
            }
            Fields::Unnamed(ref fields) => {
                if fields.unnamed.len() > 1 {
                    return Err(syn::Error::new(
                        fields.span(),
                        "only one field is supported",
                    ));
                }
                Some(fields.unnamed.first().unwrap().ty.clone())
            }
            Fields::Unit => None,
        };

        components.insert(
            variant.ident.clone(),
            Component {
                component: component_path,
                props: field,
            },
        );
    }

    Ok(components)
}

pub fn root(input: DeriveAppProps) -> TokenStream {
    let DeriveAppProps {
        components, ident, ..
    } = &input;

    quote! {
        #[automatically_derived]
        impl ::hikari_boot::AppProps for #ident {
        }
    }
}
