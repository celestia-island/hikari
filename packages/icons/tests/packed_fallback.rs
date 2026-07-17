//! The packed archive (packages/icons/resources/mdi_icons.dat) must make
//! icon data available even when the development-time icons/mdi/*.svg
//! download is absent — i.e. in every fresh clone and crates.io build.

#[test]
fn packed_archive_provides_core_icons() {
    for name in [
        "check",
        "close",
        "content-copy",
        "magnify",
        "translate",
        "chevron-down",
        "arrow-up",
    ] {
        let data = hikari_icons::get(name).unwrap_or_else(|| panic!("icon '{name}' missing"));
        let path = data
            .path
            .or_else(|| data.paths.first().and_then(|p| p.d))
            .unwrap_or("");
        assert!(path.starts_with('M'), "icon '{name}' has no path data");
    }
}

#[test]
fn unknown_icons_still_return_none() {
    assert!(hikari_icons::get("definitely-not-an-icon").is_none());
}
