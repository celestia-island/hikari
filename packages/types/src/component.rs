use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use strum::{Display, EnumIter, EnumString, IntoEnumIterator};
use yuuka::derive_enum;

derive_enum!(
    #[macro_export]
    #[derive(PartialEq, Copy, Serialize, Deserialize, Display, EnumIter)]
    #[macros_recursive(strum(serialize_all = "snake_case"))]
    pub enum ComponentType {
        #[derive(EnumString)]
        #[strum(prefix = "container/")]
        Container(enum Container {
            #[derive]
            #[strum(prefix = "container/layout/")]
            Layout(enum Layout {
                Aside,
                Container,
                Main,
                Header,
                Footer,
            }),
            #[derive]
            #[strum(prefix = "container/place/")]
            Place(enum Place {
                Column,
                Row,
                Grid,
                Space,
                Divider,
                Skeleton,
            }),
            #[derive]
            #[strum(prefix = "container/system/")]
            System(enum System {
                Flex,
                Anchor,
                Modal,
                Scrollable,
                Resizable,
                Draggable,
                Cursor,
                Breakpoint,
            })
        }),
        #[derive(EnumString)]
        #[strum(prefix = "data/")]
        Data(enum Data {
            #[derive]
            #[strum(prefix = "data/display/")]
            Block(enum Block {
                List,
                Progress,
                Tree,
                Paper,
                Card,
                Carousel,
                Collapse,
                Masonry,
            }),
            #[derive]
            #[strum(prefix = "data/media/")]
            Media(enum Media {
                Image,
                Charts,
                Scene,
            }),
            #[derive]
            #[strum(prefix = "data/paragraph/")]
            Paragraph(enum Paragraph {
                Rich,
                Affix,
                Avatar,
                Badge,
                Chip,
                Icon,
            }),
            #[derive]
            #[strum(prefix = "data/typography/")]
            Typography(enum Typography {
                Sub,
                Sup,
                Bold,
                Code,
                Sample,
                Delete,
                IsolateDirection,
                OverrideDirection,
                Italic,
                Mark,
                BlockQuote,
                Quote,
                Ruby,
                Sizing,
                Divider,
                Split,
                Underline,
            }),
        }),
        #[derive(EnumString)]
        #[strum(prefix = "form/")]
        Form(enum Form {
            #[derive]
            #[strum(prefix = "form/button/")]
            Button(enum Button {
                Button,
                IconButton,
                ButtonGroup,
                Tag,
            }),
            #[derive]
            #[strum(prefix = "form/input/")]
            Input(enum Input {
                Text,
                TextArea,
                Rich,
            }),
            #[derive]
            #[strum(prefix = "form/picker/")]
            Picker(enum Picker {
                Color,
                File,
                Date,
                Time,
                DateTime,
            }),
            #[derive]
            #[strum(prefix = "form/selector/")]
            Selector(enum Selector {
                MultiSelect,
                CheckBox,
                Radio,
                Select,
                Switch,
                Slider,
                Range,
                Rating,
            }),
        }),
        #[derive(EnumString)]
        #[strum(prefix = "navigation/")]
        Navigation(enum Navigation {
            #[derive]
            #[strum(prefix = "navigation/aside/")]
            Aside(enum Aside {
                TopNav,
                BottomNav,
                Breadcrumb,
                Pagination,
                Steps,
                Tabs,
            }),
            #[derive]
            #[strum(prefix = "navigation/modal/")]
            Modal(enum Modal {
                Drawer,
                Menu,
                MessageBox,
                Notification,
                Popover,
                SpeddDial,
                Tooltip,
            })
        })
    }
);

macro_rules! iter_component_type {
    ($ty: ident, $parent: ident) => {
        $ty::iter()
            .map(|x| (ComponentType::$parent($parent::$ty(x)), x.to_string()))
            .collect::<Vec<_>>()
    };
}

static MAPPER: Lazy<Vec<(ComponentType, String)>> = Lazy::new(|| {
    [
        iter_component_type!(Layout, Container),
        iter_component_type!(Place, Container),
        iter_component_type!(System, Container),
        iter_component_type!(Block, Data),
        iter_component_type!(Media, Data),
        iter_component_type!(Paragraph, Data),
        iter_component_type!(Typography, Data),
        iter_component_type!(Button, Form),
        iter_component_type!(Input, Form),
        iter_component_type!(Picker, Form),
        iter_component_type!(Selector, Form),
        iter_component_type!(Aside, Navigation),
        iter_component_type!(Modal, Navigation),
    ]
    .concat()
});

impl FromStr for ComponentType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Some((ty, _)) = MAPPER.iter().find(|(_, x)| x == &s) {
            Ok(*ty)
        } else {
            Err(anyhow!("Invalid component type"))
        }
    }
}
