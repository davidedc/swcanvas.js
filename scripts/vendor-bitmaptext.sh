#!/usr/bin/env bash
#
# Vendor BitmapText.js source into vendor/bitmaptext/.
#
# Two modes:
#
#   1. Default (no flags) — fetch from GitHub at the SHA in vendor/bitmaptext.pin.
#      Used by build.sh's auto-fetch gate on first build (or after `rm -rf
#      vendor/bitmaptext`).
#
#   2. --source <path> — rsync from a local BitmapText.js checkout. Used by
#      maintainers during cross-project development. Also rewrites
#      vendor/bitmaptext.pin to the local source's HEAD SHA — suppress with
#      --no-pin-update. Fails if the local source has uncommitted changes in
#      the vendored paths (src/, scripts/image-to-js-converter.js), unless
#      --no-pin-update is set.
#
# Both modes converge on the same rsync logic; the only difference is where
# the source tree comes from. vendor/bitmaptext.pin (committed) is the source
# of truth for which BitmapText commit is vendored; vendor/bitmaptext/VERSION
# is generated metadata recording how the snapshot was populated.
#
# Excludes canvas-mock.js (SWCanvas provides its own canvas factory).
#
# See vendor/bitmaptext.UPDATE.md for the maintainer workflow.
#
# Usage:
#   ./scripts/vendor-bitmaptext.sh                                  # from pin (default)
#   ./scripts/vendor-bitmaptext.sh --source <path>                  # from local, rewrite pin
#   ./scripts/vendor-bitmaptext.sh --source <path> --no-pin-update  # from local, keep pin
#   ./scripts/vendor-bitmaptext.sh --help

set -euo pipefail

SOURCE=''
UPDATE_PIN=1
SHOW_HELP=0

while [ $# -gt 0 ]; do
    case "$1" in
        --source)         SOURCE="${2:-}"; shift 2 ;;
        --source=*)       SOURCE="${1#--source=}"; shift ;;
        --no-pin-update)  UPDATE_PIN=0; shift ;;
        --help|-h)        SHOW_HELP=1; shift ;;
        *)                echo "ERROR: unknown argument: $1" >&2; SHOW_HELP=1; shift ;;
    esac
done

if [ "$SHOW_HELP" -eq 1 ]; then
    sed -n '3,33p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PIN_FILE='vendor/bitmaptext.pin'
GITHUB_REPO='davidedc/BitmapText.js'
GITHUB_TARBALL_PREFIX='BitmapText.js'   # case-preserved from the GitHub repo name

if [ -n "$SOURCE" ]; then
    MODE='local-source'
else
    MODE='from-pin'
fi

# ----- Resolve the source tree depending on mode -----

if [ "$MODE" = 'from-pin' ]; then
    if [ ! -f "$PIN_FILE" ]; then
        echo "ERROR: $PIN_FILE missing." >&2
        echo "       Create it with a BitmapText commit SHA, or run with --source <path>." >&2
        exit 1
    fi

    PIN_SHA="$(tr -d ' \t\r\n' < "$PIN_FILE")"
    if ! [[ "$PIN_SHA" =~ ^[a-f0-9]{40}$ ]]; then
        echo "ERROR: $PIN_FILE doesn't contain a valid 40-char hex SHA." >&2
        echo "       Got: '$PIN_SHA'" >&2
        exit 1
    fi

    STAGING="$(mktemp -d -t bitmaptext-vendor.XXXXXX)"
    trap 'rm -rf "$STAGING"' EXIT

    TARBALL_URL="https://github.com/$GITHUB_REPO/archive/$PIN_SHA.tar.gz"
    TARBALL="$STAGING/src.tar.gz"

    echo "=== Vendoring BitmapText.js (from pin) ==="
    echo "  Pin SHA : $PIN_SHA"
    echo "  Source  : $TARBALL_URL"
    echo "  Target  : $PROJECT_ROOT/vendor/bitmaptext/"
    echo ""

    echo "Fetching tarball..."
    curl --fail --location --retry 3 --progress-bar -o "$TARBALL" "$TARBALL_URL"
    if [ ! -s "$TARBALL" ]; then
        echo "ERROR: downloaded tarball is empty. Check network / GitHub availability." >&2
        exit 1
    fi

    echo "Extracting..."
    tar -xzf "$TARBALL" -C "$STAGING"

    SOURCE_ABS="$STAGING/${GITHUB_TARBALL_PREFIX}-${PIN_SHA}"
    if [ ! -d "$SOURCE_ABS/src/runtime" ]; then
        echo "ERROR: extracted tarball doesn't contain src/runtime/." >&2
        echo "       Pin SHA $PIN_SHA may be invalid or upstream layout changed." >&2
        exit 1
    fi

    SOURCE_SHA="$PIN_SHA"
    SOURCE_DESCRIBE='(from GitHub tarball — describe unavailable)'
    SOURCE_DISPLAY="$TARBALL_URL"
