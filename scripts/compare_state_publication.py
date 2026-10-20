"""Raw before/after tree diff, with separate (not byte-identity) HTML text checks."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class MainText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.main = 0
        self.skip = 0
        self.words: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "main":
            self.main += 1
        if tag in {"script", "style"}:
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "main":
            self.main -= 1
        if tag in {"script", "style"}:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if self.main and not self.skip:
            self.words.append(data)


def main_text(file: Path) -> str:
    parser = MainText()
    parser.feed(file.read_text())
    return " ".join(" ".join(parser.words).split())


def hashes(root: Path) -> dict[str, str]:
    result = {}
    for file in sorted(root.rglob("*")):
        if file.is_file():
            with file.open("rb") as handle:
                result[file.relative_to(root).as_posix()] = hashlib.file_digest(
                    handle, "sha256"
                ).hexdigest()
    return result


def compare(before: Path, after: Path) -> dict[str, object]:
    old, new = hashes(before), hashes(after)
    common = old.keys() & new.keys()
    changed = sorted(key for key in common if old[key] != new[key])
    text_changed = [
        key
        for key in changed
        if key.startswith("site/")
        and key.endswith(".html")
        and main_text(before / key) != main_text(after / key)
    ]
    counts = Counter(
        "artifacts"
        if key.startswith("artifacts/")
        else "site HTML"
        if key.endswith(".html")
        else "site RSC"
        if key.endswith(".txt")
        else "site other"
        for key in changed
    )
    return {
        "before": str(before),
        "after": str(after),
        "before_files": len(old),
        "after_files": len(new),
        "byte_identical": len(common) - len(changed),
        "changed_counts": dict(counts),
        "added": sorted(new.keys() - old.keys()),
        "removed": sorted(old.keys() - new.keys()),
        "changed": changed,
        "html_main_text_changed": text_changed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = compare(args.before, args.after)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "changed"}, indent=2))
