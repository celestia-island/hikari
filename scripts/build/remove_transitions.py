#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Remove CSS transitions and animations from SCSS files.

This script comments out all transition and animation declarations
to prepare for migration to JS animation library.
"""

import os
import re
from pathlib import Path


def process_scss_file(file_path: Path) -> int:
    """Process a single SCSS file and comment out transitions/animations."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changes = 0

    # Pattern 1: transition: ...;
    # Match both single-line and multi-line
    transition_pattern = r'(\s*)(transition:[^;]+;)'
    replacement = r'\1// DISABLED - migrated to JS animation\n\1// \2'
    new_content = re.sub(transition_pattern, replacement, content, flags=re.MULTILINE)

    if new_content != content:
        changes += content.count('transition:')
        content = new_content

    # Pattern 2: animation: ...;
    animation_pattern = r'(\s*)(animation:[^;]+;)'
    replacement = r'\1// DISABLED - migrated to JS animation\n\1// \2'
    new_content = re.sub(animation_pattern, replacement, content, flags=re.MULTILINE)

    if new_content != content:
        changes += content.count('animation:')
        content = new_content

    # Pattern 3: @keyframes
    keyframes_pattern = r'(@keyframes\s+[\w-]+\s*\{[^}]+\})'
    replacement = r'// DISABLED - migrated to JS animation\n// \1'
    new_content = re.sub(keyframes_pattern, replacement, content, flags=re.DOTALL)

    if new_content != content:
        # Count keyframes (approximate)
        changes += len(re.findall(r'@keyframes', original_content))
        content = new_content

    if changes > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[OK] Processed {file_path}: {changes} changes")

    return changes


def main():
    """Main entry point."""
    # Find all SCSS files in components package
    components_dir = Path("packages/components/src/styles/components")

    if not components_dir.exists():
        print(f"[ERROR] Directory not found: {components_dir}")
        return 1

    total_changes = 0
    scss_files = list(components_dir.glob("*.scss"))

    print(f"Found {len(scss_files)} SCSS files")
    print("=" * 60)

    for scss_file in scss_files:
        # Skip button.scss (already manually processed)
        if scss_file.name == "button.scss":
            print(f"[SKIP] {scss_file.name} (already processed)")
            continue

        changes = process_scss_file(scss_file)
        total_changes += changes

    print("=" * 60)
    print(f"[OK] Total changes: {total_changes}")
    return 0


if __name__ == "__main__":
    exit(main())
