use log::info;
use std::{
    env::current_dir,
    fs::{copy, create_dir_all, File},
    io::Write,
    process::{Command, Stdio},
};

pub async fn build() -> Result<(), Box<dyn std::error::Error>> {
    info!("Checking compiler wasm target.");

    Command::new("rustup")
        .arg("target")
        .args(vec!["add", "wasm32-unknown-unknown"])
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;

    info!("Checking wasm bindgen.");

    Command::new("cargo")
        .arg("install")
        .arg("wasm-bindgen-cli")
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;
    Command::new("cargo")
        .arg("update")
        .arg("-p")
        .arg("wasm-bindgen")
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;

    info!("Building wasm application.");

    Command::new("cargo")
        .arg("build")
        .arg("--release")
        .args(vec!["--target", "wasm32-unknown-unknown"])
        .args(vec!["--package", "hikari-web"])
        .args(vec!["--features", "web_env"])
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;
    Command::new("wasm-bindgen")
        .args(vec!["--target", "no-modules"])
        .args(vec!["--no-modules-global", "__wasm_vendor_entry"])
        .args(vec!["--out-dir", "./dist"])
        .args(vec!["--out-name", "a"])
        .arg("--no-typescript")
        .arg("./hikari-web.wasm")
        .current_dir(current_dir()?.join("./target/wasm32-unknown-unknown/release"))
        .stdout(Stdio::piped())
        .spawn()?
        .wait()?;

    info!("Generating web application.");

    create_dir_all(current_dir()?.join("./target/web"))?;
    let mut html_file = File::create(current_dir()?.join("./target/web/index.html"))?;
    html_file.write(
        b"
<body>
    <script src='./a.js'></script>
    <script>wasm_bindgen('./a.wasm');</script>
</body>",
    )?;
    copy(
        current_dir()?.join("./target/wasm32-unknown-unknown/release/dist/a.js"),
        current_dir()?.join("./target/web/a.js"),
    )?;
    copy(
        current_dir()?.join("./target/wasm32-unknown-unknown/release/dist/a_bg.wasm"),
        current_dir()?.join("./target/web/a.wasm"),
    )?;
    copy(
        current_dir()?.join("./packages/router/res/favicon.ico"),
        current_dir()?.join("./target/web/favicon.ico"),
    )?;
    copy(
        current_dir()?.join("./packages/router/res/logo.png"),
        current_dir()?.join("./target/web/logo.png"),
    )?;

    Ok(())
}
