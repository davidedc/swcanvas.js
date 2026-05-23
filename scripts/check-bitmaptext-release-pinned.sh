#!/usr/bin/env bash
#
# Compare the pinned BitmapText font-assets release tag against the latest
# release published on GitHub.
#
# The pin is stored in vendor/bitmaptext-release.pin (single source of truth);
# both scripts/download-bitmaptext-assets.sh and
# scripts/download-bitmaptext-smoke-fixture.sh read from that file at runtime,
# so cross-site drift is structurally impossible. This checker only has to
# compare local-pin vs releases/latest.
#
# Exit codes:
#   0 — pinned tag matches GitHub releases/latest
#   1 — drift detected, or the check could not be completed
#
# Usage:
#   ./scripts/check-bitmaptext-release-pinned.sh
#   ./scripts/check-bitmaptext-release-pinned.sh --help

set -euo pipefail

REPO_OWNER='davidedc'
REPO_NAME='BitmapText.js'
LATEST_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

SHOW_HELP=0
while [ $# -gt 0 ]; do
    case "$1" in
        --help|-h)  SHOW_HELP=1; shift ;;
        *)          echo "ERROR: unknown argument: $1" >&2; SHOW_HELP=1; shift ;;
    esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
    sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ----- 1. Local pin -----

PIN_FILE='vendor/bitmaptext-release.pin'
if [ ! -f "$PIN_FILE" ]; then
    echo "ERROR: pin file missing: $PIN_FILE" >&2
    exit 1
fi

LOCAL_TAG="$(tr -d ' \t\r\n' < "$PIN_FILE")"
if [ -z "$LOCAL_TAG" ]; then
    echo "ERROR: pin file is empty: $PIN_FILE" >&2
    exit 1
fi

echo "Local pin ($PIN_FILE): $LOCAL_TAG"

# ----- 2. GitHub releases/latest lookup -----

echo "Querying $LATEST_URL ..."

STAGING="$(mktemp -d -t bitmaptext-pin-check.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT
JSON_TMP="$STAGING/latest.json"

# GitHub API supports anonymous requests at 60/hr per IP — plenty for a
# manual checker. Respect GITHUB_TOKEN if set (raises the limit) but don't
# require it. The `${arr[@]+"${arr[@]}"}` idiom expands the array only when
# it has elements — survives `set -u` on macOS's bash 3.2.
CURL_AUTH=()
if [ -n "${GITHUB_TOKEN:-}" ]; then
    CURL_AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi

if ! curl --fail --location --silent --retry 2 \
        -H 'Accept: application/vnd.github+json' \
        ${CURL_AUTH[@]+"${CURL_AUTH[@]}"} \
        -o "$JSON_TMP" \
        "$LATEST_URL"; then
    echo "ERROR: failed to fetch $LATEST_URL" >&2
    echo "       Network down, rate-limited (anonymous: 60/hr), or repo has" >&2
    echo "       no release flagged 'Latest'. Re-run with GITHUB_TOKEN set to" >&2
    echo "       raise the rate limit." >&2
    exit 1
fi

LATEST_TAG="$(grep -m1 '"tag_name"' "$JSON_TMP" \
    | sed -E 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"

if [ -z "$LATEST_TAG" ]; then
    echo "ERROR: could not parse tag_name from GitHub response." >&2
    echo "       Response body left at: $JSON_TMP" >&2
    trap - EXIT
    exit 1
fi

echo "Latest release on GitHub:       $LATEST_TAG"
echo ""

# ----- 3. Compare and report -----

if [ "$LOCAL_TAG" = "$LATEST_TAG" ]; then
    echo "OK: local pin matches releases/latest."
    exit 0
fi

echo "DRIFT: local pin is behind (or diverges from) releases/latest."
echo ""
echo "  Local:  $LOCAL_TAG"
echo "  Latest: $LATEST_TAG"
echo ""
echo "To bump, edit $PIN_FILE and re-fetch the assets:"
echo "  ./scripts/download-bitmaptext-assets.sh --force"
echo "  ./scripts/download-bitmaptext-smoke-fixture.sh --force"
exit 1
