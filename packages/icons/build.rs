use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let dest_data = Path::new(&manifest_dir).join("src/mdi_data.rs");
    let dest_enum = Path::new(&manifest_dir).join("src/mdi_enum.rs");

    if env::var("CARGO_FEATURE_DYNAMIC_FETCH").is_ok() {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/api/icons");
    } else {
        println!("cargo:rustc-env=HIKARI_ICON_ROUTE=/static/dynamic-icons");
    }

    let need_data = !dest_data.exists();
    let need_enum = !dest_enum.exists();

    if !need_data && !need_enum {
        return;
    }

    let workspace = find_workspace(&manifest_dir);
    let svg_dir = workspace.join("icons/mdi");

    if !svg_dir.exists() {
        if need_data {
            write_stub_data(&dest_data);
        }
        if need_enum {
            write_stub_enum(&dest_enum);
        }
        return;
    }

    let icons = read_icons(&svg_dir);

    if icons.is_empty() {
        if need_data {
            write_stub_data(&dest_data);
        }
        if need_enum {
            write_stub_enum(&dest_enum);
        }
        return;
    }

    if need_data {
        gen_data(&icons, &dest_data);
    }
    if need_enum {
        gen_enum(&icons, &dest_enum);
    }

    eprintln!("hikari-icons: {} icons generated", icons.len());
}

struct Icon {
    kebab: String,
    pascal: String,
    path_d: String,
}

fn find_workspace(manifest_dir: &str) -> std::path::PathBuf {
    let mut result = Path::new(manifest_dir).parent().unwrap().to_path_buf();
    let mut p = Path::new(manifest_dir);
    while let Some(parent) = p.parent() {
        let cargo = parent.join("Cargo.toml");
        if cargo.exists()
            && let Ok(content) = fs::read_to_string(&cargo)
            && content.contains("[workspace]")
        {
            result = parent.to_path_buf();
            break;
        }
        p = parent;
    }
    result
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

fn read_icons(svg_dir: &Path) -> Vec<Icon> {
    let mut icons: Vec<Icon> = Vec::new();
    let mut names: Vec<String> = fs::read_dir(svg_dir)
        .unwrap_or_else(|e| panic!("cannot read {}: {}", svg_dir.display(), e))
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.ends_with(".svg") {
                Some(name[..name.len() - 4].to_string())
            } else {
                None
            }
        })
        .collect();
    names.sort();

    for name in &names {
        let svg = match fs::read_to_string(svg_dir.join(format!("{name}.svg"))) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let d = match extract_path_d(&svg) {
            Some(d) => d,
            None => continue,
        };
        icons.push(Icon {
            kebab: name.clone(),
            pascal: kebab_to_pascal(name),
            path_d: d,
        });
    }
    icons
}

fn gen_data(icons: &[Icon], dest: &Path) {
    let mut f = fs::File::create(dest).unwrap();
    writeln!(f, "// @generated ({} icons) — DO NOT EDIT", icons.len()).unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "static ENTRIES: &[(&str, &str)] = &[").unwrap();
    for icon in icons {
        writeln!(f, "    (\"{}\",", icon.kebab).unwrap();
        writeln!(f, "     \"{}\"),", icon.path_d).unwrap();
    }
    writeln!(f, "];").unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "pub fn get(name: &str) -> Option<&'static str> {{").unwrap();
    writeln!(f, "    ENTRIES").unwrap();
    writeln!(f, "        .binary_search_by_key(&name, |(k, _)| k)").unwrap();
    writeln!(f, "        .ok()").unwrap();
    writeln!(f, "        .map(|i| ENTRIES[i].1)").unwrap();
    writeln!(f, "}}").unwrap();
}

fn gen_enum(icons: &[Icon], dest: &Path) {
    let mut f = fs::File::create(dest).unwrap();
    writeln!(f, "// @generated ({} variants) — DO NOT EDIT", icons.len()).unwrap();
    writeln!(f, "#![allow(non_camel_case_types)]").unwrap();
    writeln!(f).unwrap();
    writeln!(f, "#[cfg(feature = \"tairitsu\")]").unwrap();
    writeln!(f, "use tairitsu_vdom::IntoAttrValue;").unwrap();
    writeln!(f).unwrap();
    writeln!(f, "/// Full MDI icon enum ({} variants)", icons.len()).unwrap();
    writeln!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]").unwrap();
    writeln!(f, "pub enum MdiIcon {{").unwrap();
    for icon in icons {
        writeln!(f, "    {},", icon.pascal).unwrap();
    }
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    // Display impl: MdiIcon -> kebab-case string
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "impl std::fmt::Display for MdiIcon {{").unwrap();
    writeln!(
        f,
        "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{"
    )
    .unwrap();
    writeln!(f, "        let name: &str = match self {{").unwrap();
    for icon in icons {
        writeln!(
            f,
            "            MdiIcon::{} => \"{}\",",
            icon.pascal, icon.kebab
        )
        .unwrap();
    }
    writeln!(f, "        }};").unwrap();
    writeln!(f, "        write!(f, \"{{}}\", name)").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    // From<&str> impl: kebab-case string -> MdiIcon
    writeln!(f, "#[rustfmt::skip]").unwrap();
    writeln!(f, "impl std::convert::From<&str> for MdiIcon {{").unwrap();
    writeln!(f, "    fn from(s: &str) -> Self {{").unwrap();
    writeln!(f, "        match s {{").unwrap();
    for icon in icons {
        writeln!(
            f,
            "            \"{}\" => MdiIcon::{},",
            icon.kebab, icon.pascal
        )
        .unwrap();
    }
    writeln!(f, "            _ => MdiIcon::Help,").unwrap();
    writeln!(f, "        }}").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
    writeln!(f).unwrap();

    // IntoAttrValue for tairitsu
    writeln!(f, "#[cfg(feature = \"tairitsu\")]").unwrap();
    writeln!(f, "impl IntoAttrValue for MdiIcon {{").unwrap();
    writeln!(f, "    fn into_attr_value(self) -> Option<String> {{").unwrap();
    writeln!(f, "        Some(self.to_string())").unwrap();
    writeln!(f, "    }}").unwrap();
    writeln!(f, "}}").unwrap();
}

fn write_stub_data(dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().unwrap());
    let mut f = fs::File::create(dest).unwrap();
    writeln!(f, "// stub").unwrap();
    writeln!(
        f,
        "pub fn get(_name: &str) -> Option<&'static str> {{ None }}"
    )
    .unwrap();
}

fn write_stub_enum(dest: &Path) {
    let _ = fs::create_dir_all(dest.parent().unwrap());
    let mut f = fs::File::create(dest).unwrap();
    writeln!(f, "// stub").unwrap();
    writeln!(f, "#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]").unwrap();
    writeln!(f, "pub enum MdiIcon {{ Help }}").unwrap();
    writeln!(f, "impl std::fmt::Display for MdiIcon {{").unwrap();
    writeln!(f, "    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {{ write!(f, \"help\") }}").unwrap();
    writeln!(f, "}}").unwrap();
}

fn extract_path_d(svg: &str) -> Option<String> {
    let start = svg.find("<path")?;
    let rest = &svg[start..];
    let d_start = rest.find("d=\"")? + 3;
    let d_end = rest[d_start..].find('"')?;
    Some(rest[d_start..d_start + d_end].to_string())
}
