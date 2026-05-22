#!/bin/bash

# SWCanvas.js Build Script
# Concatenates source files into a single global script

set -e

echo "Building SWCanvas.js..."

# Step 0: Preprocess files with inline markers
echo "Preprocessing inline markers..."
rm -rf .preprocessed
mkdir -p .preprocessed/renderers

# List of files that may have inline markers
PREPROCESSED_FILES=(
    "src/renderers/SpanOps.js"
    "src/renderers/CircleOps.js"
    "src/renderers/ArcOps.js"
    "src/renderers/LineOps.js"
    "src/renderers/RectOpsRot.js"
    "src/renderers/RoundedRectOpsAA.js"
    "src/renderers/RoundedRectOpsRot.js"
    "src/renderers/QuadScanOps.js"
    "src/renderers/RectOpsAA.js"
)

for file in "${PREPROCESSED_FILES[@]}"; do
    outfile=".preprocessed/${file#src/}"
    mkdir -p "$(dirname "$outfile")"
    node build-scripts/preprocess.js "$file" "$outfile"
done

# Helper function to get file path (use preprocessed if available)
get_src() {
    local file="$1"
    local preprocessed=".preprocessed/${file#src/}"
    if [ -f "$preprocessed" ]; then
        echo "$preprocessed"
    else
        echo "$file"
    fi
}

# Step 1: Build modular tests (if directories exist)
if [ -d "tests/core" ] || [ -d "tests/visual" ]; then
    echo "Building modular tests..."
    node tests/build/concat-tests.js
fi

# Create dist directory
mkdir -p dist

