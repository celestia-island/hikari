#[macro_export]
macro_rules! generate_structs {
    ($(#[$meta:meta])* $vis:vis struct $name:ident { $($field:tt)* } $($rest:tt)*) => {
        $(#[$meta])*
        $vis struct $name {
            $($field)*
        }
        generate_structs! { $($rest)* }
    };
    () => {}
}

#[macro_export]
macro_rules! generate_app {
    (
        $(#[$route_meta:meta])*
        $route_vis:vis enum $route_enum:ident {
            $(
                $(#[$($variant_meta:meta)*])*
                $variant:ident $( { $( $field:ident : $field_ty:ty ),* } )?
            )*
        }

        $($rest:tt)*
    ) => {
        #[derive(yew_router::Routable)]
        $(#[$route_meta])*
        $route_vis enum $route_enum {
            $(
                $(#[$($variant_meta)*])*
                $variant $( { $( $field : $field_ty ),* } )?
            )*
        }

        generate_structs! { $($rest)* }

        #[cfg(feature = "web")]
        impl $props_enum {
            $props_vis fn hydrate(element: web_sys::Element) -> Result<Self, JsValue> {
                let props_json = element
                    .get_attribute("_props")
                    .ok_or_else(|| JsValue::from_str("Missing _props attribute"))?;
                let props: Self = serde_json::from_str(&props_json)?;
                Ok(props)
            }
        }

        #[cfg(not(feature = "web"))]
        impl $props_enum {
            $props_vis fn render_to_string(&self) -> Result<String, JsValue> {
                let props_json = serde_json::to_string(self)?;
                Ok(props_json)
            }
        }
    };
}
