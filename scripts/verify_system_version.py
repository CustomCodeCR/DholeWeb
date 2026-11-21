#!/usr/bin/env python3
"""Require matching DholeSystem version on target or same-release PR candidate."""
import json
import os
import sys
from pathlib import Path
from base64 import b64decode
from time import time_ns
from urllib.parse import quote
from urllib.request import Request, urlopen


def contents_json(path: str, ref: str) -> dict:
    encoded = quote(ref, safe="")
    api_url = f"https://api.github.com/repos/CustomCodeCR/DholeSystem/contents/{path}?ref={encoded}"
    headers = {
        "Accept": "application/vnd.github+json",
        "Cache-Control": "no-cache",
        "User-Agent": "Dhole-Version-Gate",
    }
    # Authenticate only when CI provides the read-only ephemeral GITHUB_TOKEN.
    # The unauthenticated 60 requests/hour GitHub limit is not a version mismatch.
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with urlopen(Request(api_url, headers=headers), timeout=20) as response:
        payload = json.load(response)
    return json.loads(b64decode(payload["content"]).decode("utf-8"))


def main():
    branch = os.environ.get("DH_SYSTEM_BRANCH", "develop").strip()
    if branch not in {"develop", "master"}:
        raise ValueError(f"Unsupported DholeSystem release branch: {branch}")

    metadata = json.loads(Path("version.json").read_text(encoding="utf-8"))
    version = metadata["version"]
    pkg = json.loads(Path("package.json").read_text(encoding="utf-8"))["version"]
    if version != pkg:
        raise ValueError(f"Web version metadata {version} != package {pkg}")

    if os.environ.get("GITHUB_TOKEN", "").strip():
        # Use the authenticated API consistently for both target and candidate.
        system = contents_json("version.json", branch)
    else:
        url = (f"https://raw.githubusercontent.com/CustomCodeCR/DholeSystem/"
               f"{branch}/version.json?release_check={time_ns()}")
        with urlopen(Request(url, headers={
            "Accept": "application/json", "Cache-Control": "no-cache",
            "User-Agent": "Dhole-Version-Gate",
        }), timeout=20) as response:
            system = json.load(response)
        if not (version == system["version"] == system["ecosystemVersion"]):
            system = contents_json("version.json", branch)

    if version == system["version"] == system["ecosystemVersion"]:
        print(f"PASS Web/System shared release version {version} ({branch})")
        return

    # A coordinated Web/System release cannot update two repos atomically.
    # While validating a PR into develop, require matching System candidate branch,
    # release ID, and CENTRAL manifest. This is not a production/master bypass.
    candidate = os.environ.get("GITHUB_HEAD_REF", "").strip()
    is_pr = os.environ.get("GITHUB_EVENT_NAME") == "pull_request"
    if branch == "develop" and is_pr and candidate.startswith(("fix/", "feature/")):
        system = contents_json("version.json", candidate)
        manifest = contents_json("release-manifest.json", candidate)
        versions = {c["component"]: c["version"] for c in manifest["components"]}
        if (system["version"] == version
                and system["ecosystemVersion"] == version
                and system["releaseId"] == metadata["releaseId"]
                and manifest["ecosystemVersion"] == version
                and manifest["releaseId"] == metadata["releaseId"]
                and manifest.get("productionDeploymentAuthorized") is False
                and versions.get("DholeWeb") == version
                and versions.get("DholeSystem") == version
                and candidate in manifest.get("branches", {}).values()):
            print(f"PASS Web/System coordinated PR candidate {version} ({candidate}); "
                  "develop still requires integration before deployment")
            return
        raise ValueError("DholeSystem candidate, component versions and central "
                         "release manifest do not match this Web release")

    raise ValueError(
        f"Web {version} (package {pkg}) does not match DholeSystem/{branch} "
        f"{system['version']} and no verified coordinated PR candidate is allowed")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f"FAIL Dhole Web/System version sync: {error}", file=sys.stderr)
        sys.exit(1)
