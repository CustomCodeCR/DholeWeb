#!/usr/bin/env python3
"""Require Web release metadata to match the System release on the target branch."""
import json
import os
import re
import sys
from pathlib import Path
from base64 import b64decode
from time import time_ns
from urllib.parse import quote
from urllib.request import Request, urlopen


def main():
    branch = os.environ.get("DH_SYSTEM_BRANCH", "develop").strip()
    if branch not in {"develop", "master"}:
        raise ValueError(f"Unsupported DholeSystem release branch: {branch}")
    local_release = json.loads(Path("version.json").read_text(encoding="utf-8"))
    version = local_release["version"]
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
        # A PR may validate a versioned candidate in another repository before
        # that repository is merged. Never exempt master pushes or post-merge
        # checks, which still require exact DholeSystem/master parity.
        release_id = local_release.get("releaseId", "")
        head = os.environ.get("GITHUB_HEAD_REF", "").strip()
        if (branch == "master"
                and os.environ.get("GITHUB_EVENT_NAME") == "pull_request"
                and re.fullmatch(r"DH-[0-9]{8}-[A-Z0-9-]+", release_id)):
            refs = [f"release/{release_id}-master"]
            if head.startswith(("backport/", "release/", "fix/")):
                refs.insert(0, head)
            for candidate_branch in refs:
                def candidate_file(path):
                    api_url = ("https://api.github.com/repos/CustomCodeCR/DholeSystem/"
                               f"contents/{path}?ref={quote(candidate_branch, safe='')}")
                    with urlopen(Request(api_url, headers={
                        "Accept": "application/vnd.github+json",
                        "User-Agent": "Dhole-Version-Gate",
                    }), timeout=20) as response:
                        payload = json.load(response)
                    return json.loads(b64decode(payload["content"]).decode("utf-8"))

                try:
                    candidate = candidate_file("version.json")
                    manifest = candidate_file("release-manifest.json")
                except (OSError, ValueError, KeyError):
                    continue
                versions = {c["component"]: c["version"] for c in manifest.get("components", [])}
                if (candidate.get("releaseId") == release_id
                        and manifest.get("releaseId") == release_id
                        and manifest.get("ecosystemVersion") == version
                        and candidate_branch in manifest.get("branches", {}).values()
                        and versions.get("DholeWeb") == version
                        and versions.get("DholeSystem") == version
                        and manifest.get("productionDeploymentAuthorized") is False
                        and version == pkg == candidate.get("version") == candidate.get("ecosystemVersion")):
                    print(f"PASS Web/System shared release version {version} (coordinated {candidate_branch})")
                    return
        raise ValueError(f"Web {version} (package {pkg}) does not match DholeSystem/{branch} {system['version']}")
    print(f"PASS Web/System shared release version {version} ({branch})")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"FAIL Dhole Web/System version sync: {error}", file=sys.stderr)
        sys.exit(1)
