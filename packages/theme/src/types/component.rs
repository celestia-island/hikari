use serde::{Deserialize, Serialize};
use yuuka::derive_enum;

derive_enum!(
    #[derive(PartialEq, Serialize, Deserialize)]
    pub enum ComponentType {
        Container(enum Container {
            Layout(enum Layout {
                Aside,
                Container,
                Main,
                Header,
                Footer,
            }),
            Place(enum Place {
                Column,
                Row,
                Grid,
                Space,
                Divider,
                Skeleton,
            }),
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
        Data(enum Data {
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
            Media(enum Media {
                Image,
                Charts,
                Scene,
            }),
            Paragraph(enum Paragraph {
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
                    Size,
                    Sizing,
                    Divider,
                    Split,
                    Underline,
                }),
                Rich,
                Affix,
                Avatar,
                Badge,
                Chip,
                Icon,
            })
        }),
        Form(enum Form {
            Button(enum Button {
                Button,
                IconButton,
                ButtonGroup,
                Tag,
            }),
            Input(enum Input {
                Text,
                TextArea,
                Rich,
            }),
            Picker(enum Picker {
                Color,
                File,
                Date,
                Time,
                DateTime,
            }),
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
        Navigation(enum Navigation {
            Aside(enum Aside {
                Nav(enum Nav {
                    TopNav,
                    BottomNav,
                }),
                Breadcrumb,
                Pagination,
                Steps,
                Tabs,
            }),
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
