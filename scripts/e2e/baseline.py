"""
Baseline (Golden Screenshot) Management

Manages the lifecycle of reference screenshots used for visual regression testing:
  - Initialize baselines from current screenshots
  - Accept/reject candidate screenshots as new baselines
  - List, diff, and prune baselines
  - Support per-route and per-viewport baseline sets

Directory layout:
  <baseline_dir>/
    <suite_name>/
      <route_name>.png          - Golden screenshot
      <route_name>.meta.json    - Metadata (timestamp, viewport, hash)
"""

from __future__ import annotations

import json
import hashlib
import shutil
import time
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class BaselineMeta:
    """Metadata for a golden screenshot."""
    route: str = ""
    name: str = ""
    created_at: str = ""
    updated_at: str = ""
    viewport: str = "1920x1080"
    full_page: bool = True
    file_size: int = 0
    sha256: str = ""
    source_url: str = ""
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> BaselineMeta:
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class BaselineManager:
    """
    Manage golden/baseline screenshots for visual regression.

    Usage:
        mgr = BaselineManager("baselines/my_suite")
        mgr.init_baseline("home", "/home.png")       # Set golden
        mgr.accept_candidate("home", "candidate.png") # Promote to golden
        meta = mgr.get_meta("home")
        listing = mgr.list_baselines()
    """

    def __init__(self, base_dir: str = "baselines", suite_name: str = "default"):
        self.base_dir = Path(base_dir)
        self.suite_dir = self.base_dir / suite_name
        self.suite_name = suite_name

    def _meta_path(self, name: str) -> Path:
        return self.suite_dir / f"{name}.meta.json"

    def _image_path(self, name: str) -> Path:
        return self.suite_dir / f"{name}.png"

    def init(self):
        """Create the baseline directory structure."""
        self.suite_dir.mkdir(parents=True, exist_ok=True)
        (self.suite_dir / ".gitkeep").touch(exist_ok=True)

    def set_baseline(
        self,
        name: str,
        image_path: str,
        route: str = "",
        source_url: str = "",
        viewport: str = "1920x1080",
        full_page: bool = True,
        tags: Optional[list[str]] = None,
    ) -> BaselineMeta:
        """Set or update a golden baseline from an image file."""
        self.init()
        src = Path(image_path)
        if not src.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        dst = self._image_path(name)
        shutil.copy2(src, dst)

        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        existing_meta = self.get_meta(name)
        created = existing_meta.created_at if existing_meta else now

        meta = BaselineMeta(
            route=route or name,
            name=name,
            created_at=created,
            updated_at=now,
            viewport=viewport,
            full_page=full_page,
            file_size=dst.stat().st_size,
            sha256=_file_hash(dst),
            source_url=source_url,
            tags=tags or [],
        )

        with open(self._meta_path(name), "w") as f:
            json.dump(meta.to_dict(), f, indent=2)

        return meta

    def get_baseline_path(self, name: str) -> Optional[Path]:
        """Get path to golden image, or None if not found."""
        p = self._image_path(name)
        return p if p.exists() else None

    def get_meta(self, name: str) -> Optional[BaselineMeta]:
        """Get metadata for a baseline."""
        mp = self._meta_path(name)
        if mp.exists():
            try:
                with open(mp) as f:
                    return BaselineMeta.from_dict(json.load(f))
            except Exception:
                pass
        return None

    def has_baseline(self, name: str) -> bool:
        return self._image_path(name).exists()

    def accept_candidate(
        self,
        name: str,
        candidate_path: str,
        **kwargs,
    ) -> BaselineMeta:
        """Promote a candidate screenshot to become the new golden baseline."""
        old_meta = self.get_meta(name)
        if old_meta:
            old_img = self._image_path(name)
            backup_dir = self.suite_dir / "_archived"
            backup_dir.mkdir(exist_ok=True)
            ts = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
            shutil.move(str(old_img), str(backup_dir / f"{name}_{ts}.png"))
            if self._meta_path(name).exists():
                shutil.move(
                    str(self._meta_path(name)),
                    str(backup_dir / f"{name}_{ts}.meta.json"),
                )
        return self.set_baseline(name, candidate_path, **kwargs)

    def delete_baseline(self, name: str) -> bool:
        """Remove a baseline."""
        removed = False
        img = self._image_path(name)
        if img.exists():
            img.unlink()
            removed = True
        meta = self._meta_path(name)
        if meta.exists():
            meta.unlink()
            removed = True
        return removed

    def list_baselines(self) -> list[dict]:
        """List all baselines with their metadata."""
        results = []
        if not self.suite_dir.exists():
            return results
        for img_file in sorted(self.suite_dir.glob("*.png")):
            name = img_file.stem
            meta = self.get_meta(name)
            results.append({
                "name": name,
                "route": meta.route if meta else name,
                "file_size": img_file.stat().st_size,
                "sha256": meta.sha256 if meta else "",
                "updated_at": meta.updated_at if meta else "",
                "viewport": meta.viewport if meta else "",
                "tags": meta.tags if meta else [],
            })
        return results

    def export_manifest(self, output_path: str) -> dict:
        """Export all baseline metadata as a JSON manifest."""
        baselines = self.list_baselines()
        manifest = {
            "suite": self.suite_name,
            "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total": len(baselines),
            "baselines": baselines,
        }
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(manifest, f, indent=2)
        return manifest

    def get_all_pairs(
        self,
        candidate_dir: str,
    ) -> list[tuple[str, str, str]]:
        """
        Get (baseline_path, candidate_path, name) pairs for all baselines
        that have matching candidates.
        """
        cand = Path(candidate_dir)
        pairs = []
        for meta_info in self.list_baselines():
            name = meta_info["name"]
            bl_path = str(self._image_path(name))
            ca_path = str(cand / f"{name}.png")
            if Path(ca_path).exists():
                pairs.append((bl_path, ca_path, name))
        return pairs
