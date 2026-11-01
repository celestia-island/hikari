// hi-components/src/display/qr_code.rs
// QrCode — mirror of the canonical Vue `HkQrCode`: render a scannable QR code
// from an arbitrary payload (typically an `otpauth://` URI) as dark modules on
// a light card, independent of the app theme so it stays scannable in dark
// mode.
//
// Sources mirrored: `packages/vue/src/components/HkQrCode.tsx`, its sheet,
// and the vendored encoder it calls (`packages/vue/src/utils/qr/qrEncoder.ts`
// over `packages/vue/src/utils/qr/qrcode-generator.js`). The stylesheet is the
// SAME sheet the Vue library ships
// (`packages/vue/src/components/HkQrCode.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-qr-*` class
// names are literal and identical in both forms. DOM contract (Vue shape, see
// the canvas delta below):
//
//   div.hk-qr-card [data-empty="true"]        (empty payload only)
//     div[style="display:contents"]           (the SVG mount host)
//       <svg class="hk-qr-canvas" width/height={size}
//            viewBox="0 0 {modules + 2·margin} …" role="img"
//            aria-label={label or i18n alt} style="width:{size}px;height:{size}px">
//         <rect>                              (the light ink over the whole card)
//         <g fill={dark ink}><rect …/></g>    (one rect per dark run per row)
//       </svg>
//     div.hk-qr-label? {label}
//
// The QR itself is produced by the faithful Rust port of the vendored
// `qrcode-generator` (Kazuhiko Arase, MIT) the Vue component imports: byte
// mode only (`qr.addData(text)` with no mode argument), auto version 1..40,
// error-correction levels `L/M/Q/H`, the same RS block table, the same
// Reed-Solomon codewords, the same mask scoring (`getLostPoint`), so both
// forms encode IDENTICAL matrices. `qr_payload_bytes` mirrors the encoder's
// default `stringToBytes` (`charCodeAt(i) & 0xff`) — the low byte of each
// UTF-16 code unit, not UTF-8 — because that is what the Vue side feeds in.
//
// The SVG subtree is authored as MARKUP and mounted through
// `dangerous_inner_html` on its own `display:contents` host: rsx `svg {}` maps
// to `createElement` in this host stack (HTML namespace) and inner_html
// suppresses an element's children (ledger L49) — the same shape
// `feedback/progress_ring.rs` and `data/gauge_ring.rs` use. Markup bypasses
// tairitsu's escaper, so the caller-supplied inks and aria label are escaped
// here ([`escape_markup`]).
//
// Deltas vs Vue (documented):
//   * Vue paints a `<canvas>` (2D context, device-pixel-ratio backing store).
//     The mirror has no canvas drawing op and cannot use component state, so it
//     emits the SAME module grid as a resolution-independent `<svg>` while
//     keeping the `hk-qr-canvas` class: block layout, radius, shadow and the
//     white backing come from the sheet unchanged, and the light ink is also
//     painted as an explicit background rect (the canvas painted its own
//     background over the sheet's white).
//   * `size`/`margin` are `f64` (Vue `Number`); the viewBox uses module units,
//     so no dpr scaling is needed.
//   * Vue re-encodes in a `watch`; the mirror re-encodes on every render, which
//     is the same observable contract for a controlled host.
//   * An overflowing payload renders the light card WITHOUT modules (Vue throws
//     inside its draw effect, leaving the freshly filled canvas module-less);
//     [`qr_matrix`] reports the same condition as
//     [`QrEncodeError::Overflow`] for hosts that want to surface it.
//   * `disabled` is declared exactly like Vue's prop and, exactly like Vue's,
//     never read (Vue's `HkQrCode` ignores it) — kept inert for prop parity.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct QrCodeComponent;

/// Highest QR version the encoder emits (Vue: type number 1..40, 0 = auto).
pub const QR_MAX_VERSION: usize = 40;

/// Byte-mode mode indicator (`QRMode.MODE_8BIT_BYTE`).
const QR_MODE_8BIT_BYTE: u32 = 0b0100;

/// The two alternating pad codewords (Vue: `PAD0` / `PAD1`).
const QR_PAD0: u8 = 0xEC;
const QR_PAD1: u8 = 0x11;

/// Type-info / type-number BCH constants, verbatim from the vendored encoder.
const QR_G15: u32 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
const QR_G18: u32 =
    (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
const QR_G15_MASK: u32 = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

/// Error-correction level (Vue: `level`, `"L" | "M" | "Q" | "H"`, default `M`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum QrErrorCorrectionLevel {
    L,
    #[default]
    M,
    Q,
    H,
}

impl QrErrorCorrectionLevel {
    /// The Vue prop value.
    pub fn name(self) -> &'static str {
        match self {
            QrErrorCorrectionLevel::L => "L",
            QrErrorCorrectionLevel::M => "M",
            QrErrorCorrectionLevel::Q => "Q",
            QrErrorCorrectionLevel::H => "H",
        }
    }

    /// Parse the Vue prop string; unknown strings fall back to the default `M`
    /// (Vue's prop validator rejects them, so only `M` can render).
    pub fn from_name(name: &str) -> Self {
        match name {
            "L" => QrErrorCorrectionLevel::L,
            "Q" => QrErrorCorrectionLevel::Q,
            "H" => QrErrorCorrectionLevel::H,
            _ => QrErrorCorrectionLevel::M,
        }
    }

    /// The two-bit format field — `QRErrorCorrectionLevel` in the vendored
    /// encoder is `L = 1, M = 0, Q = 3, H = 2`, NOT the table order.
    fn format_field(self) -> u8 {
        match self {
            QrErrorCorrectionLevel::L => 1,
            QrErrorCorrectionLevel::M => 0,
            QrErrorCorrectionLevel::Q => 3,
            QrErrorCorrectionLevel::H => 2,
        }
    }

    /// The RS-block-table row order: L, M, Q, H.
    fn block_row(self) -> usize {
        match self {
            QrErrorCorrectionLevel::L => 0,
            QrErrorCorrectionLevel::M => 1,
            QrErrorCorrectionLevel::Q => 2,
            QrErrorCorrectionLevel::H => 3,
        }
    }
}

