rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli

cd ./packages/web
cargo build --release --target wasm32-unknown-unknown
cd ../../target/wasm32-unknown-unknown/release
wasm-bindgen hikari-web.wasm --out-dir ./dist --no-modules --no-typescript

cd ../../..
cp ./target/wasm32-unknown-unknown/release/dist/hikari-web.js ./packages/app/res/a.js
cp ./target/wasm32-unknown-unknown/release/dist/hikari-web_bg.wasm ./packages/app/res/a.wasm
echo "
<body>
    <script src='./a.js'></script>
    <script>wasm_bindgen('./a.wasm');</script>
</body>
" > ./packages/app/res/index.html

cd ./packages/app
cargo build --release
cd ../..

./target/release/hikari-app.exe
