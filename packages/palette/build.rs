use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::{env, fs};

/// Known collections: (name, data file). Add new collections here.
const KNOWN_COLLECTIONS: &[(&str, &str)] = &[
    ("chinese", "chinese.toml"),
    ("tailwind", "tailwind.toml"),
    // ("japanese", "japanese.toml"),
    // ("material", "material.toml"),
];

fn main() {
    let manifest_dir =
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set by Cargo");
    let out_dir = env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");

    let workspace_root = env::var("CARGO_WORKSPACE_DIR").map_or_else(
        |_| {
            Path::new(&manifest_dir)
                .parent()
                .expect("palette package should be under workspace root")
                .to_path_buf()
        },
        PathBuf::from,
    );

    let scss_dirs = vec![
        workspace_root
            .join("components")
            .join("src")
            .join("styles")
            .join("components"),
        workspace_root.join("theme").join("styles"),
    ];

    let mut all_classes: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for scss_dir in &scss_dirs {
        if !scss_dir.exists() {
            continue;
        }
        collect_from_dir(scss_dir, &mut all_classes);
    }

    let classes_dir = Path::new(&out_dir).join("classes");
    fs::create_dir_all(&classes_dir)
        .expect("Failed to create output directory for generated classes");
    let dest = classes_dir.join("generated.rs");
    generate(&all_classes, &dest);

    println!(
        "cargo:warning={} component groups, {} classes generated",
        all_classes.len(),
        all_classes.values().map(Vec::len).sum::<usize>()
    );

    // --- Color collections (opt-in via workspace metadata) ---
    //
    // The business project declares which collections it wants in its workspace
    // root Cargo.toml:
    //
    //   [workspace.metadata.hikari]
    //   collections = ["chinese"]
    //
    // For each listed collection we (a) emit `cargo:rustc-cfg=hikari_collection_<name>`
    // so the crate's `#[cfg(hikari_collection_<name>)]` modules compile in, and

    // First, declare every *possible* collection cfg to the checker so Cargo
    // doesn't warn about unexpected cfg names regardless of which are active.
    for (name, _) in KNOWN_COLLECTIONS {
        println!("cargo::rustc-check-cfg=cfg(hikari_collection_{name})");
    }
    // (b) generate the `pub const` block from data/<name>.toml.
    //
    // No Cargo features involved — selection is a property of the consuming
    // workspace, not a feature flag on this crate.
    generate_collections(&manifest_dir, &out_dir);
}

/// Walk up from this crate's manifest dir to find the workspace root (the first
/// ancestor whose `Cargo.toml` contains a `[workspace]` table). Mirrors the
/// pattern already used by `hikari-icons`' build script.
fn find_workspace_root(manifest_dir: &str) -> Option<PathBuf> {
    let mut current = PathBuf::from(manifest_dir);
    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists()
            && let Ok(content) = fs::read_to_string(&cargo_toml)
            && content.contains("[workspace]")
        {
            return Some(current);
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return None,
        }
    }
}

