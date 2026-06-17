use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::path::Path;
use std::{env, fs};

const ICONS_DIR: &str = "icons";

macro_rules! w {
    ($f:expr, $($arg:tt)*) => {
        writeln!($f, $($arg)*).expect("write failed")
    };
    ($f:expr) => {
        writeln!($f).expect("write failed")
    };
}

fn main() {
    let out_dir = env::var("OUT_DIR").expect("OUT_DIR must be set by Cargo");
    let manifest_dir =
        env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR must be set by Cargo");

    if env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok() {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    let icons_out = Path::new(&out_dir).join(ICONS_DIR);
    fs::create_dir_all(&icons_out).expect("Failed to create icons output directory");

    let md_dir = Path::new(&manifest_dir);
    let data_sets = discover_data_sets(md_dir);

    if data_sets.is_empty() {
        println!("cargo:warning=hikari-icons: no icon data found — generating stubs");
        write_stubs(&icons_out);
        return;
    }

    let mut manifest_modules = Vec::new();

    for (set_name, icons) in &data_sets {
        let dest_enum = icons_out.join(format!("{set_name}_enum.rs"));
        let dest_data = icons_out.join(format!("{set_name}_data.rs"));

        gen_enum(set_name, icons, &dest_enum);
        gen_data(set_name, icons, &dest_data);

        let pascal_type = format!("{}Icon", snake_to_pascal(set_name));
        manifest_modules.push((*set_name, pascal_type));

        println!(
            "cargo:warning=hikari-icons: {} icons for set '{}'",
            icons.len(),
            set_name
        );
    }

    gen_manifest(&manifest_modules, &icons_out.join("manifest.rs"));
}

struct Icon {
    kebab: String,
    pascal: String,
    path_d: String,
}

fn discover_data_sets(dir: &Path) -> HashMap<&'static str, Vec<Icon>> {
    let mut sets = HashMap::new();

    let dat_path = dir.join("icon_data.dat");
    if dat_path.exists() {
        println!("cargo:rerun-if-changed=icon_data.dat");
        let icons = read_tab_separated(&dat_path);
        if !icons.is_empty() {
            sets.insert("mdi", icons);
        }
    }

    for entry in fs::read_dir(dir).unwrap_or_else(|_| panic!("Failed to read {}", dir.display())) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let fname = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };

        if fname == "icon_data.dat" || !fname.ends_with("_data.dat") {
            continue;
        }

        let set_name = &fname[..fname.len() - "_data.dat".len()];
        if sets.contains_key(set_name) {
            continue;
        }

        println!("cargo:rerun-if-changed={fname}");
        let icons = read_tab_separated(&path);
        if !icons.is_empty() {
            sets.insert(Box::leak(set_name.to_string().into_boxed_str()), icons);
        }
    }

    sets
}

fn read_tab_separated(path: &Path) -> Vec<Icon> {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let mut icons = Vec::new();
    for line in std::io::BufReader::new(file).lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let (name, path_d) = match line.split_once('\t') {
            Some(pair) => pair,
            None => continue,
        };
        icons.push(Icon {
            kebab: name.to_string(),
            pascal: kebab_to_pascal(name),
            path_d: path_d.to_string(),
        });
    }
    icons.sort_by(|a, b| a.kebab.cmp(&b.kebab));
    icons
}

