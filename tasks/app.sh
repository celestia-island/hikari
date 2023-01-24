rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli

cd ./src/frontend/web
cargo build --release --target wasm32-unknown-unknown
cd ../../../target/wasm32-unknown-unknown/release
wasm-bindgen hikari-web.wasm --out-dir ./dist --no-modules --no-typescript

cd ../../..
cp ./target/wasm32-unknown-unknown/release/dist/hikari-web.js ./src/frontend/app/res/a.js
cp ./target/wasm32-unknown-unknown/release/dist/hikari-web_bg.wasm ./src/frontend/app/res/a.wasm
echo "
<body>
    <script src='./a.js'></script>
    <script>wasm_bindgen('./a.wasm');</script>
</body>
" > ./src/frontend/app/res/index.html

cd ./src/frontend/app
cargo build --release
cd ../../..

./target/release/hikari-app.exe
