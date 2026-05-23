#!/usr/bin/env bash
#
# Download the published BitmapText.js font-assets release into font-assets/.
#
# The minimum set (metrics-bundle.js + positioning-bundle-density-*.js +
# atlas-*.webp) is distributed via GitHub Releases on the BitmapText.js repo.
# SWCanvas pins to a specific tag for reproducibility — bump the value in
# vendor/bitmaptext-release.pin when a newer release should be the baseline.
#
# Note: this script fetches the WebP minimum set only. For Node tests that need
# QOI-encoded atlases, see font-assets/_smoke/ (a small committed subset that
# ships with the repo so Node tests work after a fresh clone with no extra
# steps).
#
# Usage:
#   ./scripts/download-bitmaptext-assets.sh                  # pinned tag
#   ./scripts/download-bitmaptext-assets.sh --tag <tag>      # override
#   ./scripts/download-bitmaptext-assets.sh --force          # overwrite
#   ./scripts/download-bitmaptext-assets.sh --help

set -euo pipefail

REPO_OWNER='davidedc'
REPO_NAME='BitmapText.js'
ASSET_NAME='font-assets-min.zip'

# Release tag is pinned in vendor/bitmaptext-release.pin — single source of
# truth shared with scripts/download-bitmaptext-smoke-fixture.sh (one tag,
# two assets per sibling agreement). Bump there once and both downloaders
# follow. Override per-invocation with --tag <name>.
# Verify the pin matches GitHub releases/latest with: npm run text:check-pin
#
# Tag-history notes:
# - 2026-05-20: first release with v2 wire format (delta-varint metrics +
#   positioning). Earlier releases (font-assets-2026-13-05,
#   font-assets-2026-05-05) were cut from pre-v2 source and are incompatible
#   with the vendored runtime.
# - 2026-05-22: added font-assets-smoke-set.zip as a second asset (tiny
#   3-font Node-loadable QOI subset for SWCanvas's text rendering tests).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PIN_FILE="$PROJECT_ROOT/vendor/bitmaptext-release.pin"
if [ ! -f "$PIN_FILE" ]; then
    echo "ERROR: pin file missing: $PIN_FILE" >&2
    exit 1
fi
SWCANVAS_PINNED_TAG="$(tr -d ' \t\r\n' < "$PIN_FILE")"
if [ -z "$SWCANVAS_PINNED_TAG" ]; then
    echo "ERROR: pin file is empty: $PIN_FILE" >&2
    exit 1
fi

TAG="$SWCANVAS_PINNED_TAG"
FORCE=0
SHOW_HELP=0

while [ $# -gt 0 ]; do
    case "$1" in
        --tag)         TAG="${2:-}"; shift 2 ;;
        --tag=*)       TAG="${1#--tag=}"; shift ;;
        --force)       FORCE=1; shift ;;
        --help|-h)     SHOW_HELP=1; shift ;;
        *)             echo "ERROR: unknown argument: $1" >&2; SHOW_HELP=1; shift ;;
    esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
    sed -n '3,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

cd "$PROJECT_ROOT"

# Refuse to clobber a populated font-assets/ unless --force.
# Guard with -d so a totally-absent font-assets/ is treated as "empty, proceed";
# the unzip step recreates the directory.
if [ "$FORCE" -ne 1 ] && [ -d font-assets ]; then
    EXISTING_WEBP=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$EXISTING_WEBP" -gt 0 ]; then
        echo "ERROR: font-assets/ already contains $EXISTING_WEBP atlas-*.webp file(s)." >&2
        echo "       Pass --force to re-download and overwrite." >&2
        exit 1
    fi
fi

ZIP_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}"
SHA_URL="${ZIP_URL}.sha256"
echo "Downloading BitmapText font-assets release: $TAG"
echo "URL: $ZIP_URL"

STAGING="$(mktemp -d -t bitmaptext-assets-dl.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT

ZIP_TMP="$STAGING/$ASSET_NAME"
SHA_TMP="$STAGING/$ASSET_NAME.sha256"

curl --fail --location --retry 3 --progress-bar -o "$ZIP_TMP" "$ZIP_URL"

# Sidecar is best-effort: older releases may not have one. Warn and proceed.
SHA_OK=0
if curl --fail --location --silent --retry 3 -o "$SHA_TMP" "$SHA_URL" 2>/dev/null; then
    if (cd "$STAGING" && shasum -a 256 -c "$ASSET_NAME.sha256"); then
        SHA_OK=1
    else
        echo "ERROR: SHA-256 verification failed; aborting." >&2
        echo "Files left in $STAGING for inspection." >&2
        trap - EXIT
        exit 1
    fi
else
    echo "WARNING: no SHA-256 sidecar at $SHA_URL — skipping integrity check."
fi

echo ""
echo "Unpacking into font-assets/..."
unzip -oq "$ZIP_TMP" -d "$PROJECT_ROOT"

WEBP_COUNT=$(find font-assets -maxdepth 1 -name 'atlas-*.webp' -type f | wc -l | tr -d ' ')
POS_COUNT=$(find font-assets -maxdepth 1 -name 'positioning-bundle-density-*.js' -type f | wc -l | tr -d ' ')
test -f font-assets/metrics-bundle.js
echo "  metrics-bundle.js                : present"
echo "  positioning-bundle-density-*.js  : $POS_COUNT"
echo "  atlas-*.webp                     : $WEBP_COUNT"
if [ "$SHA_OK" -eq 1 ]; then
    echo "  SHA-256                          : verified"
fi
echo ""
echo "Done. Browser-side text rendering is now usable."
echo "(For Node text tests, font-assets/_smoke/ ships with the repo.)"
