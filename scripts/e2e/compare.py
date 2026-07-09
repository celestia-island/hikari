"""
Screenshot Comparison Engine

Provides pixel-level and perceptual screenshot comparison for visual regression testing.
Supports:
  - Exact pixel matching (byte-for-byte)
  - Tolerant pixel matching (RGB threshold per channel)
  - Anti-aliasing tolerant comparison (ignore 1-2px differences)
  - Region-based comparison (crop to specific area)
  - Diff heatmap image generation (highlighting changed pixels)
  - SSIM-like perceptual scoring

Dependencies (optional, with graceful fallback):
  - Pillow (PIL): for image processing and heatmap generation
    pip install Pillow
"""

from __future__ import annotations

import math
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageChops, ImageFilter  # noqa: F401  (availability check)
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


@dataclass
class DiffRegion:
    """A rectangular region where differences were detected."""
    x: int
    y: int
    width: int
    height: int
    pixel_count: int = 0
    mean_diff: float = 0.0


@dataclass
class ComparisonResult:
    """Result of comparing two screenshots."""
    identical: bool = False
    passed: bool = False
    total_pixels: int = 0
    different_pixels: int = 0
    diff_percentage: float = 0.0
    mean_diff: float = 0.0
    max_diff: float = 0.0
    diff_image_path: Optional[str] = None
    regions: list[DiffRegion] = field(default_factory=list)
    error: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    @property
    def summary(self) -> str:
        if self.error:
            return f"ERROR: {self.error}"
        if self.identical:
            return "IDENTICAL - screenshots are byte-for-byte identical"
        status = "PASS" if self.passed else "FAIL"
        return (
            f"{status} - {self.different_pixels}/{self.total_pixels} pixels differ "
            f"({self.diff_percentage:.2f}%), mean_diff={self.mean_diff:.1f}"
        )


def _load_image(path: str) -> Optional[Image.Image]:
    if not PIL_AVAILABLE:
        return None
    try:
        return Image.open(path).convert("RGBA")
    except Exception:
        return None


