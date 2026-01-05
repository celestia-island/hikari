#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert Tailwind CSS class names to Hikari utility classes

This script converts Tailwind class names to Hikari's `hi-` prefixed utility classes.
It handles the most common Tailwind classes used in the demo app.
"""

import re
import sys
from pathlib import Path

# Tailwind to Hikari class name mapping
CLASS_MAPPING = {
    # Layout
    'flex': 'hi-flex',
    'inline-flex': 'hi-inline-flex',
    'grid': 'hi-grid',
    'block': 'hi-block',
    'hidden': 'hi-hidden',
    'inline-block': 'hi-inline-block',

    # Flexbox
    'flex-row': 'hi-flex-row',
    'flex-col': 'hi-flex-col',
    'flex-wrap': 'hi-flex-wrap',
    'flex-1': 'hi-flex-1',
    'items-start': 'hi-items-start',
    'items-end': 'hi-items-end',
    'items-center': 'hi-items-center',
    'justify-between': 'hi-justify-between',
    'justify-center': 'hi-justify-center',
    'justify-start': 'hi-justify-start',
    'justify-end': 'hi-justify-end',

    # Spacing - Padding
    'p-2': 'hi-p-2',
    'p-4': 'hi-p-4',
    'p-5': 'hi-p-5',
    'p-6': 'hi-p-6',
    'p-10': 'hi-p-10',
    'px-2': 'hi-px-2',
    'px-4': 'hi-px-4',
    'py-2': 'hi-py-2',

    # Spacing - Margin
    'mb-2': 'hi-mb-2',  # Add to utility.rs if needed
    'mb-4': 'hi-mb-4',  # Add to utility.rs if needed
    'mb-5': 'hi-mb-5',  # Add to utility.rs if needed
    'mb-16': 'hi-mb-16',  # Add to utility.rs if needed
    'ml-0': 'hi-ml-0',  # Add to utility.rs if needed
    'mr-2': 'hi-mr-2',  # Add to utility.rs if needed
    'mr-4': 'hi-mr-4',  # Add to utility.rs if needed
    'm-0': 'hi-m-0',  # Add to utility.rs if needed
    r'mb-2\.5': 'hi-mb-2-5',  # Special case (use raw string)
    'tracking-wider': 'hi-tracking-wider',  # Add to utility.rs if needed
    'uppercase': 'hi-uppercase',  # Add to utility.rs if needed

    # Sizing
    'w-6': 'hi-w-6',
    'w-64': 'hi-w-64',
    'w-full': 'hi-w-full',
    'w-auto': 'hi-w-auto',
    'w-2xl': 'hi-w-2xl',  # Add to utility.rs if needed
    'w-3xl': 'hi-w-3xl',  # Add to utility.rs if needed
    'h-6': 'hi-h-6',
    'h-screen': 'hi-h-screen',
    'h-full': 'hi-h-full',
    'max-w-2xl': 'hi-max-w-2xl',  # Add to utility.rs if needed
    'max-w-3xl': 'hi-max-w-3xl',  # Add to utility.rs if needed
    'max-w-4xl': 'hi-max-w-4xl',  # Add to utility.rs if needed

    # Position
    'fixed': 'hi-fixed',
    'static': 'hi-static',
    'absolute': 'hi-absolute',
    'relative': 'hi-relative',
    'inset-0': 'hi-inset-0',
    'inset-y-0': 'hi-inset-y-0',
    'left-0': 'hi-left-0',
    'top-0': 'hi-top-0',

    # Z-index
    'z-10': 'hi-z-10',
    'z-20': 'hi-z-20',
    'z-30': 'hi-z-30',
    'z-40': 'hi-z-40',
    'z-50': 'hi-z-50',

    # Colors - Background
    'bg-white': 'hi-bg-white',
    'bg-black': 'hi-bg-black',
    'bg-transparent': 'hi-bg-transparent',
    'bg-gray-50': 'hi-bg-gray-50',
    'bg-gray-100': 'hi-bg-gray-100',
    'bg-gray-200': 'hi-bg-gray-200',
    'bg-gray-300': 'hi-bg-gray-300',
    'bg-[#1a1a2e]': 'hi-bg-dark-theme',
    'bg-[#16213e]': 'hi-bg-dark-theme-light',
    'bg-[#f5f5f5]': 'hi-bg-light-theme',

    # Colors - Text
    'text-white': 'hi-text-white',
    'text-black': 'hi-text-black',
    'text-gray-400': 'hi-text-gray-400',  # Add to utility.rs if needed
    'text-gray-500': 'hi-text-gray-500',
    'text-gray-600': 'hi-text-gray-600',  # Add to utility.rs if needed
    'text-gray-700': 'hi-text-gray-700',
    'text-gray-800': 'hi-text-gray-800',  # Add to utility.rs if needed
    'text-gray-900': 'hi-text-gray-900',
    'text-[#4a9eff]': 'hi-text-primary-light',
    'text-[#1a1a2e]': 'hi-text-dark-theme',  # Add to utility.rs if needed
    'text-[#4a9eff]': 'hi-text-primary-light',
    'text-blue-800': 'hi-text-blue-800',  # Add to utility.rs if needed

    # Opacity variants
    'bg-white/10': 'hi-bg-white/10',
    'bg-white/20': 'hi-bg-white/20',
    'bg-black/50': 'hi-bg-black/50',
    'bg-black/30': 'hi-bg-black/30',

    # Typography
    'text-xs': 'hi-text-xs',
    'text-sm': 'hi-text-sm',
    'text-base': 'hi-text-base',
    'text-lg': 'hi-text-lg',
    'text-xl': 'hi-text-xl',
    'text-2xl': 'hi-text-2xl',
    'text-3xl': 'hi-text-3xl',
    'text-4xl': 'hi-text-4xl',
    'font-medium': 'hi-font-medium',
    'font-semibold': 'hi-font-semibold',
    'font-bold': 'hi-font-bold',
    'font-sans': 'hi-font-sans',  # Add to utility.rs if needed

    # Border
    'rounded': 'hi-rounded',
    'rounded-lg': 'hi-rounded-lg',
    'rounded-xl': 'hi-rounded-xl',
    'border': 'hi-border',
    'border-b': 'hi-border-b',
    'border-gray-200': 'hi-border-gray-200',
    'border-gray-300': 'hi-border-gray-300',

    # Transitions
    'transition-all': 'hi-transition-all',
    'transition-colors': 'hi-transition-colors',
    'transition-transform': 'hi-transition-transform',
    'duration-150': 'hi-duration-150',
    'duration-300': 'hi-duration-300',
    'duration-500': 'hi-duration-500',
    'ease-in-out': 'hi-ease-in-out',

    # Transform
    'translate-x-0': 'hi-translate-x-0',
    '-translate-x-full': 'hi--translate-x-full',
    'translate-x-full': 'hi-translate-x-full',

    # Overflow
    'overflow-hidden': 'hi-overflow-hidden',
    'overflow-y-auto': 'hi-overflow-y-auto',
    'overflow-auto': 'hi-overflow-auto',

    # Cursor
    'cursor-pointer': 'hi-cursor-pointer',

    # User select
    'select-none': 'hi-select-none',

    # Object fit
    'object-cover': 'hi-object-cover',

    # Line height
    'leading-relaxed': 'hi-leading-relaxed',  # Add to utility.rs if needed

    # Self alignment
    'self-end': 'hi-self-end',

    # Responsive (lg:)
    'lg:block': 'hi-lg:block',
    'lg:flex': 'hi-lg:flex',
    'lg:hidden': 'hi-lg:hidden',
    'lg:static': 'hi-lg:static',
    'lg:fixed': 'hi-lg:fixed',
    'lg:ml-0': 'hi-lg:ml-0',
    'lg:w-auto': 'hi-lg:w-auto',
    'lg:translate-x-0': 'hi-lg:translate-x-0',
    'lg:p-10': 'hi-lg:p-10',

    # Hover states (keep colon for now, we'll handle them separately)
    'hover:bg-white/10': 'hi-hover:bg-white/10',
    'hover:bg-gray-100': 'hi-hover:bg-gray-100',
    'hover:bg-gray-200': 'hi-hover:bg-gray-200',
    'hover:text-primary': 'hi-hover:text-primary',
    'hover:underline': 'hi-hover:underline',

    # Focus states
    'focus:outline-none': 'hi-focus:outline-none',
    'focus:ring-2': 'hi-focus:ring-2',

    # Gap
    'gap-2': 'hi-gap-2',
}

# Classes that need to be added to utility.rs
MISSING_CLASSES = {
    'mb-2': 'margin-bottom: 0.5rem',
    'mb-4': 'margin-bottom: 1rem',
    'mb-5': 'margin-bottom: 1.25rem',
    'mb-16': 'margin-bottom: 4rem',
    'mb-2.5': 'margin-bottom: 0.625rem',
    'ml-0': 'margin-left: 0',
    'mr-2': 'margin-right: 0.5rem',
    'mr-4': 'margin-right: 1rem',
    'm-0': 'margin: 0',
    'font-sans': 'font-family: system-ui, -apple-system, sans-serif',
    'w-2xl': 'width: 42rem',  # 672px
    'w-3xl': 'width: 48rem',  # 768px
    'max-w-2xl': 'max-width: 42rem',
    'max-w-3xl': 'max-width: 48rem',
    'max-w-4xl': 'max-width: 56rem',
    'text-gray-400': 'color: #9ca3af',
    'text-gray-600': 'color: #4b5563',
    'text-gray-800': 'color: #1f2937',
    'text-dark-theme': 'color: #1a1a2e',
    'text-blue-800': 'color: #1e40af',
    'leading-relaxed': 'line-height: 1.625',
}


def convert_class_name(class_name: str) -> str:
    """Convert a single Tailwind class name to Hikari class name"""
    # Handle responsive prefixes
    if class_name.startswith('lg:'):
        base_class = class_name[3:]
        if base_class in CLASS_MAPPING:
            return f'lg:{CLASS_MAPPING[base_class][3:]}'  # Remove hi- prefix from base
        return class_name

    # Handle hover/focus prefixes
    if class_name.startswith('hover:') or class_name.startswith('focus:'):
        if class_name in CLASS_MAPPING:
            return CLASS_MAPPING[class_name]
        return class_name

    # Direct mapping
    if class_name in CLASS_MAPPING:
        return CLASS_MAPPING[class_name]

    # No mapping found, return original
    return class_name


def convert_class_string(class_string: str) -> str:
    """Convert a class string with multiple classes"""
    # Handle both static strings and format! macros
    if '"{}"' in class_string or '{' in class_string:
        # Format string - preserve the structure
        return class_string

    classes = class_string.strip().split()
    converted = []

    for cls in classes:
        converted_cls = convert_class_name(cls)
        converted.append(converted_cls)

    return ' '.join(converted)


def process_file(file_path: Path) -> tuple[int, int]:
    """Process a single file and convert class names"""
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  [X] Failed to read {file_path}: {e}")
        return 0, 0

    original_content = content
    conversions = 0

    # Find all class attributes with string literals
    # Pattern 1: class: "..."
    pattern1 = r'class:\s*"([^"]*)"'

    def replace_class_string(match):
        nonlocal conversions
        class_string = match.group(1)
        converted = convert_class_string(class_string)
        if converted != class_string:
            conversions += 1
        return f'class: "{converted}"'

    content = re.sub(pattern1, replace_class_string, content)

    # Pattern 2: class: format!(...)
    # This is more complex, skip for now

    if content != original_content:
        try:
            file_path.write_text(content, encoding='utf-8')
            return 1, conversions
        except Exception as e:
            print(f"  [X] Failed to write {file_path}: {e}")
            return 0, 0

    return 0, 0


def main():
    """Main conversion workflow"""
    print("=" * 60)
    print("Tailwind to Hikari Class Converter")
    print("=" * 60)

    # Get target directory
    if len(sys.argv) < 2:
        print("Usage: python convert_tailwind_to_hikari.py <target_directory>")
        print("Example: python convert_tailwind_to_hikari.py examples/demo-app/src")
        sys.exit(1)

    target_dir = Path(sys.argv[1])

    if not target_dir.exists():
        print(f"[X] Directory not found: {target_dir}")
        sys.exit(1)

    # Find all Rust files
    rust_files = list(target_dir.rglob("*.rs"))

    if not rust_files:
        print(f"[X] No .rs files found in {target_dir}")
        sys.exit(1)

    print(f"\nFound {len(rust_files)} Rust files")
    print("\nConverting class names...\n")

    files_modified = 0
    total_conversions = 0

    for file_path in rust_files:
        modified, conversions = process_file(file_path)
        if modified:
            files_modified += 1
            total_conversions += conversions
            print(f"  [OK] {file_path.relative_to(target_dir)}: {conversions} conversions")

    print("\n" + "=" * 60)
    print(f"SUMMARY:")
    print(f"  Files processed: {len(rust_files)}")
    print(f"  Files modified: {files_modified}")
    print(f"  Total conversions: {total_conversions}")
    print("=" * 60)

    # Check for missing utility classes
    used_missing = set()
    for file_path in rust_files:
        try:
            content = file_path.read_text(encoding='utf-8')
            for missing_class in MISSING_CLASSES.keys():
                if f'"{missing_class}"' in content or f"'{missing_class}'" in content:
                    used_missing.add(missing_class)
        except:
            pass

    if used_missing:
        print("\n[WARNING]  Warning: The following classes need to be added to utility.rs:")
        for cls in sorted(used_missing):
            print(f"    .hi-{cls} {{ {MISSING_CLASSES[cls]} !important; }}")


if __name__ == "__main__":
    main()
