#!/usr/bin/env python3
"""Require Web release metadata to match the System release on the target branch."""
import json
import os
import sys
from pathlib import Path
from base64 import b64decode
from time import time_ns
from urllib.request import Request, urlopen


def main():
    branch = os.environ.get("DH_SYSTEM_BRANCH", "develop").strip()
    if branch not in {"develop", "master"}:
        raise ValueError(f"Unsupported DholeSystem release branch: {branch}")
    version = json.loads(Path("version.json").read_text(encoding="utf-8"))["version"]
    pkg = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    # Bust GitHub's raw-file CDN cache after a coordinated System/Web merge.
    url = f"https://raw.githubusercontent.com/CustomCodeCR/DholeSystem/{branch}/version.json?release_check={time_ns()}"
    with urlopen(Request(url, headers={"Accept": "application/json", "Cache-Control": "no-cache", "User-Agent": "Dhole-Version-Gate"}), timeout=20) as response:
        system = json.load(response)
    # Raw CDN can lag a just-merged System release even with query cache busting.
    # On mismatch, confirm the actual branch file through GitHub's Contents API.
    if not (version == pkg == system["version"] == system["ecosystemVersion"]):
        api_url = f"https://api.github.com/repos/CustomCodeCR/DholeSystem/contents/version.json?ref={branch}"
        with urlopen(Request(api_url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Dhole-Version-Gate"}), timeout=20) as response:
            payload = json.load(response)
        system = json.loads(b64decode(payload["content"]).decode("utf-8"))
    if not (version == pkg == system["version"] == system["ecosystemVersion"]):
        raise ValueError(f"Web {version} (package {pkg}) does not match DholeSystem/{branch} {system['version']}")
    print(f"PASS Web/System shared release version {version} ({branch})")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"FAIL Dhole Web/System version sync: {error}", file=sys.stderr)
        sys.exit(1)
