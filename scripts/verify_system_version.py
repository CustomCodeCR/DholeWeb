#!/usr/bin/env python3
"""Require Web release metadata to match the System release on the target branch."""
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen


def main():
    branch = os.environ.get("DH_SYSTEM_BRANCH", "develop").strip()
    if branch not in {"develop", "master"}:
        raise ValueError(f"Unsupported DholeSystem release branch: {branch}")
    version = json.loads(Path("version.json").read_text(encoding="utf-8"))["version"]
    pkg = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    url = f"https://raw.githubusercontent.com/CustomCodeCR/DholeSystem/{branch}/version.json"
    with urlopen(Request(url, headers={"Accept": "application/json", "Cache-Control": "no-cache", "User-Agent": "Dhole-Version-Gate"}), timeout=20) as response:
        system = json.load(response)
    if not (version == pkg == system["version"] == system["ecosystemVersion"]):
        raise ValueError(f"Web {version} (package {pkg}) does not match DholeSystem/{branch} {system['version']}")
    print(f"PASS Web/System shared release version {version} ({branch})")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"FAIL Dhole Web/System version sync: {error}", file=sys.stderr)
        sys.exit(1)
