#!/usr/bin/env python3
# AI-generated: developed with the DeepSeek Harness agent (model
# DeepSeek-V4.1-Flash) directed and reviewed by the lead agent — SySL-1.0
# §2.3 disclosure.
"""Generate the built-in sign-in mark of the central identity provider.

    python3 packages/vue/scripts/build-central-auth-mark.py <source.webp>
    python3 packages/vue/scripts/build-central-auth-mark.py <source.webp> \\
        --preview /tmp/central-auth-mark.png

WHY A GENERATED DATA URI. The mark rides the sign-in rows every host builds
with `HkLoginFlow` (chest, 0721 and, later, ayane), so it lives in the Vue
package — but a repo-side binary copy of the site logo would be a second home
for an asset whose only home is the landing repo's `res/logos/<slug>.webp`
(AGENTS.md: 徽标唯一家). A base64 data URI carries the pixels inside the
module: nothing to fetch, nothing to 404 behind a host's asset root, and no
new file for a bundler to relocate. It is 64×64 and a couple of KB, so the
inline cost is a rounding error next to the component code that imports it.

THE PIN. The source is identified by sha256, not by path: a repainted logo
changes those bytes, and this script refuses to run until a human confirms
the new mark is the one sign-in rows should show. That refusal is the point
— silently regenerating from whatever sits at the path is how a host's login
screen starts showing last quarter's artwork.

    source  ……/celestia-island.github.io/res/logos/celestia.webp
    sha256  …  (see `SOURCE_SHA256` below; the only accepted input)

Shape of the output: crop to the alpha bounding box (the 1024×1024 canvas is
mostly transparent), scale uniformly into a 64×64 transparent square with a
2 px margin on every side, LANCZOS resample, WebP with alpha. If the result
exceeds BUDGET_BYTES the quality ladder steps down (90 → 80 → 70); if even
the floor of the ladder is too big the canvas drops to 48×48 and the ladder
runs again. The parameters that actually won are written into the generated
file's header, so the artifact explains itself.

The 2 px margin matters for the consumer: `hkCentralAuthMarkSrc` is rendered
as a 16×16 icon in a row of buttons, and neighbouring glyphs sit close to
their box edges — a mark that touches its own edge looks larger and heavier
than the icons beside it.

Determinism: the same source bytes with the same parameters produce the same
output bytes (both the image pipeline and libwebp are deterministic here, and
the module text carries no timestamps, so a second run is a no-op diff). The
committed module is regenerated this way; the drift test in
`src/components/loginProviders.test.ts` re-runs this script and compares.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guard, not logic
    sys.stderr.write(
        "build-central-auth-mark: Pillow is required (pip install pillow)\n"
    )
    raise SystemExit(2)

# The landing repo's logo is the only accepted input (AGENTS.md 徽标唯一家).
SOURCE_SHA256 = "4f5c9efbcbdaea5e66eefe584f490c5f71b68daed3765a144f267eb7a042a648"
SOURCE_LABEL = "celestia-island.github.io/res/logos/celestia.webp"

# The host-facing URL shape. Deliberately named as an *internal* repo detail:
# the docs point consumers at `hkCentralAuthMarkSrc`, not at this path.
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUT = (
    REPO_ROOT / "packages" / "vue" / "src" / "components" / "centralAuthMarkData.ts"
)

BUDGET_BYTES = 3 * 1024
CANVAS_SIZES = (64, 48)
MARGIN = 2
QUALITY_LADDER = (90, 80, 70)
WEBP_METHOD = 6

DISCLOSURE = (
    "AI-generated: developed with the DeepSeek Harness agent (model "
    "DeepSeek-V4.1-Flash) directed and reviewed by the lead agent — "
    "SySL-1.0 §2.3 disclosure."
)


@dataclass(frozen=True)
class EncodeChoice:
    """The parameters that produced the committed bytes."""

    canvas: int
    quality: int
    payload: bytes

    @property
    def rendered(self) -> tuple[int, int]:
        """The scaled logo inside the canvas (canvas minus both margins)."""
        return self.canvas - 2 * MARGIN, self.canvas - 2 * MARGIN


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def crop_to_alpha_bbox(source: Image.Image) -> Image.Image:
    """Drop the transparent padding the 1024×1024 canvas carries."""
    rgba = source.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit("build-central-auth-mark: source is fully transparent")
    return rgba.crop(bbox)


def fit_square(mark: Image.Image, canvas: int) -> Image.Image:
    """Uniformly scale `mark` into `canvas`×`canvas`, MARGIN px all round.

    Both axes keep the aspect ratio of the trimmed mark: the logo is wider
    than it is tall, so the width fills the usable box and the height
    centres. Centring (rather than gluing the mark to a corner) keeps the
    optical weight of the 16×16 rendering centred too.
    """
    usable = canvas - 2 * MARGIN
    if usable <= 0:
        raise ValueError(f"canvas {canvas} leaves no room for a {MARGIN}px margin")
    scale = min(usable / mark.width, usable / mark.height)
    width = max(1, round(mark.width * scale))
    height = max(1, round(mark.height * scale))
    scaled = mark.resize((width, height), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(scaled, ((canvas - width) // 2, (canvas - height) // 2))
    return out


def encode_webp(image: Image.Image, quality: int) -> bytes:
    buffer = io.BytesIO()
    # `method=6` is libwebp's slowest/best search; it is also the only one
    # whose output we pin in the drift test, so keep it explicit rather than
    # riding Pillow's default.
    image.save(buffer, format="WEBP", quality=quality, method=WEBP_METHOD)
    return buffer.getvalue()


def choose_encoding(mark: Image.Image) -> EncodeChoice:
    """Walk the quality ladder (and the 48×48 fallback) until the byte budget holds."""
    for canvas in CANVAS_SIZES:
        square = fit_square(mark, canvas)
        for quality in QUALITY_LADDER:
            payload = encode_webp(square, quality)
            if len(payload) <= BUDGET_BYTES:
                return EncodeChoice(canvas=canvas, quality=quality, payload=payload)
    raise SystemExit(
        "build-central-auth-mark: the smallest candidate is "
        f"{len(payload)} bytes, over the {BUDGET_BYTES}-byte budget — "
        "tighten the ladder deliberately, do not ship a heavy icon"
    )


def render_module(choice: EncodeChoice) -> str:
    width, height = choice.rendered
    payload_b64 = base64.b64encode(choice.payload).decode("ascii")
    # ONE string literal, deliberately unwrapped. Adjacent-literal wrapping
    # reads better in an editor, but Vite 8 transforms this file with esbuild
    # WITHOUT `minifyWhitespace`, which glues only the first continuation onto
    # the declaration and drops the other lines' values — measured: the
    # runtime payload came back as the first 96 characters, a 72-byte image.
    # The unwrapped literal survives every transform (and, at ~2.2 kB, is
    # shorter than the comments above it).
    header = f"""\
