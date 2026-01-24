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
cat src/compat/SourceMask.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/filters/ShadowBuffer.js >> dist/swcanvas.js
echo "" >> dist/swcanvas.js
cat src/filters/BoxBlur.js >> dist/swcanvas.js
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

// Export to global scope with clean dual API architecture
if (typeof window !== 'undefined') {
    // Browser
    window.SWCanvas = {
        // HTML5 Canvas-compatible API (recommended for portability)
        createCanvas: createCanvas,
        createImageData: createImageData,
        
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
            IS_DEBUG: IS_DEBUG,
            assertDebug: assertDebug,
            debugLog: debugLog,
            debugWarn: debugWarn
        }
    };
}

})();
EOF

echo "Build complete: dist/swcanvas.js"

# Generate build info metadata
node build-scripts/generate-build-info.js dev dist/swcanvas.build-info.js