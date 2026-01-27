// Test to debug icon lookup issue
fn main() {
    println!("Testing icon lookup...");

    // Test MdiIcon::Alert
    let alert_name = _icons::MdiIcon::Alert.to_string();
    println!("MdiIcon::Alert.to_string() = '{}'", alert_name);

    // Test get function
    let alert_data = _icons::get(&alert_name);
    println!("get('{}') = {:?}", alert_name, alert_data);

    // Test IconRef
    let alert_ref = _icons::IconRef(_icons::MdiIcon::Alert);
    println!("IconRef.name() = '{}'", alert_ref.name());
    println!(
        "IconRef.name() lookup = {:?}",
        _icons::get(&alert_ref.name())
    );
}