/// Row `(version - 1) * 4 + level_row` of the vendored RS-block table,
/// flattened as `[blocks, total, data, (blocks, total, data)]` triples.
const QR_RS_BLOCK_TABLE: [&[u8]; 160] = [
    &[1, 26, 19],
    &[1, 26, 16],
    &[1, 26, 13],
    &[1, 26, 9],
    &[1, 44, 34],
    &[1, 44, 28],
    &[1, 44, 22],
    &[1, 44, 16],
    &[1, 70, 55],
    &[1, 70, 44],
    &[2, 35, 17],
    &[2, 35, 13],
    &[1, 100, 80],
    &[2, 50, 32],
    &[2, 50, 24],
    &[4, 25, 9],
    &[1, 134, 108],
    &[2, 67, 43],
    &[2, 33, 15, 2, 34, 16],
    &[2, 33, 11, 2, 34, 12],
    &[2, 86, 68],
    &[4, 43, 27],
    &[4, 43, 19],
    &[4, 43, 15],
    &[2, 98, 78],
    &[4, 49, 31],
    &[2, 32, 14, 4, 33, 15],
    &[4, 39, 13, 1, 40, 14],
    &[2, 121, 97],
    &[2, 60, 38, 2, 61, 39],
    &[4, 40, 18, 2, 41, 19],
    &[4, 40, 14, 2, 41, 15],
    &[2, 146, 116],
    &[3, 58, 36, 2, 59, 37],
    &[4, 36, 16, 4, 37, 17],
    &[4, 36, 12, 4, 37, 13],
    &[2, 86, 68, 2, 87, 69],
    &[4, 69, 43, 1, 70, 44],
    &[6, 43, 19, 2, 44, 20],
    &[6, 43, 15, 2, 44, 16],
    &[4, 101, 81],
    &[1, 80, 50, 4, 81, 51],
    &[4, 50, 22, 4, 51, 23],
    &[3, 36, 12, 8, 37, 13],
    &[2, 116, 92, 2, 117, 93],
    &[6, 58, 36, 2, 59, 37],
    &[4, 46, 20, 6, 47, 21],
    &[7, 42, 14, 4, 43, 15],
    &[4, 133, 107],
    &[8, 59, 37, 1, 60, 38],
    &[8, 44, 20, 4, 45, 21],
    &[12, 33, 11, 4, 34, 12],
    &[3, 145, 115, 1, 146, 116],
    &[4, 64, 40, 5, 65, 41],
    &[11, 36, 16, 5, 37, 17],
    &[11, 36, 12, 5, 37, 13],
    &[5, 109, 87, 1, 110, 88],
    &[5, 65, 41, 5, 66, 42],
    &[5, 54, 24, 7, 55, 25],
    &[11, 36, 12, 7, 37, 13],
    &[5, 122, 98, 1, 123, 99],
    &[7, 73, 45, 3, 74, 46],
    &[15, 43, 19, 2, 44, 20],
    &[3, 45, 15, 13, 46, 16],
    &[1, 135, 107, 5, 136, 108],
    &[10, 74, 46, 1, 75, 47],
    &[1, 50, 22, 15, 51, 23],
    &[2, 42, 14, 17, 43, 15],
    &[5, 150, 120, 1, 151, 121],
    &[9, 69, 43, 4, 70, 44],
    &[17, 50, 22, 1, 51, 23],
    &[2, 42, 14, 19, 43, 15],
    &[3, 141, 113, 4, 142, 114],
    &[3, 70, 44, 11, 71, 45],
    &[17, 47, 21, 4, 48, 22],
    &[9, 39, 13, 16, 40, 14],
    &[3, 135, 107, 5, 136, 108],
    &[3, 67, 41, 13, 68, 42],
    &[15, 54, 24, 5, 55, 25],
    &[15, 43, 15, 10, 44, 16],
    &[4, 144, 116, 4, 145, 117],
    &[17, 68, 42],
    &[17, 50, 22, 6, 51, 23],
    &[19, 46, 16, 6, 47, 17],
    &[2, 139, 111, 7, 140, 112],
    &[17, 74, 46],
    &[7, 54, 24, 16, 55, 25],
    &[34, 37, 13],
    &[4, 151, 121, 5, 152, 122],
    &[4, 75, 47, 14, 76, 48],
    &[11, 54, 24, 14, 55, 25],
    &[16, 45, 15, 14, 46, 16],
    &[6, 147, 117, 4, 148, 118],
    &[6, 73, 45, 14, 74, 46],
    &[11, 54, 24, 16, 55, 25],
    &[30, 46, 16, 2, 47, 17],
    &[8, 132, 106, 4, 133, 107],
    &[8, 75, 47, 13, 76, 48],
    &[7, 54, 24, 22, 55, 25],
    &[22, 45, 15, 13, 46, 16],
    &[10, 142, 114, 2, 143, 115],
    &[19, 74, 46, 4, 75, 47],
    &[28, 50, 22, 6, 51, 23],
    &[33, 46, 16, 4, 47, 17],
    &[8, 152, 122, 4, 153, 123],
    &[22, 73, 45, 3, 74, 46],
    &[8, 53, 23, 26, 54, 24],
    &[12, 45, 15, 28, 46, 16],
    &[3, 147, 117, 10, 148, 118],
    &[3, 73, 45, 23, 74, 46],
    &[4, 54, 24, 31, 55, 25],
    &[11, 45, 15, 31, 46, 16],
    &[7, 146, 116, 7, 147, 117],
    &[21, 73, 45, 7, 74, 46],
    &[1, 53, 23, 37, 54, 24],
    &[19, 45, 15, 26, 46, 16],
    &[5, 145, 115, 10, 146, 116],
    &[19, 75, 47, 10, 76, 48],
    &[15, 54, 24, 25, 55, 25],
    &[23, 45, 15, 25, 46, 16],
    &[13, 145, 115, 3, 146, 116],
    &[2, 74, 46, 29, 75, 47],
    &[42, 54, 24, 1, 55, 25],
    &[23, 45, 15, 28, 46, 16],
    &[17, 145, 115],
    &[10, 74, 46, 23, 75, 47],
    &[10, 54, 24, 35, 55, 25],
    &[19, 45, 15, 35, 46, 16],
    &[17, 145, 115, 1, 146, 116],
    &[14, 74, 46, 21, 75, 47],
    &[29, 54, 24, 19, 55, 25],
    &[11, 45, 15, 46, 46, 16],
    &[13, 145, 115, 6, 146, 116],
    &[14, 74, 46, 23, 75, 47],
    &[44, 54, 24, 7, 55, 25],
    &[59, 46, 16, 1, 47, 17],
    &[12, 151, 121, 7, 152, 122],
    &[12, 75, 47, 26, 76, 48],
    &[39, 54, 24, 14, 55, 25],
    &[22, 45, 15, 41, 46, 16],
    &[6, 151, 121, 14, 152, 122],
    &[6, 75, 47, 34, 76, 48],
    &[46, 54, 24, 10, 55, 25],
    &[2, 45, 15, 64, 46, 16],
    &[17, 152, 122, 4, 153, 123],
    &[29, 74, 46, 14, 75, 47],
    &[49, 54, 24, 10, 55, 25],
    &[24, 45, 15, 46, 46, 16],
    &[4, 152, 122, 18, 153, 123],
    &[13, 74, 46, 32, 75, 47],
    &[48, 54, 24, 14, 55, 25],
    &[42, 45, 15, 32, 46, 16],
    &[20, 147, 117, 4, 148, 118],
    &[40, 75, 47, 7, 76, 48],
    &[43, 54, 24, 22, 55, 25],
    &[10, 45, 15, 67, 46, 16],
    &[19, 148, 118, 6, 149, 119],
    &[18, 75, 47, 31, 76, 48],
    &[34, 54, 24, 34, 55, 25],
    &[20, 45, 15, 61, 46, 16],
];

