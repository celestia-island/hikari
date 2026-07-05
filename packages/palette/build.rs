use std::collections::{BTreeMap, BTreeSet};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::{env, fs};

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
        "cargo:warning=hikari-palette: {} component groups, {} classes generated",
        all_classes.len(),
        all_classes.values().map(Vec::len).sum::<usize>()
    );

    // --- Color collections (opt-in via `collection-<name>` features) ---
    // Each enabled collection's TOML is parsed at build time and emitted as a
    // `pub const` block. A disabled collection is never read, never compiled.
    generate_collections(&manifest_dir, &out_dir);
}

/// Parse every enabled `collection-<name>` feature's `data/<name>.toml` and
/// emit `OUT_DIR/collections/<name>.rs` — a module of `pub const` `Color`s.
///
/// The feature→file mapping is: feature `collection-chinese` → `data/chinese.toml`.
fn generate_collections(manifest_dir: &str, out_dir: &str) {
    // Map of (feature suffix) → toml filename. Add new collections here and in
    // Cargo.toml's `[features]`.
    let collections = [
        ("chinese", "chinese.toml"),
        // ("japanese", "japanese.toml"),
        // ("tailwind", "tailwind.toml"),
    ];

    let features: BTreeSet<String> = env::vars()
        .filter_map(|(k, _)| k.strip_prefix("CARGO_FEATURE_COLLECTION_").map(str::to_owned))
        .map(|f| f.to_lowercase().replace('_', "-"))
        .collect();

    if features.is_empty() {
        // No collections enabled — emit an empty dir so include! is still valid
        // when the `collections` feature itself is on but no sub-collection is.
        let _ = fs::create_dir_all(Path::new(out_dir).join("collections"));
        return;
    }

    let collections_dir = Path::new(out_dir).join("collections");
    fs::create_dir_all(&collections_dir)
        .expect("Failed to create output directory for collections");

    for (name, file) in collections {
        if !features.contains(name) {
            continue;
        }
        let toml_path = Path::new(manifest_dir).join("data").join(file);
        let Ok(content) = fs::read_to_string(&toml_path) else {
            panic!(
                "hikari-palette: collection '{}' is enabled but data/{} is missing",
                name, file
            );
        };
        let colors = parse_color_toml(&content)
            .unwrap_or_else(|e| panic!("hikari-palette: failed to parse {file}: {e}"));
        emit_collection_module(name, &colors, &collections_dir.join(format!("{name}.rs")));
        println!("cargo:warning=hikari-palette: collection '{name}' — {} colors", colors.len());
    }
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
    let (mx, mn, delta) = (mx as i32, mn as i32, delta as i32);
    let hue_milli = if mx == r {
        60000 * (g - b) / delta
    } else if mx == g {
        60000 * (b - r) / delta + 120_000
    } else {
        60000 * (r - g) / delta + 240_000
    };
    let hue = ((hue_milli % 360_000) + 360_000) % 360_000;
    let deg = hue / 1000;

    if deg < 18 || deg >= 348 {
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
        let prefix = format!("hi-{stem}-");
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
        .strip_prefix("hi-")
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