// AI-generated: developed with the DeepSeek Harness agent (model
// DeepSeek-V4.1-Flash) directed and reviewed by the lead agent — SySL-1.0
// §2.3 disclosure.
//
// GENERATED — do not edit. Regenerate with:
//
//     python3 packages/vue/scripts/build-central-auth-mark.py \\
//         <checkout>/celestia-island.github.io/res/logos/celestia.webp
//
// source      {SOURCE_LABEL}
// source sha256  {SOURCE_SHA256}
// output      64×64-and-under square, {choice.canvas}×{choice.canvas} canvas,
//             logo {width}×{height}, {MARGIN}px margin, WebP quality {choice.quality},
//             method {WEBP_METHOD}, {len(choice.payload)} bytes
//
// One WebP data URI for the built-in sign-in mark of the central identity
// provider. Hosts render it at 16×16; see `loginProviders.ts` for the
// precedence rules behind it.
//
// The payload below is ONE string literal on ONE line on purpose: adjacent
// wrapped literals survive `node` but not Vite's non-minifying esbuild pass
// (see the generator's `render_module`).
"""
    return f"""{header}
const hkCentralAuthMarkPayload = "{payload_b64}";

/**
 * The central identity provider's mark, ready for `src=` / CSS `url(…)`.
 *
 * A 64×64 WebP data URI (transparent background) generated from the landing
 * repo's logo — the single home for Celestia artwork — and committed as text
 * so no host has to serve or resolve a separate asset file. Render it at
 * 16×16; the source carries a 2 px margin so it optically matches the
 * surrounding icons.
 */
export const hkCentralAuthMarkSrc = `data:image/webp;base64,${{hkCentralAuthMarkPayload}}`;
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate the central identity provider's sign-in mark module.",
    )
    parser.add_argument("source", type=Path, help=f"source WebP ({SOURCE_LABEL})")
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="module to write (default: packages/vue/src/components/centralAuthMarkData.ts)",
    )
    parser.add_argument(
        "--preview",
        type=Path,
        default=None,
        help="also write the same image as a PNG for human inspection (not committed)",
    )
    args = parser.parse_args(argv)

    if not args.source.is_file():
        sys.stderr.write(f"build-central-auth-mark: no such file: {args.source}\n")
        return 1

    actual = sha256_of(args.source)
    if actual != SOURCE_SHA256:
        sys.stderr.write(
            "build-central-auth-mark: source sha256 mismatch — refusing to regenerate.\n"
            f"  expected {SOURCE_SHA256}\n"
            f"  actual   {actual}\n"
            "The logo is the single home for Celestia artwork; if this change is\n"
            "intended, confirm the new mark with the lead and update SOURCE_SHA256\n"
            "in this script together with the regenerated module.\n"
        )
        return 1

    with Image.open(args.source) as source:
        source.load()
        mark = crop_to_alpha_bbox(source)

    choice = choose_encoding(mark)
    module_text = render_module(choice)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(module_text, encoding="utf-8")

    if args.preview is not None:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(io.BytesIO(choice.payload)) as encoded:
            encoded.load()
            encoded.save(args.preview, format="PNG")

    width, height = choice.rendered
    print(
        f"build-central-auth-mark: {args.out} — {choice.canvas}×{choice.canvas} canvas, "
        f"logo {width}×{height}, quality {choice.quality}, "
        f"{len(choice.payload)} bytes",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