/// Alignment-pattern centre coordinates per version (index = version - 1).
const QR_PATTERN_POSITION_TABLE: [&[u8]; 40] = [
    &[],
    &[6, 18],
    &[6, 22],
    &[6, 26],
    &[6, 30],
    &[6, 34],
    &[6, 22, 38],
    &[6, 24, 42],
    &[6, 26, 46],
    &[6, 28, 50],
    &[6, 30, 54],
    &[6, 32, 58],
    &[6, 34, 62],
    &[6, 26, 46, 66],
    &[6, 26, 48, 70],
    &[6, 26, 50, 74],
    &[6, 30, 54, 78],
    &[6, 30, 56, 82],
    &[6, 30, 58, 86],
    &[6, 34, 62, 90],
    &[6, 28, 50, 72, 94],
    &[6, 26, 50, 74, 98],
    &[6, 30, 54, 78, 102],
    &[6, 28, 54, 80, 106],
    &[6, 32, 58, 84, 110],
    &[6, 30, 58, 86, 114],
    &[6, 34, 62, 90, 118],
    &[6, 26, 50, 74, 98, 122],
    &[6, 30, 54, 78, 102, 126],
    &[6, 26, 52, 78, 104, 130],
    &[6, 30, 56, 82, 108, 134],
    &[6, 34, 60, 86, 112, 138],
    &[6, 30, 58, 86, 114, 142],
    &[6, 34, 62, 90, 118, 146],
    &[6, 30, 54, 78, 102, 126, 150],
    &[6, 24, 50, 76, 102, 128, 154],
    &[6, 28, 54, 80, 106, 132, 158],
    &[6, 32, 58, 84, 110, 136, 162],
    &[6, 26, 54, 82, 110, 138, 166],
    &[6, 30, 58, 86, 114, 142, 170],
];

/// Encoder failures — the mirror of the vendored generator's `throw`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum QrEncodeError {
    /// The payload needs more codewords than the selected version carries
    /// (Vue: `code length overflow. (bits>capacity)`).
    Overflow { bits: usize, capacity_bits: usize },
}

impl std::fmt::Display for QrEncodeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            QrEncodeError::Overflow {
                bits,
                capacity_bits,
            } => write!(formatter, "code length overflow. ({bits}>{capacity_bits})"),
        }
    }
}

impl std::error::Error for QrEncodeError {}

/// The payload bytes the Vue side encodes: `stringToBytes` default is
/// `charCodeAt(i) & 0xff`, i.e. the low byte of every UTF-16 code unit.
pub fn qr_payload_bytes(value: &str) -> Vec<u8> {
    value
        .encode_utf16()
        .map(|unit| (unit & 0xff) as u8)
        .collect()
}

/// The byte-mode length field width for a version (8 bits below version 10,
/// 16 bits from 10 up).
fn qr_byte_length_bits(version: usize) -> usize {
    if version < 10 { 8 } else { 16 }
}

/// Whether `byte_len` payload bytes fit `version` at `level` — Vue's `make()`
/// auto-detection test.
pub fn qr_payload_fits(byte_len: usize, version: usize, level: QrErrorCorrectionLevel) -> bool {
    4 + qr_byte_length_bits(version) + 8 * byte_len <= qr_data_codewords(version, level) * 8
}

/// Vue's version auto-detection: scan 1..40 and stop at the first fit; when
/// nothing fits, version 40 is used unconditionally (the data build then
/// overflows, exactly like the vendored encoder).
pub fn qr_version_for_byte_len(byte_len: usize, level: QrErrorCorrectionLevel) -> usize {
    let mut version = 1usize;
    while version < QR_MAX_VERSION {
        if qr_payload_fits(byte_len, version, level) {
            break;
        }
        version += 1;
    }
    version
}

/// One RS block's shape (Vue: `{totalCount, dataCount}`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct QrRsBlock {
    total: usize,
    data: usize,
}

/// The RS block list for a version/level (Vue: `QRRSBlock.getRSBlocks`).
fn qr_rs_blocks(version: usize, level: QrErrorCorrectionLevel) -> Vec<QrRsBlock> {
    let row = QR_RS_BLOCK_TABLE[(version - 1) * 4 + level.block_row()];
    let mut blocks = Vec::new();
    for triple in row.chunks(3) {
        let count = usize::from(triple[0]);
        let total = usize::from(triple[1]);
        let data = usize::from(triple[2]);
        for _ in 0..count {
            blocks.push(QrRsBlock { total, data });
        }
    }
    blocks
}

/// The total DATA codewords a version/level carries.
pub fn qr_data_codewords(version: usize, level: QrErrorCorrectionLevel) -> usize {
    qr_rs_blocks(version, level)
        .iter()
        .map(|block| block.data)
        .sum()
}

/// GF(256) log/exp tables — the same construction as `QRMath` in the vendored
/// encoder (`EXP[i] = EXP[i-4] ^ EXP[i-5] ^ EXP[i-6] ^ EXP[i-8]`).
struct QrGf {
    exp: [u8; 256],
    log: [u8; 256],
}

impl QrGf {
    fn new() -> Self {
        let mut exp = [0u8; 256];
        for (index, slot) in exp.iter_mut().enumerate().take(8) {
            *slot = 1u8 << index;
        }
        for index in 8..256 {
            exp[index] = exp[index - 4] ^ exp[index - 5] ^ exp[index - 6] ^ exp[index - 8];
        }
        let mut log = [0u8; 256];
        for index in 0..255 {
            log[usize::from(exp[index])] = index as u8;
        }
        Self { exp, log }
    }

    fn log_of(&self, value: u8) -> i32 {
        debug_assert!(value != 0, "glog(0) is undefined");
        i32::from(self.log[usize::from(value)])
    }

    /// `gexp` with the encoder's 255-cycle normalisation.
    fn exp_of(&self, value: i32) -> u8 {
        let mut normalised = value;
        while normalised < 0 {
            normalised += 255;
        }
        while normalised >= 256 {
            normalised -= 255;
        }
        self.exp[normalised as usize]
    }
}

/// Drop the leading zero coefficients and append `shift` zeros (Vue:
/// `qrPolynomial(num, shift)`).
fn qr_poly_trim(poly: &[u8], shift: usize) -> Vec<u8> {
    let offset = poly
        .iter()
        .position(|&value| value != 0)
        .unwrap_or(poly.len());
    let mut out = Vec::with_capacity(poly.len() - offset + shift);
    out.extend_from_slice(&poly[offset..]);
    out.resize(out.len() + shift, 0);
    out
}

fn qr_poly_mul(gf: &QrGf, left: &[u8], right: &[u8]) -> Vec<u8> {
    let mut out = vec![0u8; left.len() + right.len() - 1];
    for (i, &a) in left.iter().enumerate() {
        if a == 0 {
            continue;
        }
        for (j, &b) in right.iter().enumerate() {
            if b == 0 {
                continue;
            }
            out[i + j] ^= gf.exp_of(gf.log_of(a) + gf.log_of(b));
        }
    }
    qr_poly_trim(&out, 0)
}

