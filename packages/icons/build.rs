use std::collections::HashMap;
use std::io::{BufRead, Write};
use std::path::Path;
use std::{env, fs};

const ICONS_DIR: &str = "icons";

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();

    if env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok() {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    let icons_out = Path::new(&out_dir).join(ICONS_DIR);
    fs::create_dir_all(&icons_out).unwrap();

    let md_dir = Path::new(&manifest_dir);
    let data_sets = discover_data_sets(md_dir);

    if data_sets.is_empty() {
        eprintln!("hikari-icons: no icon data found — generating stubs");
        write_stubs(&icons_out);
        return;
    }

    let mut manifest_modules = Vec::new();

    for (set_name, icons) in &data_sets {
        let dest_enum = icons_out.join(format!("{}_enum.rs", set_name));
        let dest_data = icons_out.join(format!("{}_data.rs", set_name));

        gen_enum(set_name, icons, &dest_enum);
        gen_data(set_name, icons, &dest_data);

        let pascal_type = format!("{}Icon", snake_to_pascal(set_name));
        manifest_modules.push((*set_name, pascal_type));

        eprintln!("hikari-icons: {} icons for set '{}'", icons.len(), set_name);
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

        println!("cargo:rerun-if-changed={}", fname);
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
    let _ = fs::create_dir_all(dest.parent().unwrap());
    let mut f = fs::File::create(dest).unwrap();

    writeln!(f, "// @generated ({} variants) — DO NOT EDIT", icons.len()).unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[cfg(feature = \"tairitsu\")]").unwrap();
    writeln!(f, "use tairitsu_vdom::IntoAttrValue;").unwrap();
    writeln!(f).unwrap();
    writeln!(f, "/// {} icon enum ({} variants)", snake_to_pascal(set_name), icons.len()).unwrap();
    writeln!(f, "#[allow(non_camel_case_types)]").unwrap();
    writeln!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]").unwrap();
    writeln!(f, "pub enum {} {{", type_name).unwrap();
    for icon in icons {
        writeln!(f, "    {},", icon.pascal).unwrap();
    }
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "impl std::fmt::Display for {} {{", type_name).unwrap();
    writeln!(f, "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{").unwrap();
    writeln!(f, "        let name: &str = match self {{").unwrap();
    for icon in icons {
        writeln!(f, "            {}::{} => \"{}\",", type_name, icon.pascal, icon.kebab).unwrap();
    }
    writeln!(f, "        }};").unwrap();
    writeln!(f, "        write!(f, \"{{}}\", name)").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "impl std::convert::From<&str> for {} {{", type_name).unwrap();
    writeln!(f, "    fn from(s: &str) -> Self {{").unwrap();
    writeln!(f, "        match s {{").unwrap();
    for icon in icons {
        writeln!(f, "            \"{}\" => {}::{},", icon.kebab, type_name, icon.pascal).unwrap();
    }
    if set_name == "mdi" {
        writeln!(f, "            _ => {}::Help,", type_name).unwrap();
    } else {
        let first = icons.first().map(|i| i.pascal.as_str()).unwrap_or("Unknown");
        writeln!(f, "            _ => {}::{},", type_name, first).unwrap();
    }
    writeln!(f, "        }}").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    writeln!(f, "#[cfg(feature = \"tairitsu\")]").unwrap();
    writeln!(f, "impl IntoAttrValue for {} {{", type_name).unwrap();
    writeln!(f, "    fn into_attr_value(self) -> Option<String> {{").unwrap();
    writeln!(f, "        Some(self.to_string())").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
}

