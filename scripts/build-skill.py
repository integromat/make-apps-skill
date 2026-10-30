#!/usr/bin/env python3
"""Package the canonical skill with Python's standard library, without network access."""
import argparse
from io import BytesIO
from pathlib import Path
import re
import stat
import sys
import zipfile


NOTICE = b"""Make custom-app authoring skill

Includes material from https://github.com/integromat/make-skills
Pull request 70, commit 3dcad8e96a6e040e7eeaf344c16efec25685b5e8.
Copyright (c) 2026 Make. Licensed under the MIT License; see LICENSE.
The dedicated repository records subsequent adaptations in provenance/.

Offline static/unit/packaging checks are not Make or provider validation.
"""


ALLOWED_SUFFIXES = {'.md', '.txt', '.json', '.imljson', '.js', '.mjs', '.cjs', '.ts', '.py', '.sh',
                    '.yml', '.yaml', '.png', '.jpg', '.jpeg', '.svg', '.webp'}
PRIVATE_NAMES = {'node_modules', '__pycache__', 'runtime', 'private', 'evidence', 'raw_data',
                 'cache', 'dist', 'build', 'coverage', 'tmp', 'temp', 'venv',
                 'credentials', 'credential', 'secrets', 'token', 'id_rsa'}
WINDOWS_RESERVED = re.compile(r'^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$', re.I)
# Leak tripwires, not an exhaustive credential audit. Never print matched values.
CREDENTIAL_MATERIAL = re.compile(
    rb'-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b'
)
CREDENTIAL_LITERAL = re.compile(
    rb'''\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)["']?\s*[:=]\s*["']([A-Za-z0-9_./+=-]{16,})["']''', re.I
)
PLACEHOLDER = re.compile(rb'(?:REPLACE_WITH_|YOUR_)[A-Z0-9_]+')


def safe_name(path):
    for part in path.parts:
        if (not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', part)
                or part.endswith('.') or part.lower().split('.')[0] in PRIVATE_NAMES
                or WINDOWS_RESERVED.fullmatch(part.split('.')[0])):
            raise ValueError(f'Unsafe inclusion path: {path}')


def require_directory(path):
    if not stat.S_ISDIR(path.lstat().st_mode):
        raise ValueError(f'Expected regular directory, not a symlink/special file: {path.name}')


def read_regular(path):
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError(f'Expected regular file, not a symlink/special file: {path.name}')
    return path.read_bytes()


def source_files(directory, skill):
    for path in sorted(directory.iterdir()):
        relative = path.relative_to(skill)
        safe_name(relative)
        mode = path.lstat().st_mode
        if stat.S_ISDIR(mode):
            yield from source_files(path, skill)
        elif stat.S_ISREG(mode):
            if path.suffix.lower() not in ALLOWED_SUFFIXES:
                raise ValueError(f'Unsafe inclusion type: {relative}')
            data = read_regular(path)
            literals = CREDENTIAL_LITERAL.finditer(data)
            if CREDENTIAL_MATERIAL.search(data) or any(not PLACEHOLDER.fullmatch(m[1]) for m in literals):
                raise ValueError(f'Possible credential material in {relative}; review before packaging')
            yield 'make-custom-apps/' + relative.as_posix(), data
        else:
            raise ValueError(f'Expected regular file/directory, not a symlink/special file: {relative}')


def archive_bytes(root):
    skill = root / 'skills' / 'make-custom-apps'
    require_directory(root / 'skills')
    require_directory(skill)
    entries = dict(source_files(skill, skill))
    if 'make-custom-apps/SKILL.md' not in entries:
        raise ValueError('Missing SKILL.md entry point')
    entries['make-custom-apps/LICENSE'] = read_regular(root / 'LICENSE')
    entries['make-custom-apps/NOTICE'] = NOTICE
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        # Stored entries avoid zlib-version drift across Python/OS installations.
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, data)
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, help='Default: ROOT/dist/make-custom-apps.zip')
    parser.add_argument('--check', action='store_true', help='Verify the existing archive without writing it')
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output or root / 'dist' / 'make-custom-apps.zip'
    output = output.absolute()
    if (output.suffix.lower() != '.zip'
            or (output.exists() and not stat.S_ISREG(output.lstat().st_mode))
            or any(path.is_symlink() for path in [output, *output.parents])
            or output.resolve().is_relative_to(root / 'skills')):
        raise ValueError('Unsafe output: use a .zip outside the canonical skill with no symlink ancestors')
    data = archive_bytes(root)
    if args.check:
        if output.read_bytes() != data:
            raise ValueError('Archive drift: rebuild from the current canonical skill')
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    action = 'Verified' if args.check else 'Built'
    print(f'{action} {output}. Offline packaging only; no Make/provider runtime validation.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        print(f'Skill package failed: {error}', file=sys.stderr)
        sys.exit(1)