/// Polynomial division remainder (Vue's recursive `mod`; the recursion only
/// re-trims the leading zeros, which the loop does in place).
fn qr_poly_mod(gf: &QrGf, dividend: &[u8], divisor: &[u8]) -> Vec<u8> {
    let mut current = dividend.to_vec();
    while current.len() >= divisor.len() && !current.is_empty() {
        let ratio = gf.log_of(current[0]) - gf.log_of(divisor[0]);
        for (index, &coefficient) in divisor.iter().enumerate() {
            if coefficient == 0 {
                continue;
            }
            current[index] ^= gf.exp_of(gf.log_of(coefficient) + ratio);
        }
        let offset = current
            .iter()
            .position(|&value| value != 0)
            .unwrap_or(current.len());
        current.drain(..offset);
    }
    current
}

/// The generator polynomial for `ec_count` error-correction codewords (Vue:
/// `getErrorCorrectPolynomial`).
fn qr_error_correct_polynomial(gf: &QrGf, ec_count: usize) -> Vec<u8> {
    let mut poly = vec![1u8];
    for index in 0..ec_count {
        poly = qr_poly_mul(gf, &poly, &[1, gf.exp_of(index as i32)]);
    }
    poly
}

/// The bit writer (Vue: `qrBitBuffer`).
#[derive(Default)]
struct QrBitBuffer {
    bytes: Vec<u8>,
    length: usize,
}

impl QrBitBuffer {
    fn put_bit(&mut self, bit: bool) {
        let index = self.length / 8;
        if self.bytes.len() <= index {
            self.bytes.push(0);
        }
        if bit {
            self.bytes[index] |= 0x80 >> (self.length % 8);
        }
        self.length += 1;
    }

    fn put(&mut self, value: u32, length: usize) {
        for offset in 0..length {
            self.put_bit((value >> (length - offset - 1)) & 1 == 1);
        }
    }
}

fn qr_bch_digit(data: u32) -> u32 {
    let mut digit = 0;
    let mut value = data;
    while value != 0 {
        digit += 1;
        value >>= 1;
    }
    digit
}

fn qr_bch_type_info(data: u32) -> u32 {
    let mut remainder = data << 10;
    while qr_bch_digit(remainder) >= qr_bch_digit(QR_G15) {
        remainder ^= QR_G15 << (qr_bch_digit(remainder) - qr_bch_digit(QR_G15));
    }
    ((data << 10) | remainder) ^ QR_G15_MASK
}

fn qr_bch_type_number(data: u32) -> u32 {
    let mut remainder = data << 12;
    while qr_bch_digit(remainder) >= qr_bch_digit(QR_G18) {
        remainder ^= QR_G18 << (qr_bch_digit(remainder) - qr_bch_digit(QR_G18));
    }
    (data << 12) | remainder
}

/// The eight data masks (Vue: `QRMaskPattern`).
fn qr_mask(mask: u8, row: usize, col: usize) -> bool {
    match mask {
        0 => (row + col).is_multiple_of(2),
        1 => row.is_multiple_of(2),
        2 => col.is_multiple_of(3),
        3 => (row + col).is_multiple_of(3),
        4 => (row / 2 + col / 3).is_multiple_of(2),
        5 => (row * col) % 2 + (row * col) % 3 == 0,
        6 => ((row * col) % 2 + (row * col) % 3).is_multiple_of(2),
        7 => ((row * col) % 3 + (row + col) % 2).is_multiple_of(2),
        _ => false,
    }
}

/// One fully encoded matrix (Vue: the `_modules` grid after `make()`).
#[derive(Clone, PartialEq, Debug)]
pub struct QrMatrix {
    size: usize,
    modules: Vec<bool>,
}

impl QrMatrix {
    /// Modules per side (`version * 4 + 17`).
    pub fn size(&self) -> usize {
        self.size
    }

    /// Whether the module at `(row, col)` is dark.
    pub fn is_dark(&self, row: usize, col: usize) -> bool {
        self.modules[row * self.size + col]
    }

    /// The matrix as `#`/`.` rows — the shape the encoder's own tests compare.
    pub fn to_rows(&self) -> Vec<String> {
        (0..self.size)
            .map(|row| {
                (0..self.size)
                    .map(|col| if self.is_dark(row, col) { '#' } else { '.' })
                    .collect()
            })
            .collect()
    }
}

/// The matrix builder (Vue: the `qrcode()` closure state).
struct QrEncoder {
    version: usize,
    level: QrErrorCorrectionLevel,
    size: usize,
    gf: QrGf,
}

impl QrEncoder {
    fn new(version: usize, level: QrErrorCorrectionLevel) -> Self {
        Self {
            version,
            level,
            size: version * 4 + 17,
            gf: QrGf::new(),
        }
    }

    fn index(&self, row: usize, col: usize) -> usize {
        row * self.size + col
    }

    fn set(&self, modules: &mut [Option<bool>], row: usize, col: usize, dark: bool) {
        modules[self.index(row, col)] = Some(dark);
    }

    fn get(&self, modules: &[Option<bool>], row: usize, col: usize) -> Option<bool> {
        modules[self.index(row, col)]
    }

    fn is_dark(&self, modules: &[Option<bool>], row: usize, col: usize) -> bool {
        modules[self.index(row, col)].unwrap_or(false)
    }

    /// Vue's `createData`: header, payload, terminator, byte padding, pad
    /// codewords, then the RS codeword interleave.
    fn create_data(&self, payload: &[u8]) -> Result<Vec<u8>, QrEncodeError> {
        let blocks = qr_rs_blocks(self.version, self.level);
        let total_data: usize = blocks.iter().map(|block| block.data).sum();
        let capacity_bits = total_data * 8;

        let mut buffer = QrBitBuffer::default();
        buffer.put(QR_MODE_8BIT_BYTE, 4);
        buffer.put(payload.len() as u32, qr_byte_length_bits(self.version));
        for &byte in payload {
            buffer.put(u32::from(byte), 8);
        }
        if buffer.length > capacity_bits {
            return Err(QrEncodeError::Overflow {
                bits: buffer.length,
                capacity_bits,
            });
        }
        if buffer.length + 4 <= capacity_bits {
            buffer.put(0, 4);
        }
        while buffer.length % 8 != 0 {
            buffer.put_bit(false);
        }
        loop {
            if buffer.length >= capacity_bits {
                break;
            }
            buffer.put(u32::from(QR_PAD0), 8);
            if buffer.length >= capacity_bits {
                break;
            }
            buffer.put(u32::from(QR_PAD1), 8);
        }
        Ok(self.create_bytes(&blocks, &buffer.bytes))
    }

