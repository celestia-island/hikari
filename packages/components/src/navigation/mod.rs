// hi-components/src/navigation/mod.rs
// Navigation components: Menu, Tabs, Breadcrumb, Sidebar, Stepper, Anchor
//
// Exports are named one by one on purpose: glob re-exports used to hide which
// module a symbol came from, and let the `Steps`/`Stepper` pair overlap in the
// same namespace without anyone noticing which one was canonical.

pub mod anchor;
pub mod breadcrumb;
pub mod menu;
pub mod sidebar;
pub mod stepper;
pub mod steps;
pub mod tabs;

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
pub use anchor::use_scrollspy;
pub use anchor::{Anchor, AnchorBuilder, AnchorItem, AnchorProps};
pub use breadcrumb::{
    Breadcrumb, BreadcrumbComponent, BreadcrumbItem, BreadcrumbItemProps, BreadcrumbProps,
    BreadcrumbSeparator, BreadcrumbSeparatorBuilder, BreadcrumbSeparatorProps,
};
pub use menu::{
    Menu, MenuComponent, MenuContext, MenuItem, MenuItemHeight, MenuItemProps, MenuMode, MenuProps,
    SubMenu, SubMenuProps,
};
pub use sidebar::{
    Sidebar, SidebarComponent, SidebarItem, SidebarItemProps, SidebarLeaf, SidebarLeafProps,
    SidebarProps, SidebarSection, SidebarSectionProps,
};
pub use stepper::{Stepper, StepperComponent, StepperDirection, StepperProps};
// `Steps` and friends are the deprecated shim of `Stepper`; imported by name so
// the overlap is visible at the export site instead of hidden behind a glob.
#[allow(deprecated)]
pub use steps::{StepData, StepStatus, Steps, StepsDirection, StepsProps};
pub use tabs::{TabPane, TabPaneProps, TabPosition, Tabs, TabsComponent, TabsProps};