# Header for the global script
cat > dist/swcanvas.js << 'EOF'
(function() {
'use strict';

EOF

# Concatenate source files in dependency order
# Phase 0: Constants and Debug utilities (no dependencies - load first)
cat src/SWCanvasConstants.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/Debug.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 1: Core Foundation classes (no dependencies)
cat src/utils/Validators.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/Color.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/StateStack.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/utils/Point.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/utils/Rectangle.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/Transform2D.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/SWPath2D.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/Surface.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 1.7: Vendored BitmapText.js (text rendering engine).
# Order mirrors BitmapText.js/scripts/build-runtime-bundle.sh — see
# vendor/bitmaptext.UPDATE.md for refresh workflow. Platform FontLoader files
# self-register via their footers (typeof document check); both files coexist
# in the same bundle without collision because upstream renamed FontLoader →
# BitmapTextFontLoaderBrowser / BitmapTextFontLoaderNode.
#
# Auto-fetch gate. vendor/bitmaptext/ is gitignored and regenerated from
# vendor/bitmaptext.pin on demand. VERSION is the completion sentinel
# (written last by the vendor script). If either VERSION or the marquee
# BitmapText.js file is missing, treat the vendor as not-populated and
# fetch via the pin-driven default mode.
if [ ! -f vendor/bitmaptext/VERSION ] || [ ! -f vendor/bitmaptext/runtime/BitmapText.js ]; then
    echo ""
    echo "vendor/bitmaptext/ not populated — fetching from vendor/bitmaptext.pin..."
    if ! ./scripts/vendor-bitmaptext.sh; then
        echo "ERROR: vendor fetch failed; aborting build." >&2
        echo "       See vendor/bitmaptext.UPDATE.md for troubleshooting." >&2
        exit 1
    fi
fi

# Stale-pin warning. Non-fatal: avoiding surprise long builds after `git pull`
# matters more than strict freshness. Run the vendor script when you're ready.
if [ -f vendor/bitmaptext.pin ] && [ -f vendor/bitmaptext/VERSION ]; then
    PIN_SHA="$(tr -d ' \t\r\n' < vendor/bitmaptext.pin)"
    VERSION_SHA="$(grep -E '^Commit SHA  :' vendor/bitmaptext/VERSION | sed -E 's/^Commit SHA  : //' | tr -d ' \t\r\n')"
    if [ -n "$PIN_SHA" ] && [ -n "$VERSION_SHA" ] && [ "$PIN_SHA" != "$VERSION_SHA" ]; then
        echo ""
        echo "WARNING: vendor/bitmaptext.pin SHA differs from vendor/bitmaptext/VERSION SHA."
        echo "         Pin:     $PIN_SHA"
        echo "         Vendor:  $VERSION_SHA"
        echo "         Run ./scripts/vendor-bitmaptext.sh to refresh."
        echo ""
    fi
fi

cat vendor/bitmaptext/runtime/StatusCode.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/BundleCodec.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/CharacterSets.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/FontProperties.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/TextProperties.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/FontMetrics.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/InterpolatedFontMetrics.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/FontMetricsStore.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/MetricsBundleStore.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/AtlasPositioning.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/PositioningBundleStore.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/AtlasImage.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/AtlasData.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/AtlasDataStore.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/FontManifest.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/FontLoaderBase.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/BitmapText.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/runtime/BitmapTextRegistration.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
# MetricsExpander lives under builder/ upstream but is part of the runtime
# bundle (FontMetricsStore depends on it to expand compact bundle records into
# FontMetrics instances). Must come before FontMetricsStore consumers run, but
# since the actual usage is on-demand at first getFontMetrics call, exact
# position between BitmapTextRegistration and FontLoaderBase is fine.
cat vendor/bitmaptext/builder/MetricsExpander.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
# AtlasCellDimensions is a tiny utility used by atlas reconstruction.
cat vendor/bitmaptext/utils/AtlasCellDimensions.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/platform/FontLoaderBrowser.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/platform/FontLoaderNode.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat vendor/bitmaptext/utils/AtlasLRU.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 1.5: Shape rendering operations (depend on Surface)
# Note: Some files use preprocessed versions with expanded inline markers
cat "$(get_src src/renderers/SpanOps.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/QuadScanOps.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/RectOpsRot.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/RectOpsAA.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/CircleOps.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/ArcOps.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/LineOps.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/renderers/RoundedRectUtils.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/RoundedRectOpsRot.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat "$(get_src src/renderers/RoundedRectOpsAA.js)" >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 2: Core Service classes (depend on foundation)
cat src/utils/CompositeOperations.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/io/BitmapEncodingOptions.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/io/BitmapEncoder.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/io/PngEncodingOptions.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/io/PngEncoder.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/renderers/PathFlattener.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/renderers/PolygonFiller.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/renderers/StrokeGenerator.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/utils/BitBuffer.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/utils/BoundsTracker.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/ClipMask.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/SourceMask.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/filters/ShadowBuffer.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/filters/BoxBlur.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/filters/ShadowPipeline.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/utils/ImageProcessor.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/paint/ColorParser.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 2.5: Paint sources (depend on foundation + ColorParser)
cat src/paint/Gradient.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/paint/Pattern.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 2.7: Text bridge (depends on vendored BitmapText + Color).
# Order: pure utilities first, then TextRenderer (uses BitmapText classes),
# then FontsNamespace (also uses BitmapText), then BootstrapText (calls
# BitmapText.configure). BootstrapText.initialize() is invoked from the
# dual-API footer once SWCanvas's createCanvas is available.
cat src/text/CssFontParser.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/text/FillStyleToTextColor.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/text/TextRenderer.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/text/FontsNamespace.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/text/BootstrapText.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 3: Core rendering classes (depend on services)
cat src/core/Rasterizer.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/core/Context2D.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js

# Phase 4: Canvas compatibility layer (depends on Core)
cat src/compat/CanvasCompatibleContext2D.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/compat/SWCanvasElement.js >> dist/swcanvas.js

# Add compatibility layer and dual API setup
cat >> dist/swcanvas.js << 'EOF'

// Canvas factory function for HTML5 Canvas compatibility
function createCanvas(width = 300, height = 150) {
    return new SWCanvasElement(width, height);
}

// Core namespace factory functions  
function CoreSurfaceFactory(width, height) {
    return new Surface(width, height);
}


// Legacy encodeBMP function
function encodeBMP(surface) {
    return BitmapEncoder.encode(surface);
}

// Factory function for creating ImageData objects
function createImageData(width, height) {
    if (typeof width !== 'number' || width <= 0 || !Number.isInteger(width)) {
        throw new Error('Width must be a positive integer');
    }
    if (typeof height !== 'number' || height <= 0 || !Number.isInteger(height)) {
        throw new Error('Height must be a positive integer');
    }
    
    return {
        width: width,
        height: height,
        data: new Uint8ClampedArray(width * height * 4)
    };
}

EOF

# Footer to expose clean dual API globals
cat >> dist/swcanvas.js << 'EOF'

// Build the SWCanvas.fonts namespace + _raw escape hatch (advanced users / demos).
var swcanvasFonts = {
    load: FontsNamespace.load,
    has: FontsNamespace.has,
    unload: FontsNamespace.unload,
    _raw: {
        BitmapText: BitmapText,
        FontProperties: FontProperties,
        TextProperties: TextProperties,
        AtlasDataStore: AtlasDataStore,
        FontManifest: FontManifest,
        AtlasLRU: AtlasLRU
    }
};

// Export to global scope with clean dual API architecture
if (typeof window !== 'undefined') {
    // Browser
    window.SWCanvas = {
        // HTML5 Canvas-compatible API (recommended for portability)
        createCanvas: createCanvas,
        createImageData: createImageData,

        // Text loading namespace (CSS-Font-Loading-API-shaped).
        fonts: swcanvasFonts,

        // Core API namespace (recommended for performance/control)
        Core: {
            Surface: CoreSurfaceFactory,
            Context2D: Context2D,
            Transform2D: Transform2D,
            SWPath2D: SWPath2D,
            Color: Color,
            Point: Point,
            Rectangle: Rectangle,
            StateStack: StateStack,
            BitmapEncoder: BitmapEncoder,
            BitmapEncodingOptions: BitmapEncodingOptions,
            PngEncoder: PngEncoder,
            PngEncodingOptions: PngEncodingOptions,
            BitBuffer: BitBuffer,
            BoundsTracker: BoundsTracker,
            ClipMask: ClipMask,
            SourceMask: SourceMask,
            ShadowBuffer: ShadowBuffer,
            BoxBlur: BoxBlur,
            ShadowPipeline: ShadowPipeline,
            ImageProcessor: ImageProcessor,
            CompositeOperations: CompositeOperations,
            Rasterizer: Rasterizer,
            PathFlattener: PathFlattener,
            PolygonFiller: PolygonFiller,
            StrokeGenerator: StrokeGenerator,
            Gradient: Gradient,
            LinearGradient: LinearGradient,
            RadialGradient: RadialGradient,
            ConicGradient: ConicGradient,
            Pattern: Pattern,
            RoundedRectOpsAA: RoundedRectOpsAA,
            Validators: Validators,
            IS_DEBUG: IS_DEBUG,
            assertDebug: assertDebug,
            debugLog: debugLog,
            debugWarn: debugWarn
        }
    };
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = {
        // HTML5 Canvas-compatible API (recommended for portability)
        createCanvas: createCanvas,
        createImageData: createImageData,

        // Text loading namespace (CSS-Font-Loading-API-shaped).
        fonts: swcanvasFonts,

        // Core API namespace (recommended for performance/control)
        Core: {
            Surface: CoreSurfaceFactory,
            Context2D: Context2D,
            Transform2D: Transform2D,
            SWPath2D: SWPath2D,
            Color: Color,
            Point: Point,
            Rectangle: Rectangle,
            StateStack: StateStack,
            BitmapEncoder: BitmapEncoder,
            BitmapEncodingOptions: BitmapEncodingOptions,
            PngEncoder: PngEncoder,
            PngEncodingOptions: PngEncodingOptions,
            BitBuffer: BitBuffer,
            BoundsTracker: BoundsTracker,
            ClipMask: ClipMask,
            SourceMask: SourceMask,
            ShadowBuffer: ShadowBuffer,
            BoxBlur: BoxBlur,
            ShadowPipeline: ShadowPipeline,
            ImageProcessor: ImageProcessor,
            CompositeOperations: CompositeOperations,
            Rasterizer: Rasterizer,
            PathFlattener: PathFlattener,
            PolygonFiller: PolygonFiller,
            StrokeGenerator: StrokeGenerator,
            Gradient: Gradient,
            LinearGradient: LinearGradient,
            RadialGradient: RadialGradient,
            ConicGradient: ConicGradient,
            Pattern: Pattern,
            RoundedRectOpsAA: RoundedRectOpsAA,
            Validators: Validators,
            IS_DEBUG: IS_DEBUG,
            assertDebug: assertDebug,
            debugLog: debugLog,
            debugWarn: debugWarn
        }
    };
}

// Phase 4.7: Text bootstrap. Runs AFTER the SWCanvas namespace is built (so we
// can hand BootstrapText a reference to createCanvas for BitmapText's canvas
// factory) and BEFORE any consumer code can call SWCanvas.fonts.load — this is
// the last executable line in dist/swcanvas.js, satisfying setAtlasFormat's
// call-time contract (must precede the first loadFont / registerAtlas).
var _swcanvasNs = (typeof window !== 'undefined') ? window.SWCanvas
                : (typeof module !== 'undefined' && module.exports) ? module.exports
                : null;
if (_swcanvasNs) {
    BootstrapText.initialize(_swcanvasNs);
}

// Expose BitmapText on the global so the script-tag-injected asset files
// (metrics-bundle.js, positioning-bundle-density-*.js, atlas-*-webp.js) can
// reach the registration callbacks (BitmapText.rBundle, .pBundle, .a). Those
// scripts execute in the page's global scope, not inside this IIFE — without
// this line they ReferenceError on first load. BitmapText's own dist bundle
// avoids the IIFE entirely, so all its classes are naturally global; SWCanvas
// wraps everything in an IIFE for hygiene and re-exposes only what the
// dynamically-loaded asset pipeline needs.
if (typeof globalThis !== 'undefined') {
    globalThis.BitmapText = BitmapText;
}

})();
EOF

echo "Build complete: dist/swcanvas.js"

# Generate build info metadata
node build-scripts/generate-build-info.js dev dist/swcanvas.build-info.js