    /// Vue's `createBytes`: per-block RS remainder, then the data-then-EC
    /// interleave.
    fn create_bytes(&self, blocks: &[QrRsBlock], buffer: &[u8]) -> Vec<u8> {
        let mut offset = 0usize;
        let mut max_data_count = 0usize;
        let mut max_ec_count = 0usize;
        let mut data_blocks: Vec<Vec<u8>> = Vec::with_capacity(blocks.len());
        let mut ec_blocks: Vec<Vec<u8>> = Vec::with_capacity(blocks.len());
        for block in blocks {
            let data_count = block.data;
            let ec_count = block.total - block.data;
            max_data_count = max_data_count.max(data_count);
            max_ec_count = max_ec_count.max(ec_count);
            let data: Vec<u8> = (0..data_count).map(|i| buffer[i + offset]).collect();
            offset += data_count;
            let rs_poly = qr_error_correct_polynomial(&self.gf, ec_count);
            let raw_poly = qr_poly_trim(&data, rs_poly.len() - 1);
            let mod_poly = qr_poly_mod(&self.gf, &raw_poly, &rs_poly);
            let ec_len = rs_poly.len() - 1;
            let mut ec = vec![0u8; ec_len];
            for (i, slot) in ec.iter_mut().enumerate() {
                let mod_index = i as isize + mod_poly.len() as isize - ec_len as isize;
                *slot = if mod_index >= 0 {
                    mod_poly[mod_index as usize]
                } else {
                    0
                };
            }
            data_blocks.push(data);
            ec_blocks.push(ec);
        }

        let total_code: usize = blocks.iter().map(|block| block.total).sum();
        let mut data = vec![0u8; total_code];
        let mut index = 0usize;
        for i in 0..max_data_count {
            for block in &data_blocks {
                if i < block.len() {
                    data[index] = block[i];
                    index += 1;
                }
            }
        }
        for i in 0..max_ec_count {
            for block in &ec_blocks {
                if i < block.len() {
                    data[index] = block[i];
                    index += 1;
                }
            }
        }
        data
    }

    /// Vue's `setupPositionProbePattern`.
    fn setup_position_probe_pattern(&self, modules: &mut [Option<bool>], row: usize, col: usize) {
        let size = self.size as i32;
        for r in -1i32..=7 {
            let target_row = row as i32 + r;
            if target_row <= -1 || size <= target_row {
                continue;
            }
            for c in -1i32..=7 {
                let target_col = col as i32 + c;
                if target_col <= -1 || size <= target_col {
                    continue;
                }
                let dark = (0..=6).contains(&r) && (c == 0 || c == 6)
                    || (0..=6).contains(&c) && (r == 0 || r == 6)
                    || (2..=4).contains(&r) && (2..=4).contains(&c);
                self.set(modules, target_row as usize, target_col as usize, dark);
            }
        }
    }

    /// Vue's `setupPositionAdjustPattern`.
    fn setup_position_adjust_pattern(&self, modules: &mut [Option<bool>]) {
        let positions = QR_PATTERN_POSITION_TABLE[self.version - 1];
        for &row in positions {
            for &col in positions {
                let (row, col) = (usize::from(row), usize::from(col));
                if self.get(modules, row, col).is_some() {
                    continue;
                }
                for r in -2i32..=2 {
                    for c in -2i32..=2 {
                        let dark = r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0);
                        self.set(
                            modules,
                            (row as i32 + r) as usize,
                            (col as i32 + c) as usize,
                            dark,
                        );
                    }
                }
            }
        }
    }

    /// Vue's `setupTimingPattern`.
    fn setup_timing_pattern(&self, modules: &mut [Option<bool>]) {
        let size = self.size;
        for row in 8..size - 8 {
            if self.get(modules, row, 6).is_some() {
                continue;
            }
            self.set(modules, row, 6, row.is_multiple_of(2));
        }
        for col in 8..size - 8 {
            if self.get(modules, 6, col).is_some() {
                continue;
            }
            self.set(modules, 6, col, col % 2 == 0);
        }
    }

    /// Vue's `setupTypeNumber` (version 7 and up only).
    fn setup_type_number(&self, modules: &mut [Option<bool>], test: bool) {
        let bits = qr_bch_type_number(self.version as u32);
        let size = self.size;
        for index in 0..18usize {
            let dark = !test && (bits >> index) & 1 == 1;
            self.set(modules, index / 3, (index % 3) + size - 8 - 3, dark);
        }
        for index in 0..18usize {
            let dark = !test && (bits >> index) & 1 == 1;
            self.set(modules, (index % 3) + size - 8 - 3, index / 3, dark);
        }
    }

    /// Vue's `setupTypeInfo` (the 15-bit format field in both strips).
    fn setup_type_info(&self, modules: &mut [Option<bool>], test: bool, mask: u8) {
        let size = self.size;
        let data = (u32::from(self.level.format_field()) << 3) | u32::from(mask);
        let bits = qr_bch_type_info(data);
        for index in 0..15usize {
            let dark = !test && (bits >> index) & 1 == 1;
            if index < 6 {
                self.set(modules, index, 8, dark);
            } else if index < 8 {
                self.set(modules, index + 1, 8, dark);
            } else {
                self.set(modules, size - 15 + index, 8, dark);
            }
        }
        for index in 0..15usize {
            let dark = !test && (bits >> index) & 1 == 1;
            if index < 8 {
                self.set(modules, 8, size - index - 1, dark);
            } else if index < 9 {
                self.set(modules, 8, 15 - index, dark);
            } else {
                self.set(modules, 8, 15 - index - 1, dark);
            }
        }
        self.set(modules, size - 8, 8, !test);
    }

    /// Vue's `mapData`: two-column zig-zag from the bottom-right corner, the
    /// vertical timing column (6) skipped.
    fn map_data(&self, modules: &mut [Option<bool>], data: &[u8], mask: u8) {
        let size = self.size as i32;
        let mut increment: i32 = -1;
        let mut row = size - 1;
        let mut bit_index: i32 = 7;
        let mut byte_index = 0usize;
        let mut col = size - 1;
        while col > 0 {
            if col == 6 {
                col -= 1;
            }
            loop {
                for offset in 0..2 {
                    let target_col = col - offset;
                    if self
                        .get(modules, row as usize, target_col as usize)
                        .is_none()
                    {
                        let mut dark = false;
                        if byte_index < data.len() {
                            dark = (u32::from(data[byte_index]) >> (bit_index as u32)) & 1 == 1;
                        }
                        if qr_mask(mask, row as usize, target_col as usize) {
                            dark = !dark;
                        }
                        self.set(modules, row as usize, target_col as usize, dark);
                        bit_index -= 1;
                        if bit_index == -1 {
                            byte_index += 1;
                            bit_index = 7;
                        }
                    }
                }
                row += increment;
                if row < 0 || size <= row {
                    row -= increment;
                    increment = -increment;
                    break;
                }
            }
            col -= 2;
        }
    }

    /// Vue's `getLostPoint` (the mask scoring function, penalty rules 1-4).
    fn lost_point(&self, modules: &[Option<bool>]) -> f64 {
        let size = self.size;
        let mut lost = 0.0f64;

        // Rule 1: neighbours of the same colour (3 + run - 5 past five).
        for row in 0..size {
            for col in 0..size {
                let mut same = 0i64;
                let dark = self.is_dark(modules, row, col);
                for r in -1i32..=1 {
                    let neighbour_row = row as i32 + r;
                    if neighbour_row < 0 || size as i32 <= neighbour_row {
                        continue;
                    }
                    for c in -1i32..=1 {
                        let neighbour_col = col as i32 + c;
                        if neighbour_col < 0 || size as i32 <= neighbour_col {
                            continue;
                        }
                        if r == 0 && c == 0 {
                            continue;
                        }
                        if dark
                            == self.is_dark(modules, neighbour_row as usize, neighbour_col as usize)
                        {
                            same += 1;
                        }
                    }
                }
                if same > 5 {
                    lost += (3 + same - 5) as f64;
                }
            }
        }

        // Rule 2: 2x2 blocks of one colour.
        for row in 0..size - 1 {
            for col in 0..size - 1 {
                let mut count = 0;
                if self.is_dark(modules, row, col) {
                    count += 1;
                }
                if self.is_dark(modules, row + 1, col) {
                    count += 1;
                }
                if self.is_dark(modules, row, col + 1) {
                    count += 1;
                }
                if self.is_dark(modules, row + 1, col + 1) {
                    count += 1;
                }
                if count == 0 || count == 4 {
                    lost += 3.0;
                }
            }
        }

        // Rule 3: the 1:1:3:1:1 finder-like runs, horizontally then vertically.
        for row in 0..size {
            for col in 0..size - 6 {
                if self.is_dark(modules, row, col)
                    && !self.is_dark(modules, row, col + 1)
                    && self.is_dark(modules, row, col + 2)
                    && self.is_dark(modules, row, col + 3)
                    && self.is_dark(modules, row, col + 4)
                    && !self.is_dark(modules, row, col + 5)
                    && self.is_dark(modules, row, col + 6)
                {
                    lost += 40.0;
                }
            }
        }
        for col in 0..size {
            for row in 0..size - 6 {
                if self.is_dark(modules, row, col)
                    && !self.is_dark(modules, row + 1, col)
                    && self.is_dark(modules, row + 2, col)
                    && self.is_dark(modules, row + 3, col)
                    && self.is_dark(modules, row + 4, col)
                    && !self.is_dark(modules, row + 5, col)
                    && self.is_dark(modules, row + 6, col)
                {
                    lost += 40.0;
                }
            }
        }

        // Rule 4: deviation from the 50% dark ratio.
        let mut dark_count = 0i64;
        for col in 0..size {
            for row in 0..size {
                if self.is_dark(modules, row, col) {
                    dark_count += 1;
                }
            }
        }
        let size = size as f64;
        let ratio = (100.0 * dark_count as f64 / size / size - 50.0).abs() / 5.0;
        lost += ratio * 10.0;
        lost
    }

    /// Build the grid for one mask. `test` is Vue's `makeImpl(true, i)` mode:
    /// the format/version strips stay light while the mask is being scored.
    fn make_impl(&self, test: bool, mask: u8, data: &[u8], modules: &mut [Option<bool>]) {
        modules.fill(None);
        self.setup_position_probe_pattern(modules, 0, 0);
        self.setup_position_probe_pattern(modules, self.size - 7, 0);
        self.setup_position_probe_pattern(modules, 0, self.size - 7);
        self.setup_position_adjust_pattern(modules);
        self.setup_timing_pattern(modules);
        self.setup_type_info(modules, test, mask);
        if self.version >= 7 {
            self.setup_type_number(modules, test);
        }
        self.map_data(modules, data, mask);
    }

    /// Vue's `getBestMaskPattern`: the lowest penalty over the eight masks.
    fn best_mask(&self, data: &[u8]) -> u8 {
        let mut min_lost = 0.0f64;
        let mut pattern = 0u8;
        let mut scratch = vec![None; self.size * self.size];
        for candidate in 0..8u8 {
            self.make_impl(true, candidate, data, &mut scratch);
            let lost = self.lost_point(&scratch);
            if candidate == 0 || min_lost > lost {
                min_lost = lost;
                pattern = candidate;
            }
        }
        pattern
    }
}