/// Read `[workspace.metadata.hikari.palette].collections` from the workspace root, then
/// for each requested collection: emit a `cargo:rustc-cfg=hikari_collection_<n>`
/// flag and generate its `pub const` module into OUT_DIR.
fn generate_collections(manifest_dir: &str, out_dir: &str) {
    // Always create the collections dir so the `include!` site is valid even
    // when no collection is requested.
    let collections_dir = Path::new(out_dir).join("collections");
    let _ = fs::create_dir_all(&collections_dir);

    let Some(workspace_root) = find_workspace_root(manifest_dir) else {
        // Not in a workspace (e.g. a standalone crates.io build): no
        // collections. Still emit the color! macro (empty) so the include! in
        // lib.rs resolves.
        emit_color_macro(&[], &Path::new(out_dir).join("color_macro.rs"));
        return;
    };

    let requested = read_workspace_collections(&workspace_root);

    // Accumulate every enabled collection's parsed colors so we can also emit a
    // combined `color!` macro that resolves any name across collections.
    let mut all_enabled: Vec<(&str, Vec<ColorEntry>)> = Vec::new();

    for name in &requested {
        let Some(&(_, file)) = KNOWN_COLLECTIONS.iter().find(|(n, _)| n == name) else {
            panic!(
                "hikari-palette: unknown collection '{name}' in [workspace.metadata.hikari.palette].collections. \
                 Known: {}",
                KNOWN_COLLECTIONS
                    .iter()
                    .map(|(n, _)| *n)
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        };

        // (a) Set the cfg flag so `#[cfg(hikari_collection_<name>)]` modules compile.
        let cfg_flag = format!("hikari_collection_{name}");
        println!("cargo:rustc-cfg={cfg_flag}");

        // (b) Generate the const block from the TOML.
        let toml_path = Path::new(manifest_dir).join("data").join(file);
        let Ok(content) = fs::read_to_string(&toml_path) else {
            panic!("hikari-palette: collection '{name}' is requested but data/{file} is missing");
        };
        let colors = parse_color_toml(&content)
            .unwrap_or_else(|e| panic!("hikari-palette: failed to parse {file}: {e}"));
        emit_collection_module(name, &colors, &collections_dir.join(format!("{name}.rs")));
        println!(
            "cargo:warning=collection '{name}' — {} colors",
            colors.len()
        );
        all_enabled.push((name, colors));
    }

    // (c) Emit the combined `color!` macro covering all enabled collections.
    emit_color_macro(&all_enabled, &Path::new(out_dir).join("color_macro.rs"));
}

/// Parse `[workspace.metadata.hikari.palette].collections` from the workspace
/// root `Cargo.toml`. Returns an empty vec if absent or malformed (no panic — a
/// bare crate with no palette configuration is a valid state).
fn read_workspace_collections(workspace_root: &Path) -> Vec<String> {
    let cargo_toml = workspace_root.join("Cargo.toml");
    let Ok(content) = fs::read_to_string(&cargo_toml) else {
        return Vec::new();
    };

    // Minimal scan: find the `[workspace.metadata.hikari.palette]` table and
    // read its `collections = [...]` array. Avoids depending on the `toml`
    // crate in the build script.
    let mut in_table = false;
    for raw in content.lines() {
        let line = raw.trim();
        if line.starts_with('[') {
            in_table = line == "[workspace.metadata.hikari.palette]";
            continue;
        }
        if !in_table {
            continue;
        }
        if let Some(rest) = line.strip_prefix("collections") {
            let rest = rest.trim_start();
            if let Some(rest) = rest.strip_prefix('=') {
                return parse_string_array(rest.trim());
            }
        }
    }
    Vec::new()
}

/// Parse a `["a", "b"]` literal into a Vec of trimmed strings. Tolerant of
/// multi-line arrays and stray comments.
fn parse_string_array(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_str = false;
    for ch in s.chars() {
        if in_str {
            if ch == '"' {
                out.push(cur.trim().to_string());
                cur.clear();
                in_str = false;
            } else {
                cur.push(ch);
            }
        } else if ch == '"' {
            in_str = true;
        } else if ch == ']' {
            break;
        }
    }
    out
}

/// A parsed entry: (name, r, g, b). The category is inferred in Rust at the use
/// site via `Color::from_rgb_hex`, so we only need the RGB here.
struct ColorEntry {
    name: String,
    r: u8,
    g: u8,
    b: u8,
}

/// Minimal TOML reader for the collection format. We only care about the
/// `[colors]` table: `name = "#rrggbb"`. Avoids pulling in the `toml` crate in
/// the build script (keeps build deps light).
fn parse_color_toml(content: &str) -> Result<Vec<ColorEntry>, String> {
    let mut entries = Vec::new();
    let mut in_colors = false;
    for raw in content.lines() {
        let line = raw.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if line.starts_with('[') {
            in_colors = line == "[colors]";
            continue;
        }
        if !in_colors {
            continue;
        }
        // key = "value"  (key may be quoted or bare; may be CJK)
        let Some((key, val)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim().trim_matches('"');
        let val = val.trim().trim_matches('"');
        let hex = val.strip_prefix('#').unwrap_or(val);
        if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
            // Skip non-color values silently (e.g. metadata in other tables).
            continue;
        }
        let r = u8::from_str_radix(&hex[0..2], 16).map_err(|e| e.to_string())?;
        let g = u8::from_str_radix(&hex[2..4], 16).map_err(|e| e.to_string())?;
        let b = u8::from_str_radix(&hex[4..6], 16).map_err(|e| e.to_string())?;
        entries.push(ColorEntry {
            name: key.to_string(),
            r,
            g,
            b,
        });
    }
    Ok(entries)
}

fn emit_collection_module(name: &str, colors: &[ColorEntry], dest: &Path) {
    let mut f = fs::File::create(dest).expect("Failed to create collection module");
    let _ = writeln!(
        f,
        "// @generated — DO NOT EDIT\n// Generated by hikari-palette build.rs from data/{name}.toml\n\n\
         use crate::Color;\n\n"
    );

    // Group by inferred category for readable source.
    let mut by_cat: BTreeMap<&str, Vec<&ColorEntry>> = BTreeMap::new();
    for c in colors {
        let cat = infer_category_name(c.r, c.g, c.b);
        by_cat.entry(cat).or_default().push(c);
    }

    for (cat, group) in by_cat {
        let _ = writeln!(f, "// === {cat} ({}) ===", group.len());
        for c in group {
            // Emit as `pub const <name>: Color = Color::from_rgb_hex(r, g, b).with_name("<name>");`
            let _ = writeln!(
                f,
                "pub const {name}: Color = Color::from_rgb_hex(0x{r:02x}, 0x{g:02x}, 0x{b:02x}).with_name(\"{name}\");",
                name = c.name,
                r = c.r,
                g = c.g,
                b = c.b,
            );
        }
        let _ = writeln!(f);
    }
}

/// Emit `OUT_DIR/color_macro.rs` — a `macro_rules! color` that resolves a
/// color name (string literal) to its `Color` constant at compile time, with
/// zero runtime cost. The macro spans every enabled collection; an unknown name
/// yields a `compile_error!` pointing at the offending literal.
///
/// Generated shape (one arm per color, across all collections):
///
/// ```ignore
/// macro_rules! color {
///     ("red_500") => { $crate::collections::tailwind::red_500 };
///     ("粉红")    => { $crate::collections::chinese::粉红 };
///     // …
///     ($name:literal) => {
///         compile_error!(concat!(
///             "hikari-palette: unknown color '", $name,
///             "'. Enable a collection in [workspace.metadata.hikari.palette].collections."
///         ))
///     };
/// }
/// ```
fn emit_color_macro(enabled: &[(&str, Vec<ColorEntry>)], dest: &Path) {
    let total: usize = enabled.iter().map(|(_, c)| c.len()).sum();
    if total == 0 {
        // No collections enabled — emit a macro that always errors, so misuse
        // fails loudly rather than silently producing nothing.
        let mut f = fs::File::create(dest).expect("Failed to create color_macro.rs");
        let _ = writeln!(
            f,
            "// @generated — DO NOT EDIT (no collections enabled)\n\
             #[macro_export]\n\
             macro_rules! color {{\n\
             \x20   ($name:literal) => {{\n\
             \x20       compile_error!(concat!(\n\
             \x20           \"hikari-palette: color!('\", $name, \"') is unavailable — \",\n\
             \x20           \"no collections enabled. Add one in [workspace.metadata.hikari.palette].collections.\"\n\
             \x20       ))\n\
             \x20   }};\n\
             }}"
        );
        return;
    }

    let mut f = fs::File::create(dest).expect("Failed to create color_macro.rs");
    let _ = writeln!(
        f,
        "// @generated — DO NOT EDIT\n// Generated by hikari-palette build.rs\n// \
         Resolves any color name from the {} enabled collection(s) at compile time.\n\n\
         #[macro_export]\n\
         macro_rules! color {{",
        enabled.len()
    );

    for (coll, colors) in enabled {
        let _ = writeln!(f, "    // === collection: {coll} ===");
        for c in colors {
            // Arm: ("name") => { $crate::collections::<coll>::<name> }
            let _ = writeln!(
                f,
                "    (\"{name}\") => {{ $crate::collections::{coll}::{name} }};",
                name = c.name
            );
        }
    }

    // Fallback: unknown name → compile_error pointing at the literal.
    let _ = writeln!(
        f,
        "    ($name:literal) => {{\n\
         \x20       compile_error!(concat!(\n\
         \x20           \"hikari-palette: color!('\", $name, \"') is not in any enabled collection. \",\n\
         \x20           \"Enable one in [workspace.metadata.hikari.palette].collections.\"\n\
         \x20       ))\n\
         \x20   }};\n\
         }}"
    );
    println!(
        "cargo:warning=color! macro — {total} names resolvable across {} collection(s)",
        enabled.len()
    );
}

/// Mirror of `ColorCategory::infer`, returning the variant name as a string so
/// the generated source stays grouped/legible. Keep in sync with
/// `ColorCategory::infer` in `src/colors/mod.rs`.
fn infer_category_name(r: u8, g: u8, b: u8) -> &'static str {
    let mx = r.max(g).max(b);
    let mn = r.min(g).min(b);
    if mx >= 240 && mn >= 240 {
        return "White";
    }
    if mx <= 32 {
        return "Black";
    }
    let delta = mx - mn;
    if delta <= 24 {
        return if mx >= 128 { "Gray" } else { "Black" };
    }

    // HSL hue in degrees (integer math).
    let (r, g, b) = (r as i32, g as i32, b as i32);
    let (mx, delta) = (mx as i32, delta as i32);
    let hue_milli = if mx == r {
        60000 * (g - b) / delta
    } else if mx == g {
        60000 * (b - r) / delta + 120_000
    } else {
        60000 * (r - g) / delta + 240_000
    };
    let hue = ((hue_milli % 360_000) + 360_000) % 360_000;
    let deg = hue / 1000;

    if !(18..348).contains(&deg) {
        "Red"
    } else if deg < 48 {
        "Orange"
    } else if deg < 80 {
        "Yellow"
    } else if deg < 160 {
        "Green"
    } else if deg < 200 {
        "Cyan"
    } else if deg < 260 {
        "Blue"
    } else {
        "Purple"
    }
}

