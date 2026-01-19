#[cfg(test)]
mod tests {
    use hikari_palette::*;

    #[test]
    fn test_indigo_is_dark() {
        let indigo = 靛蓝;
        println!("靛蓝 RGB: {:?}", indigo.rgb);
        println!("靛蓝 brightness: {}", indigo.brightness());
        println!("靛蓝 is_dark: {}", indigo.is_dark());
        println!("靛蓝 is_dark_for_glow: {}", indigo.is_dark_for_glow());

        let (r, g, b, a) = indigo.glow_contrast_dynamic();
        println!("Glow RGB: ({}, {}, {})", r, g, b);
        println!("Glow alpha: {}", a);

        let glow = indigo.glow_contrast_dynamic_rgba();
        println!("Glow color: {}", glow);

        // 靛蓝的亮度是 0.25 < 0.4，应该返回白色 glow
        assert!(indigo.brightness() < 0.4, "靛蓝应该是深色");
        assert_eq!(glow, "rgba(255, 255, 255, 0.7)", "靛蓝应该是白色 glow");
    }
}
