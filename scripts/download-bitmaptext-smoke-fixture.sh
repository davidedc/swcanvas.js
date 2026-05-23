#!/usr/bin/env bash
#
# Download the BitmapText.js smoke-set fixture into font-assets/_smoke/.
#
# The smoke set is a tiny (~10 KB) 3-font subset of the full font-assets
# release, packaged as the second asset on the same release tag:
#
#   font-assets-min.zip          ← downloaded by download-bitmaptext-assets.sh
#   font-assets-smoke-set.zip    ← downloaded by THIS script
#
# Both read the release tag from vendor/bitmaptext-release.pin — one bump
# there propagates to both downloaders. Inside the smoke zip:
#
#   metrics-bundle.js                                    (subset metrics bundle)
#   positioning-bundle-density-1.js                      (subset positioning bundle)
#   atlas-density-1-0-Arial-style-normal-weight-normal-size-16-0-qoi.js
#   atlas-density-1-0-Arial-style-normal-weight-bold-size-16-0-qoi.js
#   atlas-density-1-0-BitmapTextInvariant-style-normal-weight-normal-size-16-0-qoi.js
#   smoke-set.json                                       (self-describing spec)
#
# The output directory (font-assets/_smoke/) is tracked in git via the
# .gitignore exception (!font-assets/_smoke/). The smoke fixture ships with
# the repo so Node text tests work after a fresh clone with no extra steps.
#
# Usage:
#   ./scripts/download-bitmaptext-smoke-fixture.sh             # pinned tag
#   ./scripts/download-bitmaptext-smoke-fixture.sh --tag <tag> # override
#   ./scripts/download-bitmaptext-smoke-fixture.sh --force     # overwrite
#   ./scripts/download-bitmaptext-smoke-fixture.sh --help

set -euo pipefail

REPO_OWNER='davidedc'
REPO_NAME='BitmapText.js'
ASSET_NAME='font-assets-smoke-set.zip'

# Release tag is pinned in vendor/bitmaptext-release.pin — single source of
# truth shared with scripts/download-bitmaptext-assets.sh (one tag, two
# assets per sibling agreement). Bump there once and both downloaders
# follow. Override per-invocation with --tag <name>.
# Verify the pin matches GitHub releases/latest with: npm run text:check-pin

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
    sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

cd "$PROJECT_ROOT"

SMOKE_DIR="$PROJECT_ROOT/font-assets/_smoke"

# Refuse to clobber a populated font-assets/_smoke/ unless --force.
if [ "$FORCE" -ne 1 ] && [ -d "$SMOKE_DIR" ]; then
    EXISTING=$(find "$SMOKE_DIR" -maxdepth 1 -name '*.js' -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$EXISTING" -gt 0 ]; then
        echo "ERROR: font-assets/_smoke/ already contains $EXISTING .js file(s)." >&2
        echo "       Pass --force to re-download and overwrite." >&2
        exit 1
    fi
fi

ZIP_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG}/${ASSET_NAME}"
SHA_URL="${ZIP_URL}.sha256"
echo "Downloading BitmapText smoke-set fixture: $TAG"
echo "URL: $ZIP_URL"

STAGING="$(mktemp -d -t bitmaptext-smoke-dl.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT

ZIP_TMP="$STAGING/$ASSET_NAME"
SHA_TMP="$STAGING/$ASSET_NAME.sha256"

curl --fail --location --retry 3 --progress-bar -o "$ZIP_TMP" "$ZIP_URL"

# SHA-256 verification — the smoke release has a sidecar per sibling agreement.
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

mkdir -p "$SMOKE_DIR"
echo ""
echo "Unpacking into font-assets/_smoke/..."
unzip -oq "$ZIP_TMP" -d "$SMOKE_DIR"

# Sanity: the agreed-on smoke set has 6 files (3 atlas wrappers + 2 bundles +
# smoke-set.json). Fail loudly if anything is missing.
ATLAS_COUNT=$(find "$SMOKE_DIR" -maxdepth 1 -name 'atlas-*-qoi.js' -type f | wc -l | tr -d ' ')
test -f "$SMOKE_DIR/metrics-bundle.js"
test -f "$SMOKE_DIR/positioning-bundle-density-1.js"
test -f "$SMOKE_DIR/smoke-set.json"
echo "  metrics-bundle.js                : present"
echo "  positioning-bundle-density-1.js  : present"
echo "  atlas-*-qoi.js                   : $ATLAS_COUNT (expected 3)"
echo "  smoke-set.json                   : present"
if [ "$SHA_OK" -eq 1 ]; then
    echo "  SHA-256                          : verified"
fi
if [ "$ATLAS_COUNT" -ne 3 ]; then
    echo "ERROR: expected 3 atlas-*-qoi.js files, got $ATLAS_COUNT." >&2
    exit 1
fi
echo ""
echo "Done. Node-side text rendering tests can now load these via"
echo "BitmapText.setFontDirectory('./font-assets/_smoke/') + loadFont(...)."
