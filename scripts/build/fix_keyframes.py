#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix SCSS keyframes blocks that were incorrectly commented.
"""

import os
import re
from pathlib import Path


def fix_keyframes_in_file(file_path: Path) -> int:
    """Fix keyframes blocks in a single SCSS file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changes = 0

    # Pattern to find keyframes blocks that start with // but have uncommented content
    # Matches: // @keyframes name { ... } with possible nesting
    pattern = r'(// @keyframes\s+[\w-]+\s*\{)([^}]*\{[^}]*\})*([^}]*\})'

    def replace_keyframes(match):
        block = match.group(0)
        # Count braces to find the end of the keyframes block
        start_comment = match.group(1)
        rest = block[len(start_comment):]

        # Properly comment out the entire block
        lines = block.split('\n')
        commented_lines = []
        for line in lines:
            if not line.strip().startswith('//'):
                commented_lines.append('// ' + line)
            else:
                commented_lines.append(line)

        return '\n'.join(commented_lines)

    # Simple approach: find all // @keyframes and fix the entire block
    lines = content.split('\n')
    i = 0
    new_lines = []
    in_keyframes = False
    keyframes_indent = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line starts a keyframes block
        if re.match(r'^\s*//\s*@keyframes', line):
            in_keyframes = True
            # The line is already commented, keep it
            new_lines.append(line)
            # Also comment all lines until we find the closing brace
            i += 1
            brace_count = 0
            while i < len(lines):
                inner_line = lines[i]
                brace_count += inner_line.count('{')
                brace_count -= inner_line.count('}')

                if not inner_line.strip().startswith('//'):
                    new_lines.append('// ' + inner_line)
                else:
                    new_lines.append(inner_line)

                if brace_count <= 0 and '}' in inner_line:
                    i += 1
                    break
                i += 1
            continue

        new_lines.append(line)
        i += 1

    new_content = '\n'.join(new_lines)

    if new_content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        changes = 1
        print(f"[OK] Fixed {file_path}")

    return changes


def main():
    """Main entry point."""
    components_dir = Path("packages/components/src/styles/components")

    if not components_dir.exists():
        print(f"[ERROR] Directory not found: {components_dir}")
        return 1

    scss_files = list(components_dir.glob("*.scss"))
    total_changes = 0

    print(f"Found {len(scss_files)} SCSS files")
    print("=" * 60)

    for scss_file in scss_files:
        changes = fix_keyframes_in_file(scss_file)
        total_changes += changes

    print("=" * 60)
    print(f"[OK] Total files fixed: {total_changes}")
    return 0


if __name__ == "__main__":
    exit(main())
