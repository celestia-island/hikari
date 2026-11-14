//! hikari-wasm-qr — the QR encoder component.
//!
//! Encodes text payloads into QR module matrices, replacing the vendored
//! qrcode-generator.js (2289 lines, MIT, Kazuhiko Arase) with a single
//! Rust implementation compiled to a wasm component. The `qrcode` crate
//! (also by Kazuhiko Arase, same algorithm, maintained in Rust) provides
//! the encoding core; this crate adapts it to the WIT contract.

#[cfg(target_family = "wasm")]
mod bindings {
    use super::Qr;

    wit_bindgen::generate!({
        path: "wit",
        world: "qr",
    });

    export!(Qr);
}

#[cfg(target_family = "wasm")]
pub struct Qr;

#[cfg(target_family = "wasm")]
impl bindings::Guest for Qr {
    fn encode(
        text: String,
        options: Option<bindings::hikari::qr::types::EncodeOptions>,
    ) -> Result<bindings::hikari::qr::types::QrCode, String> {
        let (ecc, version) = match &options {
            Some(opts) => (
                opts.ecc.map(to_qrcode_ecc).unwrap_or(qrcode::EcLevel::M),
                opts.version.unwrap_or(0) as i16,
            ),
            None => (qrcode::EcLevel::M, 0),
        };

        let code = if version > 0 {
            // Explicit version: refuse if the payload does not fit.
            qrcode::QrCode::with_version(text.as_bytes(), qrcode::Version::Normal(version as i16), ecc)
                .map_err(|e| format!("qr encode: {e}"))?
        } else {
            // Auto-select the smallest version that fits.
            qrcode::QrCode::with_error_correction_level(text.as_bytes(), ecc)
                .map_err(|e| format!("qr encode: {e}"))?
        };

        let size = code.width() as u8;
        let width = code.width();
        let version_num = match code.version() { qrcode::Version::Normal(v) => v as u8, _ => 0 };
        let mut modules = Vec::with_capacity(width * width);
        for y in 0..width {
            for x in 0..width {
                modules.push(code[(x, y)] == qrcode::Color::Dark);
            }
        }

        Ok(bindings::hikari::qr::types::QrCode {
            size,
            modules,
            version: version_num,
            ecc: from_qrcode_ecc(ecc),
            mask: 0,    // The crate picks internally; not exposed. Consumed via modules.
        })
    }
}

#[cfg(target_family = "wasm")]
fn to_qrcode_ecc(level: bindings::hikari::qr::types::EccLevel) -> qrcode::EcLevel {
    match level {
        bindings::hikari::qr::types::EccLevel::L => qrcode::EcLevel::L,
        bindings::hikari::qr::types::EccLevel::M => qrcode::EcLevel::M,
        bindings::hikari::qr::types::EccLevel::Q => qrcode::EcLevel::Q,
        bindings::hikari::qr::types::EccLevel::H => qrcode::EcLevel::H,
    }
}

#[cfg(target_family = "wasm")]
fn from_qrcode_ecc(level: qrcode::EcLevel) -> bindings::hikari::qr::types::EccLevel {
    match level {
        qrcode::EcLevel::L => bindings::hikari::qr::types::EccLevel::L,
        qrcode::EcLevel::M => bindings::hikari::qr::types::EccLevel::M,
        qrcode::EcLevel::Q => bindings::hikari::qr::types::EccLevel::Q,
        qrcode::EcLevel::H => bindings::hikari::qr::types::EccLevel::H,
    }
}

// ── Native (non-wasm) facade for testing ──────────────────────────────────

#[cfg(not(target_family = "wasm"))]
pub mod native {
    use qrcode::QrCode;
    use qrcode::EcLevel;

    pub fn encode(text: &str, ecc: char, version: i16) -> Result<Vec<Vec<bool>>, String> {
        let level = match ecc {
            'L' => EcLevel::L,
            'M' => EcLevel::M,
            'Q' => EcLevel::Q,
            'H' => EcLevel::H,
            _ => EcLevel::M,
        };
        let code = if version > 0 {
            QrCode::with_version(text.as_bytes(), qrcode::Version::Normal(version as i16), level)
                .map_err(|e| format!("{e}"))?
        } else {
            QrCode::with_error_correction_level(text.as_bytes(), level)
                .map_err(|e| format!("{e}"))?
        };
        let w = code.width();
        Ok((0..w)
            .map(|y| (0..w).map(|x| code[(x, y)] == qrcode::Color::Dark).collect())
            .collect())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn encodes_a_short_payload() {
        let m = super::native::encode("HELLO WORLD", 'L', 1).unwrap();
        assert_eq!(m.len(), 21); // v1 = 21×21
        assert!(m[0].iter().any(|&v| v)); // finder pattern row 0 has dark modules
    }

    #[test]
    fn rejects_overflow() {
        assert!(super::native::encode(&"x".repeat(3000), 'L', 0).is_err());
    }
}
