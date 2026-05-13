//! Spacing utility classes.

use tairitsu_style::TypedClass;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Padding {
    P0,
    P1,
    P2,
    P3,
    P4,
    P5,
    P6,
    P8,
    P10,
    P12,
}

impl TypedClass for Padding {
    fn class_name(&self) -> &'static str {
        match self {
            Self::P0 => "hi-p-0",
            Self::P1 => "hi-p-1",
            Self::P2 => "hi-p-2",
            Self::P3 => "hi-p-3",
            Self::P4 => "hi-p-4",
            Self::P5 => "hi-p-5",
            Self::P6 => "hi-p-6",
            Self::P8 => "hi-p-8",
            Self::P10 => "hi-p-10",
            Self::P12 => "hi-p-12",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingX {
    Px1,
    Px2,
    Px3,
    Px4,
    Px6,
}

impl TypedClass for PaddingX {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Px1 => "hi-px-1",
            Self::Px2 => "hi-px-2",
            Self::Px3 => "hi-px-3",
            Self::Px4 => "hi-px-4",
            Self::Px6 => "hi-px-6",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingY {
    Py1,
    Py2,
    Py3,
    Py4,
}

impl TypedClass for PaddingY {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Py1 => "hi-py-1",
            Self::Py2 => "hi-py-2",
            Self::Py3 => "hi-py-3",
            Self::Py4 => "hi-py-4",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Margin {
    M0,
    M1,
    M2,
    M3,
    M4,
    M5,
    M6,
    M8,
    Auto,
}

impl TypedClass for Margin {
    fn class_name(&self) -> &'static str {
        match self {
            Self::M0 => "hi-m-0",
            Self::M1 => "hi-m-1",
            Self::M2 => "hi-m-2",
            Self::M3 => "hi-m-3",
            Self::M4 => "hi-m-4",
            Self::M5 => "hi-m-5",
            Self::M6 => "hi-m-6",
            Self::M8 => "hi-m-8",
            Self::Auto => "hi-m-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginX {
    MxAuto,
}

impl TypedClass for MarginX {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MxAuto => "hi-mx-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginY {
    MyAuto,
}

impl TypedClass for MarginY {
    fn class_name(&self) -> &'static str {
        match self {
            Self::MyAuto => "hi-my-auto",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginTop {
    Mt0,
    Mt1,
    Mt2,
    Mt3,
    Mt4,
    Mt5,
    Mt6,
    Mt8,
}

impl TypedClass for MarginTop {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Mt0 => "hi-mt-0",
            Self::Mt1 => "hi-mt-1",
            Self::Mt2 => "hi-mt-2",
            Self::Mt3 => "hi-mt-3",
            Self::Mt4 => "hi-mt-4",
            Self::Mt5 => "hi-mt-5",
            Self::Mt6 => "hi-mt-6",
            Self::Mt8 => "hi-mt-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginBottom {
    Mb0,
    Mb1,
    Mb2,
    Mb3,
    Mb4,
    Mb5,
    Mb6,
    Mb8,
}

impl TypedClass for MarginBottom {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Mb0 => "hi-mb-0",
            Self::Mb1 => "hi-mb-1",
            Self::Mb2 => "hi-mb-2",
            Self::Mb3 => "hi-mb-3",
            Self::Mb4 => "hi-mb-4",
            Self::Mb5 => "hi-mb-5",
            Self::Mb6 => "hi-mb-6",
            Self::Mb8 => "hi-mb-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginLeft {
    Ml0,
    Ml1,
    Ml2,
    Ml3,
    Ml4,
    Ml5,
    Ml6,
    Ml8,
}

impl TypedClass for MarginLeft {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Ml0 => "hi-ml-0",
            Self::Ml1 => "hi-ml-1",
            Self::Ml2 => "hi-ml-2",
            Self::Ml3 => "hi-ml-3",
            Self::Ml4 => "hi-ml-4",
            Self::Ml5 => "hi-ml-5",
            Self::Ml6 => "hi-ml-6",
            Self::Ml8 => "hi-ml-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarginRight {
    Mr0,
    Mr1,
    Mr2,
    Mr3,
    Mr4,
    Mr5,
    Mr6,
    Mr8,
}

impl TypedClass for MarginRight {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Mr0 => "hi-mr-0",
            Self::Mr1 => "hi-mr-1",
            Self::Mr2 => "hi-mr-2",
            Self::Mr3 => "hi-mr-3",
            Self::Mr4 => "hi-mr-4",
            Self::Mr5 => "hi-mr-5",
            Self::Mr6 => "hi-mr-6",
            Self::Mr8 => "hi-mr-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingTop {
    Pt0,
    Pt1,
    Pt2,
    Pt3,
    Pt4,
    Pt5,
    Pt6,
    Pt8,
}

impl TypedClass for PaddingTop {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pt0 => "hi-pt-0",
            Self::Pt1 => "hi-pt-1",
            Self::Pt2 => "hi-pt-2",
            Self::Pt3 => "hi-pt-3",
            Self::Pt4 => "hi-pt-4",
            Self::Pt5 => "hi-pt-5",
            Self::Pt6 => "hi-pt-6",
            Self::Pt8 => "hi-pt-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingBottom {
    Pb0,
    Pb1,
    Pb2,
    Pb3,
    Pb4,
    Pb5,
    Pb6,
    Pb8,
}

impl TypedClass for PaddingBottom {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pb0 => "hi-pb-0",
            Self::Pb1 => "hi-pb-1",
            Self::Pb2 => "hi-pb-2",
            Self::Pb3 => "hi-pb-3",
            Self::Pb4 => "hi-pb-4",
            Self::Pb5 => "hi-pb-5",
            Self::Pb6 => "hi-pb-6",
            Self::Pb8 => "hi-pb-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingLeft {
    Pl0,
    Pl1,
    Pl2,
    Pl3,
    Pl4,
    Pl5,
    Pl6,
    Pl8,
}

impl TypedClass for PaddingLeft {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pl0 => "hi-pl-0",
            Self::Pl1 => "hi-pl-1",
            Self::Pl2 => "hi-pl-2",
            Self::Pl3 => "hi-pl-3",
            Self::Pl4 => "hi-pl-4",
            Self::Pl5 => "hi-pl-5",
            Self::Pl6 => "hi-pl-6",
            Self::Pl8 => "hi-pl-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaddingRight {
    Pr0,
    Pr1,
    Pr2,
    Pr3,
    Pr4,
    Pr5,
    Pr6,
    Pr8,
}

impl TypedClass for PaddingRight {
    fn class_name(&self) -> &'static str {
        match self {
            Self::Pr0 => "hi-pr-0",
            Self::Pr1 => "hi-pr-1",
            Self::Pr2 => "hi-pr-2",
            Self::Pr3 => "hi-pr-3",
            Self::Pr4 => "hi-pr-4",
            Self::Pr5 => "hi-pr-5",
            Self::Pr6 => "hi-pr-6",
            Self::Pr8 => "hi-pr-8",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpaceBetween {
    SpaceY2,
    SpaceY4,
    SpaceY6,
}

impl TypedClass for SpaceBetween {
    fn class_name(&self) -> &'static str {
        match self {
            Self::SpaceY2 => "hi-space-y-2",
            Self::SpaceY4 => "hi-space-y-4",
            Self::SpaceY6 => "hi-space-y-6",
        }
    }
}
