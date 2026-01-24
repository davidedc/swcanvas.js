#!/bin/bash

# SWCanvas.js Minification Script
# Creates a minified version of the SWCanvas.js library using Terser

set -e

echo "SWCanvas.js Minification Script"
echo "============================"

# Check if dist/swcanvas.js exists
if [ ! -f "dist/swcanvas.js" ]; then
    echo "❌ Error: dist/swcanvas.js not found!"
    echo "   Please run 'npm run build' first."
    exit 1
fi

# Check if Terser is installed
TERSER_CMD=""
if command -v npx >/dev/null 2>&1 && npx terser --version >/dev/null 2>&1; then
    TERSER_CMD="npx terser"
    echo "✓ Using Terser via npx"
elif command -v terser >/dev/null 2>&1; then
    TERSER_CMD="terser"
    echo "✓ Using globally installed Terser"
else
    echo "❌ Error: Terser is not installed!"
    echo ""
    echo "To install Terser, run one of these commands:"
    echo "  npm install -g terser          # Global installation"
    echo "  npm install --save-dev terser  # Local project installation"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "📦 Minifying dist/swcanvas.js..."

# Get original file size
ORIGINAL_SIZE=$(wc -c < dist/swcanvas.js)
ORIGINAL_LINES=$(wc -l < dist/swcanvas.js)

# Minify with Terser
$TERSER_CMD dist/swcanvas.js \
    --compress drop_console=true,drop_debugger=true,dead_code=true,unused=true,pure_funcs=['console.log','console.warn','console.error','console.debug','console.info'] \
    --mangle \
    --output dist/swcanvas.min.js \
    --source-map "url=swcanvas.min.js.map,filename=dist/swcanvas.min.js.map"

# Check if minification was successful
if [ ! -f "dist/swcanvas.min.js" ]; then
    echo "❌ Error: Minification failed!"
    exit 1
fi

# Get minified file size
MINIFIED_SIZE=$(wc -c < dist/swcanvas.min.js)

# Calculate size reduction
REDUCTION=$((ORIGINAL_SIZE - MINIFIED_SIZE))
REDUCTION_PERCENT=$((REDUCTION * 100 / ORIGINAL_SIZE))

echo "✅ Minification complete!"
echo ""
echo "📊 Size Comparison:"
echo "   Original:  $(printf "%'d" $ORIGINAL_SIZE) bytes ($ORIGINAL_LINES lines)"
echo "   Minified:  $(printf "%'d" $MINIFIED_SIZE) bytes"
echo "   Saved:     $(printf "%'d" $REDUCTION) bytes (${REDUCTION_PERCENT}% reduction)"
echo ""
echo "📄 Generated files:"
echo "   dist/swcanvas.min.js     - Minified library"
echo "   dist/swcanvas.min.js.map - Source map"
echo ""
echo "🎉 Ready for production use!"

# Generate build info metadata for minified build
node build-scripts/generate-build-info.js min dist/swcanvas.min.build-info.js