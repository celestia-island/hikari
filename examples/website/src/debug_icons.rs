// Icon debugging test
// This will help us understand exactly what's happening with the icon lookup

use _icons::{IconRef, MdiIcon, get};

fn main() {
    println!("=== Icon Debugging Test ===");

    // Test 1: Check if Alert enum converts to string correctly
    println!("Test 1: MdiIcon::Alert.to_string()");
    let alert_str = MdiIcon::Alert.to_string();
    println!("  Result: '{}'", alert_str);
    println!("  Expected: 'alert'");
    println!(
        "  Match: {}",
        if alert_str == "alert" {
            "✅ YES"
        } else {
            "❌ NO"
        }
    );

    // Test 2: Check if get() function finds the icon
    println!("\nTest 2: get() function");
    let alert_data = get("alert");
    println!("  Result: {:?}", alert_data.is_some());
    println!("  Data: {:?}", alert_data);

    // Test 3: Check if IconRef works
    println!("\nTest 3: IconRef");
    let alert_ref = IconRef(MdiIcon::Alert);
    println!("  IconRef name: '{}'", alert_ref.name());
    println!("  IconRef path: '{}'", alert_ref.svg_path());

    // Test 4: Check multiple icon names to see if any work
    println!("\nTest 4: Testing other icons");
    let test_names = ["alert", "home", "settings", "check", "star", "unknown"];
    for name in test_names {
        let data = get(name);
        println!(
            "  '{}': {}",
            name,
            if data.is_some() {
                "✅ Found"
            } else {
                "❌ Missing"
            }
        );
    }

    // Test 5: Check what happens when we access icon.name() in the component
    println!("\nTest 5: IconRef.name() for MdiIcon::Alert");
    let icon_ref = IconRef(MdiIcon::Alert);
    let icon_name = icon_ref.name();
    println!("  IconRef.name(): '{}'", icon_name);
    println!("  get(IconRef.name()): {:?}", get(&icon_name));

    println!("\n=== End Debug Test ===");
}
