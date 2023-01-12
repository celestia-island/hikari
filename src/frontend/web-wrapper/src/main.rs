use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

pub fn main() {
    Command::new("cargo")
        .arg("build")
        .args(vec!["--package", "hikari-web"])
        .args(vec!["--bin", "hikari-web"])
        .args(vec!["--target", "wasm32-unknown-unknown"])
        .stdout(Stdio::piped())
        .spawn()
        .unwrap()
        .wait()
        .unwrap();
    Command::new("wasm-bindgen")
        .arg("target/wasm32-unknown-unknown/debug/hikari-web.wasm")
        .args(vec![
            "--out-dir",
            "target/wasm32-unknown-unknown/debug/dist",
        ])
        .args(vec!["--target", "no-modules"])
        .arg("--no-typescript")
        .stdout(Stdio::piped())
        .spawn()
        .unwrap()
        .wait()
        .unwrap();

    let mut file = File::create(Path::new(
        "target/wasm32-unknown-unknown/debug/dist/index.html",
    ))
    .unwrap();
    file.write(
        b"
<script src='./hikari-web.js'></script>
<script>wasm_bindgen('./hikari-web_bg.wasm');</script>",
    )
    .unwrap();
}