else
    SOURCE_ABS="$(cd "$PROJECT_ROOT" && cd "$SOURCE" 2>/dev/null && pwd || true)"
    if [ -z "$SOURCE_ABS" ] || [ ! -d "$SOURCE_ABS/src/runtime" ]; then
        echo "ERROR: source path '$SOURCE' does not resolve to a BitmapText.js repo." >&2
        echo "       (Expected to find <source>/src/runtime/BitmapText.js)" >&2
        exit 1
    fi

    echo "=== Vendoring BitmapText.js (from local source) ==="
    echo "  Source : $SOURCE_ABS"
    echo "  Target : $PROJECT_ROOT/vendor/bitmaptext/"
    echo ""

    SOURCE_SHA='(no git history)'
    SOURCE_DESCRIBE='(no git history)'
    if [ -d "$SOURCE_ABS/.git" ]; then
        # Dirty check, scoped to the paths we actually vendor. Only enforced
        # when we'd be rewriting the pin — with --no-pin-update we accept the
        # state as-is (vendor from a local fork to test, leave the committed
        # pin untouched).
        if [ "$UPDATE_PIN" -eq 1 ]; then
            DIRTY="$(cd "$SOURCE_ABS" && git status --porcelain -- src/ scripts/image-to-js-converter.js 2>/dev/null || true)"
            if [ -n "$DIRTY" ]; then
                echo "ERROR: local source has uncommitted changes in vendored paths:" >&2
                echo "$DIRTY" >&2
                echo "" >&2
                echo "       Either commit them (pin will then update to the new HEAD)," >&2
                echo "       or pass --no-pin-update to vendor anyway without pin rewrite." >&2
                exit 1
            fi
        fi
        SOURCE_SHA="$(cd "$SOURCE_ABS" && git rev-parse HEAD)"
        SOURCE_DESCRIBE="$(cd "$SOURCE_ABS" && git describe --tags --always --dirty 2>/dev/null || echo "$SOURCE_SHA")"
    fi
    SOURCE_DISPLAY="$SOURCE_ABS"
fi

# ----- Common rsync logic (both modes converge here) -----
#
# Operation order: the source tree is fully resolved above. Only NOW do we
# destroy the existing vendor/bitmaptext/ — if anything above failed (network
# error, bad pin, dirty source), the previous vendor/ survives intact.

rm -rf vendor/bitmaptext
mkdir -p vendor/bitmaptext/runtime vendor/bitmaptext/platform vendor/bitmaptext/utils vendor/bitmaptext/builder vendor/bitmaptext/scripts vendor/bitmaptext/lib

# Runtime: copy everything.
rsync -a --delete "$SOURCE_ABS/src/runtime/" vendor/bitmaptext/runtime/

# Builder: a single file (MetricsExpander) lives under builder/ upstream but
# is part of the RUNTIME bundle (it expands the compact metrics-bundle records
# into FontMetrics instances). BitmapText's build-runtime-bundle.sh lists it
# in COMMON_FILES; we mirror that here.
rsync -a "$SOURCE_ABS/src/builder/MetricsExpander.js" vendor/bitmaptext/builder/

# Platform: only the two FontLoaders. canvas-mock.js is intentionally excluded
# — SWCanvas provides its own canvas factory via SWCanvas.createCanvas, and the
# Node atlas-load path routes through getCanvasFactory()() (FontLoaderNode.js
# line 124+), so canvas-mock is unused.
rsync -a "$SOURCE_ABS/src/platform/FontLoaderBrowser.js" vendor/bitmaptext/platform/
rsync -a "$SOURCE_ABS/src/platform/FontLoaderNode.js"    vendor/bitmaptext/platform/