/// Encode `value` at `level` into a QR module matrix, auto-selecting the
/// smallest version that fits (the exact path `HkQrCode` drives).
pub fn qr_matrix(value: &str, level: QrErrorCorrectionLevel) -> Result<QrMatrix, QrEncodeError> {
    let payload = qr_payload_bytes(value);
    let encoder = QrEncoder::new(qr_version_for_byte_len(payload.len(), level), level);
    let data = encoder.create_data(&payload)?;
    let mask = encoder.best_mask(&data);
    let mut modules = vec![None; encoder.size * encoder.size];
    encoder.make_impl(false, mask, &data, &mut modules);
    Ok(QrMatrix {
        size: encoder.size,
        modules: modules
            .into_iter()
            .map(|module| module.unwrap_or(false))
            .collect(),
    })
}

/// Escape a caller string for a quoted attribute inside the SVG markup;
/// `dangerous_inner_html` bypasses tairitsu's escaper, so the mirror owns it.
fn escape_markup(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// The module grid as SVG markup. `matrix: None` is the overflow case: the
/// light card renders without modules (Vue's blank canvas after its throw).
fn qr_code_svg(
    matrix: Option<&QrMatrix>,
    size: f64,
    margin: f64,
    dark: &str,
    light: &str,
    aria_label: &str,
) -> String {
    let module_count = matrix.map(|matrix| matrix.size()).unwrap_or(0);
    let total = module_count as f64 + margin * 2.0;
    let total = if total > 0.0 { total } else { 1.0 };

    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg class="hk-qr-canvas" width="{size}" height="{size}" viewBox="0 0 {total} {total}" role="img" aria-label="{}" style="width:{size}px;height:{size}px" shape-rendering="crispEdges">"#,
        escape_markup(aria_label)
    ));
    // The canvas painted its own background over the sheet's white; the SVG
    // needs the rect explicitly so `inverse` really inverts the card.
    svg.push_str(&format!(
        r#"<rect width="{total}" height="{total}" fill="{}"/>"#,
        escape_markup(light)
    ));
    if let Some(matrix) = matrix {
        svg.push_str(&format!(r#"<g fill="{}">"#, escape_markup(dark)));
        for row in 0..module_count {
            let mut col = 0usize;
            while col < module_count {
                if !matrix.is_dark(row, col) {
                    col += 1;
                    continue;
                }
                let start = col;
                while col < module_count && matrix.is_dark(row, col) {
                    col += 1;
                }
                let run = col - start;
                let x = margin + start as f64;
                let y = margin + row as f64;
                svg.push_str(&format!(
                    r#"<rect x="{x}" y="{y}" width="{run}" height="1"/>"#
                ));
            }
        }
        svg.push_str("</g>");
    }
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct QrCodeProps {
    /// Payload to encode (Vue default `""`); whitespace-only renders nothing.
    #[default]
    pub value: String,

    /// Rendered square size in CSS px (Vue default 168).
    #[default(168.0)]
    pub size: f64,

    /// Quiet-zone width in modules (Vue default 2).
    #[default(2.0)]
    pub margin: f64,

    /// Error-correction level (Vue default `"M"`).
    #[default]
    pub level: QrErrorCorrectionLevel,

    /// Dark module ink (Vue default `"#000000"`).
    #[default("#000000".to_string())]
    pub color_dark: String,

    /// Light module ink (Vue default `"#ffffff"`).
    #[default("#ffffff".to_string())]
    pub color_light: String,

    /// Swap dark/light (advanced use with a dark card; Vue default false).
    #[default]
    pub inverse: bool,

    /// Optional caption under the QR (also the accessible name when set).
    #[default]
    pub label: String,

    /// Declared in Vue and never read there — kept inert for prop parity (see
    /// the header delta).
    #[default]
    pub disabled: bool,
}

#[component]
pub fn QrCode(props: QrCodeProps) -> Element {
    let has_value = !props.value.trim().is_empty();
    let (dark, light) = if props.inverse {
        (props.color_light, props.color_dark)
    } else {
        (props.color_dark, props.color_light)
    };
    // Vue: `props.label || t("hikari::qrCode.alt", "QR code")`.
    let aria_label = if props.label.is_empty() {
        hikari_i18n::t("components.hk.qrCode.alt", "QR code")
    } else {
        props.label.clone()
    };

    let mut card = VElement::new("div").class("hk-qr-card");
    if !has_value {
        card = card.attr("data-empty", "true");
    }
    if has_value {
        let matrix = qr_matrix(&props.value, props.level).ok();
        let svg = qr_code_svg(
            matrix.as_ref(),
            props.size,
            props.margin,
            &dark,
            &light,
            &aria_label,
        );
        // inner_html suppresses children, so the SVG owns a `display:contents`
        // host and the caption stays a sibling of it (L49).
        card = card.child(VNode::Element(Box::new(
            VElement::new("div")
                .style("display:contents")
                .dangerous_inner_html(svg),
        )));
    }
    if !props.label.is_empty() {
        card = card.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-qr-label")
                .child(VNode::Text(VText::new(&props.label))),
        )));
    }

    VNode::Element(Box::new(card))
}