fn kebab_to_pascal(s: &str) -> String {
    s.split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

fn snake_to_pascal(s: &str) -> String {
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

fn gen_enum(set_name: &str, icons: &[Icon], dest: &Path) {
    let type_name = format!("{}Icon", snake_to_pascal(set_name));
    let _ = fs::create_dir_all(dest.parent().expect("enum dest should have parent dir"));
    let mut f = fs::File::create(dest)
        .unwrap_or_else(|e| panic!("Failed to create {}: {e}", dest.display()));

    w!(f, "// @generated ({} variants) — DO NOT EDIT", icons.len());
    w!(f);
    w!(f, "#[cfg(feature = \"tairitsu\")]");
    w!(f, "use tairitsu_vdom::IntoAttrValue;");
    w!(f);
    w!(
        f,
        "/// {} icon enum ({} variants)",
        snake_to_pascal(set_name),
        icons.len()
    );
    w!(f, "#[allow(non_camel_case_types)]");
    w!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]");
    w!(f, "pub enum {} {{", type_name);
    for icon in icons {
        w!(f, "    {},", icon.pascal);
    }
    w!(f, "}}");
    w!(f);

    w!(f, "#[rustfmt::skip]");
    w!(f, "impl std::fmt::Display for {} {{", type_name);
    w!(
        f,
        "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{"
    );
    w!(f, "        let name: &str = match self {{");
    for icon in icons {
        w!(
            f,
            "            {}::{} => \"{}\",",
            type_name,
            icon.pascal,
            icon.kebab
        );
    }
    w!(f, "        }};");
    w!(f, "        write!(f, \"{{}}\", name)");
    w!(f, "    }}");
    w!(f, "}}");
    w!(f);

    w!(f, "#[rustfmt::skip]");
    w!(f, "impl std::convert::From<&str> for {} {{", type_name);
    w!(f, "    fn from(s: &str) -> Self {{");
    w!(f, "        match s {{");
    for icon in icons {
        w!(
            f,
            "            \"{}\" => {}::{},",
            icon.kebab,
            type_name,
            icon.pascal
        );
    }
    if set_name == "mdi" {
        w!(f, "            _ => {}::Help,", type_name);
    } else {
        let first = icons
            .first()
            .map_or("Unknown", |i| i.pascal.as_str());
        w!(f, "            _ => {}::{},", type_name, first);
    }
    w!(f, "        }}");
    w!(f, "    }}");
    w!(f, "}}");
    w!(f);

    w!(f, "#[cfg(feature = \"tairitsu\")]");
    w!(f, "impl IntoAttrValue for {} {{", type_name);
    w!(f, "    fn into_attr_value(self) -> Option<String> {{");
    w!(f, "        Some(self.to_string())");
    w!(f, "    }}");
    w!(f, "}}");
}

fn gen_data(set_name: &str, icons: &[Icon], dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().expect("data dest should have parent dir"));
    let mut f = fs::File::create(dest)
        .unwrap_or_else(|e| panic!("Failed to create {}: {e}", dest.display()));
    let entries_name = format!("{}_ENTRIES", set_name.to_uppercase());

    w!(f, "// @generated ({} icons) — DO NOT EDIT", icons.len());
    w!(f);
    w!(f, "#[rustfmt::skip]");
    w!(f, "static {entries_name}: &[(&str, &str)] = &[");
    for icon in icons {
        w!(f, "    (\"{}\",", icon.kebab);
        w!(f, "     \"{}\"),", icon.path_d);
    }
    w!(f, "];");
    w!(f);

    w!(f, "#[rustfmt::skip]");
    w!(f, "pub fn get(name: &str) -> Option<&'static str> {{");
    w!(f, "    {entries_name}");
    w!(f, "        .binary_search_by_key(&name, |(k, _)| k)");
    w!(f, "        .ok()");
    w!(f, "        .map(|i| {entries_name}[i].1)");
    w!(f, "}}");
}

fn gen_manifest(modules: &[(&str, String)], dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().expect("manifest dest should have parent dir"));
    let mut f = fs::File::create(dest)
        .unwrap_or_else(|e| panic!("Failed to create {}: {e}", dest.display()));

    w!(f, "// @generated manifest — DO NOT EDIT");
    w!(f);

    for (set_name, type_name) in modules {
        w!(f, "#[allow(non_camel_case_types)]");
        w!(f, "#[rustfmt::skip]");
        w!(
            f,
            "pub mod {}_enum {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/{}_enum.rs\")); }}",
            set_name,
            ICONS_DIR,
            set_name
        );
        w!(f);
        w!(f, "#[allow(non_camel_case_types)]");
        w!(f, "#[rustfmt::skip]");
        w!(
            f,
            "pub mod {}_data {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/{}_data.rs\")); }}",
            set_name,
            ICONS_DIR,
            set_name
        );
        w!(f);
        w!(f, "pub use {}_enum::{};", set_name, type_name);
        w!(f);
    }

    w!(
        f,
        "pub fn get_icon_path(set: &str, name: &str) -> Option<&'static str> {{"
    );
    w!(f, "    match set {{");
    for (set_name, _) in modules {
        w!(
            f,
            "        \"{}\" => {}_data::get(name),",
            set_name,
            set_name
        );
    }
    w!(f, "        _ => None,");
    w!(f, "    }}");
    w!(f, "}}");
}

fn write_stubs(icons_out: &Path) {
    fs::create_dir_all(icons_out).expect("Failed to create stubs directory");

    let dest_data = icons_out.join("mdi_data.rs");
    let mut f = fs::File::create(&dest_data).expect("Failed to create mdi_data stub");
    w!(
        f,
        "pub fn get(_name: &str) -> Option<&'static str> {{ None }}"
    );

    let dest_enum = icons_out.join("mdi_enum.rs");
    let mut f = fs::File::create(&dest_enum).expect("Failed to create mdi_enum stub");
    w!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]");
    w!(f, "pub enum MdiIcon {{ Help }}");
    w!(f, "impl std::fmt::Display for MdiIcon {{");
    w!(
        f,
        "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{ write!(f, \"help\") }}"
    );
    w!(f, "}}");

    let dest_manifest = icons_out.join("manifest.rs");
    let mut f = fs::File::create(&dest_manifest).expect("Failed to create manifest stub");
    w!(f, "#[allow(non_camel_case_types)]");
    w!(f, "#[rustfmt::skip]");
    w!(
        f,
        "pub mod mdi_enum {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/mdi_enum.rs\")); }}",
        ICONS_DIR
    );
    w!(f);
    w!(f, "#[allow(non_camel_case_types)]");
    w!(f, "#[rustfmt::skip]");
    w!(
        f,
        "pub mod mdi_data {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/mdi_data.rs\")); }}",
        ICONS_DIR
    );
    w!(f);
    w!(f, "pub use mdi_enum::MdiIcon;");
    w!(f);
    w!(
        f,
        "pub fn get_icon_path(set: &str, name: &str) -> Option<&'static str> {{"
    );
    w!(f, "    let _ = set;");
    w!(f, "    let _ = name;");
    w!(f, "    None");
    w!(f, "}}");
}