fn gen_data(set_name: &str, icons: &[Icon], dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().unwrap());
    let mut f = fs::File::create(dest).unwrap();
    let entries_name = format!("{}_ENTRIES", set_name.to_uppercase());

    writeln!(f, "// @generated ({} icons) — DO NOT EDIT", icons.len()).unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "static {entries_name}: &[(&str, &str)] = &[").unwrap();
    for icon in icons {
        writeln!(f, "    (\"{}\",", icon.kebab).unwrap();
        writeln!(f, "     \"{}\"),", icon.path_d).unwrap();
    }
    writeln!(f, "];").unwrap();
    writeln!(f).unwrap();

    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "pub fn get(name: &str) -> Option<&'static str> {{").unwrap();
    writeln!(f, "    {entries_name}").unwrap();
    writeln!(f, "        .binary_search_by_key(&name, |(k, _)| k)").unwrap();
    writeln!(f, "        .ok()").unwrap();
    writeln!(f, "        .map(|i| {entries_name}[i].1)").unwrap();
    writeln!(f, "}}").unwrap();
}

fn gen_manifest(modules: &[(&str, String)], dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().unwrap());
    let mut f = fs::File::create(dest).unwrap();

    writeln!(f, "// @generated manifest — DO NOT EDIT").unwrap();
    writeln!(f).unwrap();

    for (set_name, type_name) in modules {
        writeln!(f, "#[allow(non_camel_case_types)]").unwrap();
        writeln!(f, "#[rustfmt::skip]").unwrap();
        writeln!(f, "pub mod {}_enum {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/{}_enum.rs\")); }}", set_name, ICONS_DIR, set_name).unwrap();
        writeln!(f).unwrap();
        writeln!(f, "#[allow(non_camel_case_types)]").unwrap();
        writeln!(f, "#[rustfmt::skip]").unwrap();
        writeln!(f, "pub mod {}_data {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/{}_data.rs\")); }}", set_name, ICONS_DIR, set_name).unwrap();
        writeln!(f).unwrap();
        writeln!(f, "pub use {}_enum::{};", set_name, type_name).unwrap();
        writeln!(f).unwrap();
    }

    writeln!(f, "pub fn get_icon_path(set: &str, name: &str) -> Option<&'static str> {{").unwrap();
    writeln!(f, "    match set {{").unwrap();
    for (set_name, _) in modules {
        writeln!(f, "        \"{}\" => {}_data::get(name),", set_name, set_name).unwrap();
    }
    writeln!(f, "        _ => None,").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
}

fn write_stubs(icons_out: &Path) {
    fs::create_dir_all(icons_out).unwrap();

    let dest_data = icons_out.join("mdi_data.rs");
    let mut f = fs::File::create(&dest_data).unwrap();
    writeln!(f, "pub fn get(_name: &str) -> Option<&'static str> {{ None }}").unwrap();

    let dest_enum = icons_out.join("mdi_enum.rs");
    let mut f = fs::File::create(&dest_enum).unwrap();
    writeln!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]").unwrap();
    writeln!(f, "pub enum MdiIcon {{ Help }}").unwrap();
    writeln!(f, "impl std::fmt::Display for MdiIcon {{").unwrap();
    writeln!(f, "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{ write!(f, \"help\") }}").unwrap();
    writeln!(f, "}}").unwrap();

    let dest_manifest = icons_out.join("manifest.rs");
    let mut f = fs::File::create(&dest_manifest).unwrap();
    writeln!(f, "#[allow(non_camel_case_types)]").unwrap();
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "pub mod mdi_enum {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/mdi_enum.rs\")); }}", ICONS_DIR).unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[allow(non_camel_case_types)]").unwrap();
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "pub mod mdi_data {{ include!(concat!(env!(\"OUT_DIR\"), \"/{}/mdi_data.rs\")); }}", ICONS_DIR).unwrap();
    writeln!(f).unwrap();
    writeln!(f, "pub use mdi_enum::MdiIcon;").unwrap();
    writeln!(f).unwrap();
    writeln!(f, "pub fn get_icon_path(set: &str, name: &str) -> Option<&'static str> {{").unwrap();
    writeln!(f, "    let _ = set;").unwrap();
    writeln!(f, "    let _ = name;").unwrap();
    writeln!(f, "    None").unwrap();
    writeln!(f, "}}").unwrap();
}