impl StyledComponent for QrCodeComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkQrCode.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "qr-code"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // "HELLO WORLD" / M -> 21x21
    const GOLDEN_HELLO_WORLD_M: &[&str] = &[
        "#######.#...#.#######",
        "#.....#.#...#.#.....#",
        "#.###.#.......#.###.#",
        "#.###.#.#.#.#.#.###.#",
        "#.###.#..###..#.###.#",
        "#.....#...###.#.....#",
        "#######.#.#.#.#######",
        "........#####........",
        "#.##.###.#.##.#..#.##",
        ".##....#.#######.##..",
        ".....#####.#.#.#...##",
        "#.#.##.##..#...#.#.#.",
        "#...#.##.##.##....#.#",
        "........#.##..##..#.#",
        "#######.#.#######....",
        "#.....#.###..#.#.####",
        "#.###.#..#..#.#..#...",
        "#.###.#.###...#..###.",
        "#.###.#.##..#..#..#..",
        "#.....#..###.####...#",
        "#######.##.#.#.#.....",
    ];

    // "HELLO WORLD" / H -> 25x25
    const GOLDEN_HELLO_WORLD_H: &[&str] = &[
        "#######.#....###..#######",
        "#.....#.####...#..#.....#",
        "#.###.#.#..######.#.###.#",
        "#.###.#..##..#..#.#.###.#",
        "#.###.#....#####..#.###.#",
        "#.....#.#####.##..#.....#",
        "#######.#.#.#.#.#.#######",
        "........##...##..........",
        "..###.#.###.########..###",
        "#..##....##..####.##..#.#",
        "#.#.###.##########..##.##",
        "##.....###......#.#....##",
        "#..##.###..#.#.#.###.#.##",
        "#.##....#...#..##.##..#.#",
        "#.#.###......#...#####.##",
        "#.###...##..##..#.###...#",
        "#.#..##.###.#.#.######...",
        "........###.....#...#.#.#",
        "#######..##.##.##.#.#.###",
        "#.....#........##...##.#.",
        "#.###.#.###.#..########..",
        "#.###.#.#..#.#....#..#..#",
        "#.###.#.#..##..#..##.#..#",
        "#.....#...##.#.#.#.##...#",
        "#######..#...##.#..#...##",
    ];

    // "中文测试" / M -> 21x21
    const GOLDEN_CJK_M: &[&str] = &[
        "#######..#.##.#######",
        "#.....#..##.#.#.....#",
        "#.###.#.##.##.#.###.#",
        "#.###.#.##.#..#.###.#",
        "#.###.#.#..##.#.###.#",
        "#.....#.#...#.#.....#",
        "#######.#.#.#.#######",
        "........##.##........",
        "#.#####.....#.#####..",
        "..#.##.##.#.#..#.##..",
        ".#.#..#....#.#..##..#",
        "####...##.#....#####.",
        "...#..#.####.#..#.###",
        "........#.#####.....#",
        "#######..##.#.##.#...",
        "#.....#.##.####..#...",
        "#.###.#.###.#..#.###.",
        "#.###.#.##..#..#.##..",
        "#.###.#.#.##.#..###..",
        "#.....#..##....##.#..",
        "#######.#.##.#..#.##.",
    ];

    #[test]
    fn qr_levels_match_the_vue_prop_strings() {
        let levels = [
            QrErrorCorrectionLevel::L,
            QrErrorCorrectionLevel::M,
            QrErrorCorrectionLevel::Q,
            QrErrorCorrectionLevel::H,
        ];
        let names = ["L", "M", "Q", "H"];
        for (level, name) in levels.iter().zip(names) {
            assert_eq!(level.name(), name);
            assert_eq!(QrErrorCorrectionLevel::from_name(name), *level);
        }
        // Vue's prop validator only accepts the four strings; anything else is
        // the documented `M` fallback.
        assert_eq!(
            QrErrorCorrectionLevel::from_name("Z"),
            QrErrorCorrectionLevel::M
        );
        // The format field is the encoder's enum, not the table order.
        assert_eq!(QrErrorCorrectionLevel::L.format_field(), 1);
        assert_eq!(QrErrorCorrectionLevel::M.format_field(), 0);
        assert_eq!(QrErrorCorrectionLevel::Q.format_field(), 3);
        assert_eq!(QrErrorCorrectionLevel::H.format_field(), 2);
    }

    #[test]
    fn qr_defaults_match_the_vue_props() {
        let props = QrCodeProps::default();
        assert_eq!(props.value, "");
        assert_eq!(props.size, 168.0);
        assert_eq!(props.margin, 2.0);
        assert_eq!(props.level, QrErrorCorrectionLevel::M);
        assert_eq!(props.color_dark, "#000000");
        assert_eq!(props.color_light, "#ffffff");
        assert!(!props.inverse);
        assert_eq!(props.label, "");
        assert!(!props.disabled);
    }

    #[test]
    fn qr_payload_bytes_mirror_the_vendored_utf16_truncation() {
        assert_eq!(qr_payload_bytes("ABC"), vec![0x41, 0x42, 0x43]);
        // `charCodeAt(i) & 0xff` for the four CJK code points.
        assert_eq!(qr_payload_bytes("中文测试"), vec![0x2d, 0x87, 0x4b, 0xd5]);
        // A non-BMP character is two UTF-16 code units, so two (truncated) bytes.
        assert_eq!(qr_payload_bytes("😀").len(), 2);
    }

    #[test]
    fn qr_data_codewords_match_the_standard_version_one_capacities() {
        // Version 1 byte-mode capacity: L 17, M 14, Q 11, H 7.
        for (level, fits, overflows) in [
            (QrErrorCorrectionLevel::L, 17, 18),
            (QrErrorCorrectionLevel::M, 14, 15),
            (QrErrorCorrectionLevel::Q, 11, 12),
            (QrErrorCorrectionLevel::H, 7, 8),
        ] {
            assert!(qr_payload_fits(fits, 1, level), "{level:?} v1 fits {fits}");
            assert!(
                !qr_payload_fits(overflows, 1, level),
                "{level:?} v1 must overflow at {overflows}"
            );
            assert_eq!(qr_version_for_byte_len(fits, level), 1);
            assert_eq!(qr_version_for_byte_len(overflows, level), 2);
        }
        assert_eq!(
            qr_data_codewords(1, QrErrorCorrectionLevel::L),
            19,
            "version 1 L carries 19 data codewords"
        );
        assert_eq!(
            qr_data_codewords(1, QrErrorCorrectionLevel::H),
            9,
            "version 1 H carries 9 data codewords"
        );
    }

    #[test]
    fn qr_stronger_error_correction_never_shrinks_the_version() {
        // The same payload needs an equal or larger version as the level rises.
        for byte_len in [1usize, 7, 14, 30, 100, 500] {
            let versions: Vec<usize> = [
                QrErrorCorrectionLevel::L,
                QrErrorCorrectionLevel::M,
                QrErrorCorrectionLevel::Q,
                QrErrorCorrectionLevel::H,
            ]
            .into_iter()
            .map(|level| qr_version_for_byte_len(byte_len, level))
            .collect();
            assert!(
                versions.windows(2).all(|pair| pair[0] <= pair[1]),
                "versions must not shrink as correction grows: {versions:?} for {byte_len} bytes"
            );
        }
    }

    #[test]
    fn qr_matrix_places_the_three_finder_patterns() {
        let matrix = qr_matrix("HELLO WORLD", QrErrorCorrectionLevel::M).expect("encodes");
        let size = matrix.size();
        assert_eq!(size, 21, "version 1 is 21 modules per side");
        for (row0, col0) in [(0usize, 0usize), (0, size - 7), (size - 7, 0)] {
            for row in 0..7usize {
                for col in 0..7usize {
                    let ring = row == 0 || row == 6 || col == 0 || col == 6;
                    let core = (2..=4).contains(&row) && (2..=4).contains(&col);
                    assert_eq!(
                        matrix.is_dark(row0 + row, col0 + col),
                        ring || core,
                        "finder module ({row},{col}) at ({row0},{col0})"
                    );
                }
            }
        }
    }

    #[test]
    fn qr_matrix_is_deterministic() {
        let first = qr_matrix(
            "otpauth://totp/Example:a@b.c?secret=JBSWY3DPEHPK3PXP",
            QrErrorCorrectionLevel::M,
        )
        .expect("encodes");
        let second = qr_matrix(
            "otpauth://totp/Example:a@b.c?secret=JBSWY3DPEHPK3PXP",
            QrErrorCorrectionLevel::M,
        )
        .expect("encodes");
        assert_eq!(first.to_rows(), second.to_rows());
    }

    #[test]
    fn qr_golden_matrices_match_the_vendored_encoder() {
        // Filled from the vendored `qrcode-generator` (the same encoder the Vue
        // component imports) — a table or scoring drift reds here.
        let cases: [(&str, QrErrorCorrectionLevel, &[&str]); 3] = [
            (
                "HELLO WORLD",
                QrErrorCorrectionLevel::M,
                GOLDEN_HELLO_WORLD_M,
            ),
            (
                "HELLO WORLD",
                QrErrorCorrectionLevel::H,
                GOLDEN_HELLO_WORLD_H,
            ),
            ("中文测试", QrErrorCorrectionLevel::M, GOLDEN_CJK_M),
        ];
        for (value, level, golden) in cases {
            let matrix = qr_matrix(value, level).expect("encodes");
            assert_eq!(matrix.size(), golden.len(), "{value} / {level:?}");
            assert_eq!(matrix.to_rows(), golden, "{value} / {level:?}");
        }
    }

    #[test]
    fn qr_overflow_reports_the_vue_message_shape() {
        let error = qr_matrix(&"x".repeat(3000), QrErrorCorrectionLevel::M).expect_err("overflows");
        let QrEncodeError::Overflow {
            bits,
            capacity_bits,
        } = error;
        assert!(bits > capacity_bits, "{bits} > {capacity_bits}");
        assert_eq!(
            error.to_string(),
            format!("code length overflow. ({bits}>{capacity_bits})")
        );
    }

    #[test]
    fn qr_dark_population_stays_balanced() {
        let matrix = qr_matrix(
            "otpauth://totp/Example:langyo%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example",
            QrErrorCorrectionLevel::M,
        )
        .expect("encodes");
        let dark = (0..matrix.size())
            .flat_map(|row| (0..matrix.size()).map(move |col| (row, col)))
            .filter(|(row, col)| matrix.is_dark(*row, *col))
            .count();
        let total = matrix.size() * matrix.size();
        assert!(dark > total / 5, "too few dark modules: {dark}/{total}");
        assert!(
            dark < total * 4 / 5,
            "too many dark modules: {dark}/{total}"
        );
    }

    #[test]
    fn qr_renders_the_card_grid_and_aria_label() {
        let html = QrCode(QrCodeProps {
            value: "HELLO WORLD".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-qr-card",
            "display:contents",
            "hk-qr-canvas",
            "role=\"img\"",
            "aria-label=\"QR code\"",
            "viewBox=\"0 0 25 25\"",
            "style=\"width:168px;height:168px\"",
            "shape-rendering=\"crispEdges\"",
            "<g fill=\"#000000\">",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("data-empty"), "{html}");
    }

    #[test]
    fn qr_empty_payload_renders_the_empty_card_only() {
        let html = QrCode(QrCodeProps {
            value: "   ".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-qr-card"), "{html}");
        assert!(html.contains("data-empty=\"true\""), "{html}");
        assert!(!html.contains("hk-qr-canvas"), "{html}");
    }

    #[test]
    fn qr_inverse_swaps_the_inks_and_label_wins_the_accessible_name() {
        let html = QrCode(QrCodeProps {
            value: "HELLO WORLD".to_string(),
            label: "Scan me".to_string(),
            inverse: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("aria-label=\"Scan me\""), "{html}");
        assert!(html.contains("<g fill=\"#ffffff\">"), "{html}");
        assert!(html.contains("fill=\"#000000\"/>"), "{html}");
        assert!(html.contains("</g></svg>"), "{html}");
        assert!(html.contains("hk-qr-label"), "{html}");
    }

    #[test]
    fn qr_label_and_inks_are_escaped() {
        let html = QrCode(QrCodeProps {
            value: "HELLO WORLD".to_string(),
            label: "\"><script>alert(1)</script>".to_string(),
            color_dark: "\"><b>".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("<script>"), "{html}");
        assert!(!html.contains("<b>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
    }

    #[test]
    fn qr_styles_come_from_the_canonical_vue_sheet() {
        let css = QrCodeComponent::styles();
        for needle in [".hk-qr-card", ".hk-qr-canvas", ".hk-qr-label"] {
            assert!(css.contains(needle), "qr css must carry {needle}: {css}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored qr sheet"
        );
    }
}