fn collect_from_dir(dir: &Path, out: &mut BTreeMap<String, Vec<String>>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    let mut files: Vec<_> = entries
        .filter_map(Result::ok)
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|s| s == "scss")
        })
        .filter(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            !name.starts_with('_') && !name.ends_with("-vars.scss")
        })
        .collect();
    files.sort_by_key(std::fs::DirEntry::file_name);

    for entry in files {
        let path = entry.path();
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };

        let group_name = stem.replace('-', "_");
        let prefix = format!("hk-{stem}-");
        let hikari_prefix = format!("hikari-{stem}-");

        let classes = extract_classes(&content, &prefix, &hikari_prefix);
        if classes.is_empty() {
            continue;
        }

        out.entry(group_name).or_default().extend(classes);
    }
}

fn extract_classes(scss: &str, prefix: &str, hikari_prefix: &str) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut classes = Vec::new();
    let re = regex_lite::Regex::new(r"\.((?:hi-|hikari-)[a-zA-Z][a-zA-Z0-9_-]*)")
        .expect("regex pattern is statically validated");

    for line in scss.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") || trimmed.starts_with("/*") {
            continue;
        }

        for m in re.find_iter(trimmed) {
            let class = m.as_str()[1..].to_string();
            if !class.starts_with(prefix) && !class.starts_with(hikari_prefix) {
                continue;
            }
            if seen.insert(class.clone()) {
                classes.push(class);
            }
        }
    }

    classes
}

fn class_to_variant(class: &str) -> String {
    let stripped = class
        .strip_prefix("hk-")
        .or_else(|| class.strip_prefix("hikari-"))
        .unwrap_or(class);
    stripped
        .split('-')
        .filter(|p| !p.is_empty())
        .map(|part| {
            let mut c = part.chars();
            c.next().map_or_else(String::new, |first| {
                first.to_uppercase().to_string() + c.as_str()
            })
        })
        .collect()
}

fn generate(all_classes: &BTreeMap<String, Vec<String>>, dest: &Path) {
    let mut f = fs::File::create(dest).expect("Failed to create generated classes file");

    writeln!(
        f,
        "// @generated — DO NOT EDIT\n// Generated by hikari-palette build.rs from SCSS sources\n"
    )
    .expect("Failed to write generated file header");

    for (group, classes) in all_classes {
        let enum_name = to_pascal(group.as_str());

        let mut seen_variants = BTreeSet::new();
        let mut deduped = Vec::new();
        for class in classes {
            let variant = class_to_variant(class);
            if seen_variants.insert(variant.clone()) {
                deduped.push((variant, class));
            }
        }

        if deduped.is_empty() {
            continue;
        }

        writeln!(f, "/// Auto-generated from SCSS").expect("Failed to write enum doc comment");
        writeln!(f, "#[derive(Debug, Clone, Copy, PartialEq, Eq)]")
            .expect("Failed to write derive macro");
        writeln!(f, "pub enum {enum_name} {{")
            .unwrap_or_else(|e| panic!("Failed to write enum declaration for {enum_name}: {e}"));

        for (variant, class) in &deduped {
            writeln!(f, "    /// `{class}`")
                .unwrap_or_else(|e| panic!("Failed to write variant {variant}: {e}"));
            writeln!(f, "    {variant},")
                .unwrap_or_else(|e| panic!("Failed to write variant {variant}: {e}"));
        }

        writeln!(f, "}}").unwrap_or_else(|e| panic!("Failed to close enum {enum_name}: {e}"));
        writeln!(f).expect("Failed to write blank line");

        writeln!(f, "impl tairitsu_style::TypedClass for {enum_name} {{")
            .unwrap_or_else(|e| panic!("Failed to write impl block for {enum_name}: {e}"));
        writeln!(f, "    fn class_name(&self) -> &'static str {{")
            .expect("Failed to write class_name fn");
        writeln!(f, "        match self {{").expect("Failed to write match");

        for (variant, class) in &deduped {
            writeln!(f, "            {enum_name}::{variant} => \"{class}\",").unwrap_or_else(|e| {
                panic!("Failed to write match arm {enum_name}::{variant}: {e}")
            });
        }

        writeln!(f, "        }}").expect("Failed to close match");
        writeln!(f, "    }}").expect("Failed to close class_name fn");
        writeln!(f, "}}").unwrap_or_else(|e| panic!("Failed to close impl for {enum_name}: {e}"));
        writeln!(f).expect("Failed to write blank line");
    }
}

fn to_pascal(s: &str) -> String {
    s.split('_')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}