# Utils: AtlasLRU (the demo's reusable LRU cache) and AtlasCellDimensions
# (used internally by atlas reconstruction). Both are in upstream's runtime
# bundle list even though they live under src/utils/.
rsync -a "$SOURCE_ABS/src/utils/AtlasLRU.js"            vendor/bitmaptext/utils/
rsync -a "$SOURCE_ABS/src/utils/AtlasCellDimensions.js" vendor/bitmaptext/utils/

# Scripts: image-to-js-converter.js wraps atlas-*.webp into atlas-*-webp.js
# base64-encoded JS files. SWCanvas needs this to support the LRU demo over
# file:// (browsers block cross-file:// Image loads; the wrappers are loaded
# via <script>-tag injection instead). Upstream considers this vendor-grade
# (zero project deps, stable CLI surface, locked output contract) — see the
# file's own "VENDORING NOTES" block. SWCanvas calls it through
# `npm run text:wrap-for-file` with the --webp flag.
rsync -a "$SOURCE_ABS/scripts/image-to-js-converter.js" vendor/bitmaptext/scripts/

# Lib: QOIDecode is a standalone function used by FontLoaderNode to decode
# QOI-encoded atlas bytes back into raw pixels. BitmapText's own
# build-runtime-bundle.sh concatenates lib/QOIDecode.js into its Node-runtime
# bundle and exposes it via `global.QOIDecode = QOIDecode;` — we do the same
# inside our IIFE via build.sh's Phase 1.7 (no global exposure needed because
# FontLoaderNode is concatenated in the same scope).
rsync -a "$SOURCE_ABS/lib/QOIDecode.js" vendor/bitmaptext/lib/

# QOIEncode is the inverse — NOT part of the runtime dist (Node only decodes
# at load time). It is used at authoring time by scripts/build-smoke-fixture.js,
# which re-derives the Node smoke fixture's QOI atlases from the published WebP
# release (lossless VP8L → dwebp → QOIEncode), so we vendor it alongside the
# decoder to keep it pinned.
rsync -a "$SOURCE_ABS/lib/QOIEncode.js" vendor/bitmaptext/lib/

# ----- Pin rewrite (local-source mode, when allowed) -----

if [ "$MODE" = 'local-source' ] && [ "$UPDATE_PIN" -eq 1 ] && [ "$SOURCE_SHA" != '(no git history)' ]; then
    echo "$SOURCE_SHA" > "$PIN_FILE"
    echo ""
    echo "Pin updated: $SOURCE_SHA"
    # Warn (don't fail) if HEAD isn't on any public remote — a future from-pin
    # fetch from GitHub will 404 until this commit is pushed.
    if [ -d "$SOURCE_ABS/.git" ]; then
        UNREACHABLE="$(cd "$SOURCE_ABS" && git branch -r --contains HEAD 2>/dev/null | head -1 || true)"
        if [ -z "$UNREACHABLE" ]; then
            echo "WARNING: HEAD ($SOURCE_SHA) isn't reachable from any remote branch."
            echo "         A future from-pin fetch from GitHub will fail until this commit is pushed."
        fi
    fi
fi

# ----- VERSION file (written LAST — build.sh's gate uses it as a completion sentinel) -----

FETCH_MODE_NOTE="$MODE"
if [ "$MODE" = 'local-source' ] && [ "$UPDATE_PIN" -eq 0 ]; then
    FETCH_MODE_NOTE="$MODE (--no-pin-update)"
fi

cat > vendor/bitmaptext/VERSION <<EOF
BitmapText.js vendor snapshot
Source      : $SOURCE_DISPLAY
Commit SHA  : $SOURCE_SHA
Describe    : $SOURCE_DESCRIBE
Vendored at : $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Fetch mode  : $FETCH_MODE_NOTE
By script   : scripts/vendor-bitmaptext.sh
EOF

echo ""
echo "Vendored files:"
find vendor/bitmaptext -type f | sort | sed 's|^|  |'

echo ""
echo "VERSION:"
sed 's|^|  |' vendor/bitmaptext/VERSION

echo ""
echo "Done. Next: rebuild SWCanvas and run tests."
