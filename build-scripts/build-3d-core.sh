#!/bin/bash

# SWCanvas 3D-core build script.
#
# Builds the subtractive "3D core" dist target: the minimal closure of SWCanvas
# sources the software-3D path (SW3D / examples/sw3d.js) needs, and nothing
# else. No Context2D, no path/stroke rasterizer, no text engine — so this target
# does NOT go through the BitmapText vendor gate that the full build.sh runs.
#
# Consumer: a host page that renders 3D through SW3D but paints its 2D through
# the platform canvas. It gets Surface + DepthBuffer + Texture3D +
# Triangle3DOps (~18 KB minified) instead of the full ~263 KB engine.
#
# Also minifies examples/sw3d.js into dist/sw3d.min.js, so a consumer can ship
# the engine layer minified alongside the core.
#
# Runnable standalone; also invoked at the end of build.sh.

set -e

cd "$(dirname "$0")/.."

echo "Building SWCanvas 3D core..."

mkdir -p dist

# Header — same IIFE + strict-mode shape as dist/swcanvas.js.
cat > dist/swcanvas-3d-core.js << 'EOF'
(function() {
'use strict';

EOF

# Dependency closure for the 3D path, in dependency order.
#   Constants + Debug  — the footer exports IS_DEBUG/assertDebug/debugLog/debugWarn
#   Validators         — Surface's argument checks
#   Color              — Surface/Texture3D colour handling
#   Surface            — the pixel target
#   DepthBuffer        — z-buffer
#   Texture3D          — textured-triangle source
#   Triangle3DOps      — the depth-tested triangle rasterizer (writes raw typed
#                        arrays; its SpanOps/PolygonFiller/Context2D mentions
#                        are comments only)
CORE_SOURCES=(
    src/SWCanvasConstants.js
    src/core/Debug.js
    src/utils/Validators.js
    src/core/Color.js
    src/core/Surface.js
    src/core/DepthBuffer.js
    src/core/Texture3D.js
    src/renderers/Triangle3DOps.js
)

for file in "${CORE_SOURCES[@]}"; do
    cat "$file" >> dist/swcanvas-3d-core.js
    echo "" >> dist/swcanvas-3d-core.js
done

# Footer — the same dual API globals as the full build, restricted to Core and
# to the members this closure actually defines. `Surface` is exposed through
# CoreSurfaceFactory (a factory, no `new`) exactly as the full bundle does, so
# consumer code is source-compatible across the two targets.
cat >> dist/swcanvas-3d-core.js << 'EOF'

// Core namespace factory function (mirrors the full bundle's contract:
// SWCanvas.Core.Surface is a FACTORY, called without `new`).
function CoreSurfaceFactory(width, height) {
    return new Surface(width, height);
}

var swcanvas3DCoreApi = {
    Core: {
        Surface: CoreSurfaceFactory,
        Color: Color,
        Validators: Validators,
        DepthBuffer: DepthBuffer,
        Texture3D: Texture3D,
        Triangle3DOps: Triangle3DOps,
        IS_DEBUG: IS_DEBUG,
        assertDebug: assertDebug,
        debugLog: debugLog,
        debugWarn: debugWarn
    }
};

if (typeof window !== 'undefined') {
    window.SWCanvas = swcanvas3DCoreApi;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = swcanvas3DCoreApi;
}

})();
EOF

echo "Build complete: dist/swcanvas-3d-core.js"

# ---- minification -----------------------------------------------------------
# Same terser invocation as minify.sh (including the IS_DEBUG compile-time
# constant substitution that lets dead-code elimination drop assertion blocks).

TERSER_CMD=""
if command -v npx >/dev/null 2>&1 && npx terser --version >/dev/null 2>&1; then
    TERSER_CMD="npx terser"
elif command -v terser >/dev/null 2>&1; then
    TERSER_CMD="terser"
else
    echo "❌ Error: Terser is not installed (npm install -g terser)." >&2
    exit 1
fi

TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

perl -0777 -pe 's/const IS_DEBUG = typeof globalThis.*?__SWCANVAS_DEBUG__ === true;/const IS_DEBUG = false;/s' dist/swcanvas-3d-core.js > "$TEMP_FILE"

$TERSER_CMD "$TEMP_FILE" \
    --compress drop_console=true,drop_debugger=true,dead_code=true,unused=true,pure_funcs=['console.log','console.warn','console.error','console.debug','console.info'] \
    --mangle \
    --output dist/swcanvas-3d-core.min.js

# SW3D itself — the userland engine layer. Minified so a consumer can ship the
# whole 3D path minified. No IS_DEBUG substitution: sw3d.js has none.
$TERSER_CMD examples/sw3d.js \
    --compress drop_console=true,drop_debugger=true,dead_code=true,unused=true,pure_funcs=['console.log','console.warn','console.error','console.debug','console.info'] \
    --mangle \
    --output dist/sw3d.min.js

echo "Build complete: dist/swcanvas-3d-core.min.js ($(wc -c < dist/swcanvas-3d-core.min.js | tr -d ' ') bytes)"
echo "Build complete: dist/sw3d.min.js ($(wc -c < dist/sw3d.min.js | tr -d ' ') bytes)"

# ---- witness ----------------------------------------------------------------
# Renders a lit box through the core dist ALONE. A dependency that leaked out of
# the closure ReferenceErrors here, in this repo, rather than in a consumer.
echo "Running the 3D-core witness..."
node examples/3d-core-node.js