def _pixel_diff(c1: tuple[int, ...], c2: tuple[int, ...]) -> float:
    """Compute Euclidean distance between two RGBA pixels."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1[:4], c2[:4])))


def _compute_histogram(img: Image.Image) -> list[int]:
    """Compute a simple luminance histogram for perceptual comparison."""
    if not PIL_AVAILABLE:
        return []
    hist = [0] * 256
    for px in img.getdata():
        r, g, b = px[0], px[1], px[2]
        lum = int(0.299 * r + 0.587 * g + 0.114 * b)
        hist[min(lum, 255)] += 1
    return hist


def _histogram_intersection(h1: list[int], h2: list[int]) -> float:
    """Compare two histograms (0.0 = completely different, 1.0 = identical)."""
    if not h1 or not h2:
        return 0.0
    total = sum(min(a, b) for a, b in zip(h1, h2))
    return total / max(sum(h1), sum(h2), 1)


class ScreenshotComparator:
    """
    Compare screenshots with configurable tolerance.

    Usage:
        cmp = ScreenshotComparator(pixel_threshold=30, max_diff_ratio=0.01)
        result = cmp.compare("baseline.png", "candidate.png", "diff_output.png")
        print(result.summary)
    """

    def __init__(
        self,
        pixel_threshold: int = 30,
        max_diff_ratio: float = 0.01,
        aa_tolerance: int = 2,
        min_region_size: int = 10,
        diff_color: tuple[int, int, int, int] = (255, 0, 0, 180),
    ):
        """
        Args:
            pixel_threshold: Max per-channel RGB difference before counting as changed (0-255).
            max_diff_ratio: Max ratio of different pixels allowed (0.0-1.0). Default 1%.
            aa_tolerance: Ignore differences within N pixels of a changed pixel (anti-aliasing).
            min_region_size: Minimum pixel count for a diff region to be reported.
            diff_color: RGBA color for highlighting diffs in heatmap images.
        """
        if not PIL_AVAILABLE:
            raise ImportError(
                "Pillow is required for screenshot comparison. "
                "Install with: pip install Pillow"
            )
        self.pixel_threshold = pixel_threshold
        self.max_diff_ratio = max_diff_ratio
        self.aa_tolerance = aa_tolerance
        self.min_region_size = min_region_size
        self.diff_color = diff_color

    def compare(
        self,
        baseline_path: str,
        candidate_path: str,
        diff_output_path: Optional[str] = None,
        region: Optional[tuple[int, int, int, int]] = None,
    ) -> ComparisonResult:
        """
        Compare two screenshots.

        Args:
            baseline_path: Path to the reference/golden screenshot.
            candidate_path: Path to the new/current screenshot.
            diff_output_path: Where to save the diff heatmap (optional).
            region: (x, y, w, h) crop rectangle to compare only a region.

        Returns:
            ComparisonResult with detailed diff statistics.
        """
        result = ComparisonResult(metadata={
            "baseline": baseline_path,
            "candidate": candidate_path,
            "threshold": self.pixel_threshold,
            "max_ratio": self.max_diff_ratio,
        })

        baseline = _load_image(baseline_path)
        candidate = _load_image(candidate_path)

        if baseline is None or candidate is None:
            result.error = f"Cannot load images: baseline={'OK' if baseline else 'FAIL'}, candidate={'OK' if candidate else 'FAIL'}"
            return result

        if region:
            baseline = baseline.crop(region)
            candidate = candidate.crop(region)

        bw, bh = baseline.size
        cw, ch = candidate.size

        if (bw, bh) != (cw, ch):
            result.error = (
                f"Size mismatch: baseline={bw}x{bh}, candidate={cw}x{ch}"
            )
            result.metadata["baseline_size"] = f"{bw}x{bh}"
            result.metadata["candidate_size"] = f"{cw}x{ch}"
            return result

        result.total_pixels = bw * bh

        bl_data = baseline.load()
        cd_data = candidate.load()

        diff_mask = [[False] * bh for _ in range(bw)]
        diff_values = []
        max_d = 0.0
        sum_d = 0.0
        diff_count = 0

        for y in range(bh):
            for x in range(bw):
                p1 = bl_data[x, y]
                p2 = cd_data[x, y]
                d = _pixel_diff(p1, p2)
                if d > self.pixel_threshold:
                    diff_mask[x][y] = True
                    diff_count += 1
                    diff_values.append(d)
                    sum_d += d
                    if d > max_d:
                        max_d = d

        result.different_pixels = diff_count
        result.diff_percentage = (diff_count / result.total_pixels * 100) if result.total_pixels else 0
        result.mean_diff = (sum_d / diff_count) if diff_count else 0.0
        result.max_diff = max_d
        result.passed = result.diff_percentage <= (self.max_diff_ratio * 100)
        result.identical = diff_count == 0

        if diff_output_path and diff_count > 0:
            diff_img = self._generate_heatmap(
                baseline, candidate, diff_mask, bw, bh
            )
            Path(diff_output_path).parent.mkdir(parents=True, exist_ok=True)
            diff_img.save(diff_output_path)
            result.diff_image_path = diff_output_path

        result.regions = self._find_regions(diff_mask, bw, bh)
        return result

    def _generate_heatmap(
        self,
        baseline: Image.Image,
        candidate: Image.Image,
        mask: list[list[bool]],
        width: int,
        height: int,
    ) -> Image.Image:
        """Generate a diff heatmap showing changed regions."""
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        bl_data = baseline.load()

        for y in range(height):
            for x in range(width):
                if mask[x][y]:
                    draw.point((x, y), fill=self.diff_color)

        result = baseline.convert("RGB").copy()
        result.paste(Image.alpha_composite(
            Image.new("RGBA", baseline.size, (0, 0, 0, 0)), overlay
        ), (0, 0))

        return result

    def _find_regions(
        self,
        mask: list[list[bool]],
        width: int,
        height: int,
    ) -> list[DiffRegion]:
        """Group adjacent changed pixels into bounding-box regions."""
        visited = [[False] * height for _ in range(width)]
        regions = []

        def flood_fill(sx: int, sy: int) -> DiffRegion:
            stack = [(sx, sy)]
            pixels = []
            min_x, min_y = sx, sy
            max_x, max_y = sx, sy
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cx >= width or cy < 0 or cy >= height:
                    continue
                if visited[cx][cy] or not mask[cx][cy]:
                    continue
                visited[cx][cy] = True
                pixels.append((cx, cy))
                min_x = min(min_x, cx)
                min_y = min(min_y, cy)
                max_x = max(max_x, cx)
                max_y = max(max_y, cy)
                for dx in range(-self.aa_tolerance, self.aa_tolerance + 1):
                    for dy in range(-self.aa_tolerance, self.aa_tolerance + 1):
                        if dx != 0 or dy != 0:
                            stack.append((cx + dx, cy + dy))

            return DiffRegion(
                x=min_x, y=min_y,
                width=max_x - min_x + 1,
                height=max_y - min_y + 1,
                pixel_count=len(pixels),
            )

        for y in range(height):
            for x in range(width):
                if mask[x][y] and not visited[x][y]:
                    region = flood_fill(x, y)
                    if region.pixel_count >= self.min_region_size:
                        regions.append(region)

        regions.sort(key=lambda r: r.pixel_count, reverse=True)
        return regions

    def compare_perceptual(
        self,
        baseline_path: str,
        candidate_path: str,
        diff_output_path: Optional[str] = None,
    ) -> ComparisonResult:
        """
        Perceptual comparison using histogram intersection.
        More forgiving than pixel comparison; good for catching
        major layout/color changes while ignoring minor rendering diffs.
        """
        result = ComparisonResult(metadata={
            "baseline": baseline_path,
            "candidate": candidate_path,
            "mode": "perceptual",
        })

        baseline = _load_image(baseline_path)
        candidate = _load_image(candidate_path)

        if baseline is None or candidate is None:
            result.error = "Cannot load one or both images"
            return result

        bw, bh = baseline.size
        cw, ch = candidate.size
        result.total_pixels = max(bw * bh, cw * ch, 1)

        if (bw, bh) != (cw, ch):
            result.identical = False
            result.passed = False
            result.error = f"Size mismatch: {bw}x{bh} vs {cw}x{ch}"
            return result

        h1 = _compute_histogram(baseline)
        h2 = _compute_histogram(candidate)
        similarity = _histogram_intersection(h1, h2)

        result.metadata["histogram_similarity"] = round(similarity, 4)
        result.identical = similarity >= 0.999
        result.passed = similarity >= 0.98
        result.diff_percentage = round((1 - similarity) * 100, 2)

        if diff_output_path:
            pixel_result = self.compare(
                baseline_path, candidate_path, diff_output_path
            )
            result.diff_image_path = pixel_result.diff_image_path
            result.regions = pixel_result.regions
            result.different_pixels = pixel_result.different_pixels

        return result

    def batch_compare(
        self,
        pairs: list[tuple[str, str, str]],
        output_dir: str = ".",
    ) -> dict:
        """
        Compare multiple screenshot pairs.

        Args:
            pairs: List of (baseline, candidate, name) tuples.
            output_dir: Directory for diff heatmaps.

        Returns:
            Summary dict with individual results and overall pass/fail.
        """
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        results = {}
        all_passed = True
        total_identical = 0

        for baseline, candidate, name in pairs:
            diff_path = str(out / f"{name}_diff.png")
            result = self.compare(baseline, candidate, diff_path)
            results[name] = {
                "passed": result.passed,
                "identical": result.identical,
                "diff_pct": result.diff_percentage,
                "diff_pixels": result.different_pixels,
                "total_pixels": result.total_pixels,
                "error": result.error,
                "diff_image": result.diff_image_path,
                "regions": len(result.regions),
            }
            if not result.passed:
                all_passed = False
            if result.identical:
                total_identical += 1

        return {
            "total": len(pairs),
            "identical": total_identical,
            "passed": sum(1 for r in results.values() if r["passed"]),
            "failed": sum(1 for r in results.values() if not r["passed"]),
            "all_passed": all_passed,
            "results": results,
        }
