"""Validate every enumerated ranking/metrics artifact, not just a sample."""

import json
import sys
from pathlib import Path

from hip.publish import require_complete_list


def check(root: Path) -> int:
    manifest = json.loads((root / "manifest.json").read_text())
    checked = 0
    for artifact in manifest["artifacts"]:
        route = artifact["source"].partition("?")[0]
        if route == "/rankings" or (
            route.startswith("/regions/") and route.endswith("/metrics")
        ):
            require_complete_list(
                route, json.loads((root / artifact["path"]).read_bytes())
            )
            checked += 1
    return checked


if __name__ == "__main__":
    print(f"Complete lists: {check(Path(sys.argv[1]))}")
