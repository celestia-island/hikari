//! Platform abstraction layer for components
//!
//! This module provides unified platform APIs using tairitsu's WIT infrastructure.
//! No platform-specific conditional compilation - WASI works everywhere.

mod wit;

pub use wit::*;
