#[inline]
pub fn rgb_to_dec(rgb: i32) -> String {
    format!(
        "{}, {}, {}",
        (rgb >> 16) & 0xff,
        (rgb >> 8) & 0xff,
        rgb & 0xff
    )
}
