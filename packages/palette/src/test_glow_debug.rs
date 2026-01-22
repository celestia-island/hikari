#[cfg(test)]
mod tests {

use super::*;

    #[test]
    fn debug_indigo_glow() {
        let indigo = 靛蓝;
        let brightness = indigo.brightness();
        println!("靛蓝 RGB: {:?}", indigo.rgb);
        println!("靛蓝 brightness: {}", brightness);
        println!("靛蓝 is_dark_for_glow: {}", indigo.is_dark_for_glow());
        
        let (r, g, b, a) = indigo.glow_contrast_dynamic();
        println!("靛蓝 glow RGB: ({}, {}, {})", r, g, b);
        println!("靛蓝 glow alpha: {}", a);
        
        let glow_rgba = indigo.glow_contrast_dynamic_rgba();
        println!("靛蓝 glow RGBA: {}", glow_rgba);
    }
}
