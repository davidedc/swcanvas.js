# SWCanvas.js Architecture

SWCanvas implements a sophisticated **multi-paradigm design pattern** that resolves fundamental impedance mismatches in graphics programming through a layered architecture with progressive disclosure.

## Core Architectural Problem

Graphics programming faces three competing paradigms that are difficult to reconcile:

### HTML5 Canvas Paradigm (Web Standards)
- DOM-like, stateful, string-based, mutable element model
- Familiar to web developers but performance-limited
- String parsing overhead, implicit state management

### High-Performance Graphics Paradigm (Game Engines)
- Direct, explicit, numeric, immutable objects
- Maximum performance but unfamiliar to web developers
- No parsing overhead, explicit state management

### Cross-Platform Library Paradigm (Universal)
- Factory-based, namespace-organized, environment-agnostic
- Works across Node.js and browser environments

## Layered Solution Architecture

SWCanvas resolves these competing paradigms through a three-layer architecture:

### Layer 1: Core Engine (Performance)
```
src/SWCanvasConstants.js → Centralized constants (loaded first)

src/core/           → Core engine primitives
  Transform2D.js    → Immutable transformation mathematics
  Color.js          → Immutable color handling
  Surface.js        → Raw pixel buffer management
  Context2D.js      → High-performance rendering engine
  Rasterizer.js     → Rendering pipeline orchestration
  SWPath2D.js       → Path definition and command recording
  ClipMask.js       → Stencil-based clipping using BitBuffer composition
  SourceMask.js     → Source coverage tracking using BitBuffer and BoundsTracker composition
  StateStack.js     → Context state save/restore management
  Debug.js          → Debug assertions and logging utilities

src/utils/          → Shared utilities
  Point.js          → Immutable 2D point operations
  Rectangle.js      → Immutable rectangle operations
  BitBuffer.js      → 1-bit per pixel utility for memory-efficient mask operations
  BoundsTracker.js  → Reusable bounds tracking utility for optimization
  CompositeOperations.js → Porter-Duff composite blending operations
  ImageProcessor.js → Image format validation and conversion
  Validators.js     → Parameter validation utilities

src/paint/          → Paint sources
  Gradient.js       → Linear, radial, and conic gradient paint sources
  Pattern.js        → Repeating image pattern paint sources
  ColorParser.js    → CSS color string parsing

src/filters/        → Effects
  ShadowBuffer.js   → Sparse shadow alpha storage with extended bounds
  BoxBlur.js        → Multi-pass box blur algorithm approximating Gaussian blur
  ShadowPipeline.js → Shadow rendering pipeline coordination

src/io/             → File format encoders
  BitmapEncoder.js  → BMP file format encoding
  BitmapEncodingOptions.js → Immutable BMP encoding configuration
  PngEncoder.js     → PNG file format encoding with transparency
  PngEncodingOptions.js → Immutable PNG encoding configuration

src/renderers/      → Shape-Specific Direct Renderers (static utility classes)
  SpanOps.js        → Horizontal span fill utilities (shared by shape renderers)
  QuadScanOps.js    → Quadrilateral scanline DDA for thick lines and rotated fills
  RectOpsAA.js      → Axis-aligned rectangle direct rendering (fill, stroke)
  RectOpsRot.js     → Rotated rectangle direct rendering (fill, stroke)
  CircleOps.js      → Circle fill/stroke direct rendering (Bresenham, annulus rendering)
  ArcOps.js         → Arc fill/stroke direct rendering (partial arcs, pie slices, scanline event buffer)
  LineOps.js        → Line stroke direct rendering (Bresenham, polygon scan algorithm)
  RoundedRectOpsAA.js  → Axis-aligned rounded rectangle direct rendering
  RoundedRectOpsRot.js → Rotated rounded rectangle direct rendering
  RoundedRectUtils.js  → Shared utilities for rounded rectangle rendering
  PolygonFiller.js  → Scanline polygon filling with paint source support
  PathFlattener.js  → Converts paths to polygons
  StrokeGenerator.js → Geometric stroke path generation with line dashing
```

**Naming Convention:**
- `*Ops.js` - Direct shape rendering algorithms (static methods, no instance state)
- `*Filler.js` - Generic polygon rasterization with winding rules and paint sources
- `*Generator.js` - Geometric path generation (converts paths to stroke geometry)
- `*Flattener.js` - Curve decomposition (converts curves/arcs to line segments)
- `*Utils.js` - Shared utilities for related rendering classes

**Purpose**: Maximum performance graphics operations with zero overhead.

### Layer 2: HTML5 Compatibility (Familiarity)
```
src/compat/
  SWCanvasElement.js           → HTMLCanvasElement mimic
  CanvasCompatibleContext2D.js → CanvasRenderingContext2D mimic
```

**Purpose**: Familiar HTML5 Canvas API for web developers.

### Layer 3: Global API Organization
```
SWCanvas (namespace object) → API organizer, not a class
├── createCanvas()          → Factory returning SWCanvasElement
└── Core.*                  → Direct access to performance engine
```

**Purpose**: Clean namespace organization and environment abstraction.

## The Element/Context Split Pattern

HTML5 Canvas has a fundamental dual nature that SWCanvas preserves through architectural separation:

### Canvas Element Concerns (SWCanvasElement)
- **Dimensional Management**: `width`/`height` properties with automatic recreation
- **Context Factory**: `getContext('2d')` method
- **DOM Integration**: Element-like behavior for web compatibility
- **Surface Lifecycle**: Managing the underlying pixel buffer

### Context Concerns (CanvasCompatibleContext2D)
- **Drawing Operations**: `fillRect()`, `stroke()`, `fill()`, `drawImage()`
- **State Management**: `save()`/`restore()` stack
- **Style Properties**: `fillStyle`, `strokeStyle`, `lineWidth`
- **Shadow Properties**: `shadowColor`, `shadowBlur`, `shadowOffsetX`, `shadowOffsetY`
- **Paint Sources**: `createLinearGradient()`, `createRadialGradient()`, `createConicGradient()`, `createPattern()`
- **Transform Operations**: `translate()`, `rotate()`, `scale()`
- **Path Hit Testing**: `isPointInPath()`, `isPointInStroke()` with geometric accuracy
- **ImageData API**: `getImageData()`, `createImageData()`, `putImageData()`

This separation maintains the HTML5 Canvas conceptual model while enabling performance optimizations.

## Delegation Chain Pattern

All operations flow through a clear delegation chain:

```javascript
// User calls HTML5-style API
canvas.getContext('2d').fillStyle = 'red';

// Delegation chain:
SWCanvasElement.getContext('2d')               // Returns wrapper
  → CanvasCompatibleContext2D.set fillStyle() // Parses CSS color  
    → ColorParser.parse('red')                 // Converts to RGBA
      → Context2D.setFillStyle(255,0,0,255)   // Core rendering
        → Rasterizer pixel operations          // Actual drawing
```

This ensures that all rendering ultimately uses the same high-performance core engine, regardless of which API layer is used.

## Progressive Disclosure Design

The architecture implements **progressive disclosure** - users can engage at their appropriate complexity level:

### Level 1: Familiar Web Developer
```javascript
const canvas = SWCanvas.createCanvas(800, 600);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#FF0000';  // Familiar HTML5 Canvas API
ctx.fillRect(10, 10, 100, 100);
```

### Level 2: Performance-Conscious Developer
```javascript
const canvas = SWCanvas.createCanvas(800, 600);
const ctx = canvas.getContext('2d');
const coreCtx = ctx._coreContext;  // Drop to Core API
coreCtx.setFillStyle(255, 0, 0, 255);  // Skip CSS parsing
```

### Level 3: Engine-Level Control
```javascript
const surface = SWCanvas.Core.Surface(800, 600);
const ctx = new SWCanvas.Core.Context2D(surface);
const transform = new SWCanvas.Core.Transform2D().scale(2,2);
// Maximum performance, zero compatibility overhead
```

## API Surface Design

The final API provides exactly two access patterns:

### HTML5 Canvas-Compatible API
```javascript
SWCanvas.createCanvas(width, height) → SWCanvasElement
```
- Returns object with `width`, `height`, `getContext('2d')` 
- Full HTML5 Canvas 2D Context API compatibility
- CSS color parsing and string-based properties
- Automatic surface recreation on dimension changes

### Core API Namespace
```javascript
SWCanvas.Core.* → Direct access to all engine classes
```
**Core Classes:**
- `Surface()` - Raw pixel buffer factory
- `Context2D()` - High-performance rendering context
- `Transform2D()` - Immutable transformation matrices
- `SWPath2D()` - Path definition and command recording
- `StateStack()` - Context state save/restore management

**Value Objects:**
- `Point()`, `Rectangle()` - Immutable geometric value objects
- `Color()` - Immutable color handling

**Mask Classes:**
- `BitBuffer()` - 1-bit per pixel utility for efficient bit manipulation
- `BoundsTracker()` - Reusable bounds tracking utility for optimization
- `ClipMask()` - Stencil-based clipping using BitBuffer composition
- `SourceMask()` - Source coverage tracking using BitBuffer and BoundsTracker composition

**Paint Sources:**
- `Gradient()`, `LinearGradient()`, `RadialGradient()`, `ConicGradient()` - Gradient paint sources
- `Pattern()` - Repeating image pattern paint sources

**Effects:**
- `ShadowBuffer()` - Sparse shadow alpha storage with extended bounds and BoundsTracker composition
- `BoxBlur` - Multi-pass box blur algorithms (static methods)
- `ShadowPipeline` - Shadow rendering pipeline coordination

**File I/O:**
- `BitmapEncoder` - BMP file format export
- `BitmapEncodingOptions()` - Immutable BMP encoding configuration (Joshua Bloch patterns)
- `PngEncoder` - PNG file format encoding with transparency support
- `PngEncodingOptions()` - Immutable PNG encoding configuration

**Utilities:**
- `ImageProcessor` - Image format validation and conversion
- `CompositeOperations` - Porter-Duff blending operations
- `Validators` - Parameter validation utilities
- `Rasterizer` - Rendering pipeline orchestration
- `PathFlattener` - Converts paths to polygons
- `PolygonFiller` - Scanline polygon filling
- `StrokeGenerator` - Geometric stroke path generation
- `RoundedRectOpsAA` - Axis-aligned rounded rectangle rendering

**Debug:**
- `IS_DEBUG` - Debug mode flag
- `assertDebug()`, `debugLog()`, `debugWarn()` - Debug utilities

## Path Hit Testing System

SWCanvas implements complete geometric path hit testing through `isPointInPath()` and `isPointInStroke()` methods that provide accurate point-in-polygon and point-on-stroke detection.

### Geometric Implementation

- **`isPointInPath()`**: Uses polygon flattening and mathematical point-in-polygon algorithms supporting both `evenodd` and `nonzero` fill rules
- **`isPointInStroke()`**: Converts strokes to polygons using `StrokeGenerator`, then applies point-in-polygon testing with proper line cap, join, and dash pattern support
- **HTML5 Canvas compliance**: Invalid lineWidth values (zero, negative, Infinity, NaN) are ignored per specification
- **Transform awareness**: All hit testing operates in the correct coordinate space respecting current transformation matrix

### API Overloads

Both methods support the complete HTML5 Canvas API surface:
```javascript
// Test against current path
ctx.isPointInPath(x, y, fillRule?)
ctx.isPointInStroke(x, y)

// Test against external SWPath2D
ctx.isPointInPath(path, x, y, fillRule?)
ctx.isPointInStroke(path, x, y)
```

## Shadow Rendering System

SWCanvas implements a comprehensive shadow system that provides HTML5 Canvas-compatible shadow properties with high-performance rendering using sparse storage and multi-pass box blur.

### Dual-Buffer Shadow Pipeline

The shadow system uses a sophisticated dual-buffer rendering approach:

1. **Shape Rendering**: Draw the shape to a shadow buffer with alpha values
2. **Blur Application**: Apply box blur to the shadow buffer 
3. **Shadow Compositing**: Composite the blurred shadow to the main surface
4. **Shape Rendering**: Draw the original shape over the shadow

### Core Components

**ShadowBuffer Class** - Sparse shadow storage:
- **Extended bounds**: Accommodates blur overflow beyond original canvas dimensions
- **Sparse storage**: Uses "x,y" string keys to store only non-zero alpha values (memory efficient)
- **Bounds tracking**: Maintains bounding box of actual shadow data for optimization
- **Dense array conversion**: Converts to/from Float32Array for blur processing

**BoxBlur Class** - Multi-pass blur algorithm:
- **Gaussian approximation**: Uses 3-pass box blur to approximate Gaussian blur via Central Limit Theorem
- **Running sums**: Efficient O(1) per-pixel horizontal and vertical passes
- **Sigma calculation**: Automatically calculates box width from blur radius for correct standard deviation
- **Separable filtering**: Applies horizontal then vertical blur passes for optimal performance

### Shadow Properties

The system supports all four HTML5 Canvas shadow properties:

```javascript
// HTML5 Canvas-Compatible API
ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';  // CSS color strings
ctx.shadowBlur = 5;                      // Blur radius in pixels
ctx.shadowOffsetX = 3;                   // Horizontal offset
ctx.shadowOffsetY = 3;                   // Vertical offset

// Core API (explicit RGBA values)
ctx.setShadowColor(0, 0, 0, 128);        // Direct RGBA values (0-255)
ctx.shadowBlur = 5;                      
ctx.shadowOffsetX = 3;                   
ctx.shadowOffsetY = 3;                   
```

### Shadow Pipeline Integration

Shadows are integrated into all major drawing operations:
- **fillRect()**: Rectangle fills with shadow support
- **fill()**: Path fills with shadow support  
- **stroke()**: Path strokes with shadow support
- **drawImage()**: Image drawing with shadow support

### Paint Source Compatibility

Shadows work seamlessly with all paint sources:
- **Solid colors**: Standard shadow rendering
- **Linear gradients**: Gradient-filled shapes cast appropriately colored shadows
- **Radial gradients**: Radial gradient shapes cast shadows
- **Conic gradients**: Conic gradient shapes cast shadows
- **Patterns**: Pattern-filled shapes cast shadows

### Performance Optimizations

**Sparse Storage Efficiency**:
- Only non-zero alpha values are stored in memory
- Automatic bounds tracking minimizes processing area
- Dense array creation only for the minimal required region

**Blur Optimization**:
- Multi-pass box blur is more efficient than true Gaussian for most blur radii
- Separable filtering reduces complexity from O(r²) to O(r) per pixel
- Running sums provide O(1) per-pixel blur operations

**Opacity Calibration**:
- 8x opacity multiplier ensures shadow intensity matches HTML5 Canvas behavior
- Proper alpha blending with source-over compositing
- Premultiplied alpha handling for correct transparency

### State Management

Shadow properties are fully integrated into the context state stack:
- **save()/restore()**: Shadow properties saved and restored with other context state
- **Default values**: `shadowColor` defaults to transparent, other properties default to 0
- **Property validation**: Blur radius and offsets accept negative values per HTML5 Canvas specification

## Composite Operations System

SWCanvas implements a comprehensive Porter-Duff composite operations system that provides HTML5 Canvas-compatible blending modes with mathematically correct rendering.

### Dual Compositing Architecture

The system uses two distinct rendering paths based on operation characteristics:

**Source-bounded Operations** (process only source-covered pixels):
- `source-over`, `destination-over`, `destination-out`, `xor`
- Render directly during polygon filling
- Optimal performance for common operations

**Canvas-wide Operations** (require full-region compositing):
- `destination-atop`, `source-atop`, `source-in`, `destination-in`, `source-out`, `copy`
- Use source coverage masks and dual-pass rendering
- Correctly handle pixels outside source area

### XOR Operation Implementation

HTML5 Canvas XOR deviates from mathematical Porter-Duff XOR to provide intuitive visual results:

```javascript
// Mathematical Porter-Duff XOR: αo = αs + αd - 2*αs*αd (makes everything transparent)
// HTML5 Canvas XOR: Practical "bite" effect

case 'xor':
    if (srcAlpha === 0) {
        return destination;  // No source - show destination
    } else if (dstAlpha === 0) {
        return transparent;  // Source over transparent - disappears
    } else {
        return transparent;  // Source over opaque - both disappear (bite effect)
    }
```

This creates the expected "bite" visual where shapes disappear in overlap areas, exposing the original background.

### BMP Alpha Compositing

The BMP encoder handles semi-transparent pixels by compositing them over white background since BMP format doesn't support alpha channels:

```javascript
// Semi-transparent pixels are pre-composited for BMP export
const alpha = a / 255;
return {
    r: Math.round(r * alpha + 255 * (1 - alpha)),
    g: Math.round(g * alpha + 255 * (1 - alpha)), 
    b: Math.round(b * alpha + 255 * (1 - alpha))
};
```

This ensures BMP output accurately represents how semi-transparent elements would appear when rendered.

### Implementation Components

- **CompositeOperations.js**: Core blending logic with HTML5 Canvas behavior matching
- **SourceMask.js**: Tracks source coverage for canvas-wide operations
- **Rasterizer.js**: Determines source-bounded vs canvas-wide operation routing
- **BitmapEncoder.js**: Handles alpha compositing during export

### Special Case Implementations

**clearRect Architecture**: The `clearRect` operation bypasses the standard composite operation pipeline to avoid global compositing issues. Instead of using the `copy` composite operation (which would affect the entire surface), `clearRect` uses direct pixel manipulation through `Context2D._clearRectDirect()`. This approach:

- Preserves pixels outside the specified rectangle
- Handles both axis-aligned and transformed rectangles
- Respects active clipping masks
- Avoids the performance overhead of global compositing for a localized operation

This architectural decision ensures HTML5 Canvas compatibility while maintaining optimal performance for rectangle clearing operations.

## Interoperability Bridges

The architecture provides seamless interoperability between layers:

### Bridge Access Points
```javascript
// From HTML5 API to Core API
const canvas = SWCanvas.createCanvas(800, 600);
const coreSurface = canvas._coreSurface;                // Access Core Surface
const coreContext = canvas.getContext('2d')._coreContext; // Access Core Context

// From Core API to HTML5 API  
const surface = SWCanvas.Core.Surface(800, 600);
const imageData = { width: 800, height: 600, data: surface.data };
// Use as ImageLike object with canvas.getContext('2d').drawImage()
```

## Architectural Benefits

### Paradigm Bridge
- **Web standards compliance** through HTML5 Canvas compatibility layer
- **Performance optimization** through Core direct access
- **Clean organization** through namespaced factory pattern
- **Progressive enhancement** - use complexity level you need

### No Lock-in
- Start with HTML5 API, optimize incrementally to Core API
- Mixed usage patterns supported (HTML5 setup, Core hot loops)
- Migration path preserves existing code investment
- All APIs share same rendering engine - no duplication

### Development Flexibility
- **Web developers**: Familiar HTML5 Canvas patterns
- **Game developers**: Direct performance-oriented APIs  
- **Library developers**: Clean namespace organization
- **Mixed teams**: Can use different APIs in same codebase

## Implementation Principles

The architecture follows several key design principles:

### Single Responsibility
- Each layer handles specific concerns (compatibility vs performance vs organization)
- Clear boundaries between element management and drawing operations
- Immutable value objects for mathematical operations

### Composition over Inheritance
- Classes use each other rather than extending from base classes
- Delegation pattern maintains clean interfaces
- Bridge pattern connects disparate paradigms

### Defensive Programming
- Comprehensive parameter validation at layer boundaries
- Immutable objects prevent accidental state mutations
- Clear error messages guide developers to correct usage

### Joshua Bloch Effective Java Patterns
The codebase implements several key patterns from Joshua Bloch's Effective Java:

- **Static Factory Methods** (`BitmapEncodingOptions.withBackgroundColor()`) - Item 1: Provide clear, self-documenting APIs
- **Immutable Objects** (`BitmapEncodingOptions`, `Color`, `Transform2D`) - Item 17: Minimize mutability for thread safety and prevent bugs
- **Builder Pattern Alternative** (`BitmapEncodingOptions`) - Item 2: Use static factory methods for complex configuration
- **Parameter Validation** (all constructors) - Item 49: Check parameters for validity and fail fast with clear messages

## Composition Patterns for Utility Classes

SWCanvas implements sophisticated composition patterns following Joshua Bloch's **Item 18: "Favor composition over inheritance"** principle to eliminate code duplication while maintaining clear separation of concerns.

### BitBuffer Composition Pattern

The first composition pattern addresses bit manipulation code duplication:

#### The Problem: Similar Implementation, Different Semantics

`ClipMask` and `SourceMask` shared significant bit manipulation code but represented fundamentally different abstractions:

- **ClipMask**: Controls which pixels **can be rendered** (default: all visible, 1s)
- **SourceMask**: Tracks which pixels **have been covered** by drawing operations (default: none covered, 0s)

#### The Solution: BitBuffer Composition Component

Instead of forced inheritance (which would violate the Liskov Substitution Principle), SWCanvas uses **composition with a utility class**:

```javascript
// BitBuffer: Reusable bit manipulation utility
class BitBuffer {
    constructor(width, height, defaultValue) { /* configurable defaults */ }
    getPixel(x, y) { /* common bit operations */ }
    setPixel(x, y, value) { /* common bit operations */ }
    // ... shared implementation
}

// ClipMask: Composed with BitBuffer, clipping-specific behavior
class ClipMask {
    constructor(width, height) {
        this._bitBuffer = new BitBuffer(width, height, 1); // Default: visible
    }
    
    intersectWith(other) { /* clipping-specific logic */ }
    hasClipping() { /* clipping-specific logic */ }
    // Delegates basic operations to BitBuffer
}

// SourceMask: Composed with BitBuffer, coverage-tracking behavior  
class SourceMask {
    constructor(width, height) {
        this._bitBuffer = new BitBuffer(width, height, 0); // Default: not covered
        this._bounds = { /* bounds tracking */ };
    }
    
    getBounds() { /* coverage-specific logic */ }
    getIterationBounds() { /* coverage-specific logic */ }
    // Delegates basic operations to BitBuffer
}
```

#### Benefits of BitBuffer Composition

1. **Code Reuse Without Inheritance**: Eliminates 200+ lines of duplicated bit manipulation code
2. **Clear Separation of Concerns**: BitBuffer handles bits, masks handle domain logic
3. **No LSP Violations**: ClipMask and SourceMask maintain their distinct semantics
4. **Flexible Design**: Easy to add new mask types or modify bit operations independently
5. **Better Testability**: Can test bit operations and mask logic separately
6. **Joshua Bloch Compliance**: Follows effective OO design patterns

### BoundsTracker Composition Pattern

The second composition pattern addresses bounds tracking code duplication:

#### The Problem: Duplicated Bounds Logic

`SourceMask` and `ShadowBuffer` contained nearly identical bounds tracking implementations:

- **SourceMask**: Tracks bounds of covered pixels for rendering optimization
- **ShadowBuffer**: Tracks bounds of shadow data for blur processing optimization

Both implemented identical:
- `_bounds` object structure with minX, maxX, minY, maxY, isEmpty
- `updateBounds()` logic for expanding bounds to include new points
- `getBounds()` method for retrieving current bounds
- Bounds reset and cloning operations

#### The Solution: BoundsTracker Composition Component

```javascript
// BoundsTracker: Reusable bounds tracking utility
class BoundsTracker {
    constructor() { /* bounds initialization */ }
    updateBounds(x, y) { /* expand bounds logic */ }
    getBounds() { /* return bounds copy */ }
    reset() { /* reset to empty */ }
    // ... additional utility methods
}

// SourceMask: Composed with BitBuffer + BoundsTracker
class SourceMask {
    constructor(width, height) {
        this._bitBuffer = new BitBuffer(width, height, 0);
        this._boundsTracker = new BoundsTracker();
    }
    
    setPixel(x, y, covered) {
        // ... update bit buffer
        if (covered && !wasCovered) {
            this._boundsTracker.updateBounds(x, y);
        }
    }
    
    getBounds() { return this._boundsTracker.getBounds(); }
}

// ShadowBuffer: Composed with BoundsTracker (different data storage)
class ShadowBuffer {
    constructor(width, height, maxBlurRadius) {
        this._alphaData = {}; // Sparse float storage
        this._boundsTracker = new BoundsTracker();
    }
    
    addAlpha(x, y, alpha) {
        // ... update alpha data
        this._boundsTracker.updateBounds(x, y);
    }
    
    getBounds() { return this._boundsTracker.getBounds(); }
}
```

#### Benefits of BoundsTracker Composition

1. **Eliminates Code Duplication**: Removes ~40 lines of identical bounds tracking code
2. **Single Source of Truth**: Bounds logic centralized and consistently implemented
3. **Preserves Architectural Boundaries**: ShadowBuffer remains independent from BitBuffer (different data types)
4. **Consistent Patterns**: Follows same composition approach as BitBuffer utility
5. **Enhanced Maintainability**: Bounds tracking bugs fixed once, benefits all consumers
6. **Future Extensibility**: Other classes can easily adopt bounds tracking functionality

### Implementation Details

- **BoundsTracker**: Comprehensive utility with parameter validation, helper methods, and proper encapsulation
- **Memory Efficiency**: Minimal overhead, optimized for frequent updates
- **Performance**: No degradation compared to original implementations  
- **API Compatibility**: All existing bounds APIs preserved unchanged
- **Testability**: Bounds logic thoroughly testable in isolation

### Why Not Force Further Composition?

**ShadowBuffer does NOT use BitBuffer** because they represent fundamentally incompatible abstractions:

- **Data Types**: BitBuffer handles binary (1-bit), ShadowBuffer handles float (0-1 alpha)
- **Storage Strategies**: BitBuffer uses dense bit-packed arrays, ShadowBuffer uses sparse hashmaps
- **Coordinate Systems**: BitBuffer uses original coordinates, ShadowBuffer uses extended coordinates

Forcing composition would violate Item 51: "Make interfaces easy to use correctly and hard to use incorrectly."

These composition patterns demonstrate how to systematically eliminate code duplication through clean object-oriented design while respecting fundamental differences between abstractions.

## Shape-Specific Direct Renderers

SWCanvas implements a **static utility class pattern** (following the existing `PolygonFiller` approach) to organize shape-specific rendering optimizations into maintainable, testable modules.

See `DIRECT-RENDERING-SUMMARY.MD` for complete direct rendering implementation details, API reference, and performance characteristics.

### The Problem: Context2D Complexity

With direct rendering methods for many shapes, placing all methods in `Context2D.js` would create a large file with shape-specific methods scattered throughout:
- Rectangle direct rendering 400+ lines from `strokeRect()`
- Circle methods spanning 900+ lines
- Line methods spanning 400+ lines
- Shared span utilities duplicated across methods

### The Solution: Static Utility Classes

Extract shape-specific rendering into static utility classes that:
1. Follow the existing `PolygonFiller` pattern (static methods, no instance state)
2. Receive all required state as parameters
3. Maintain fast performance (one extra property lookup per call - negligible)
4. Enable isolated testing of rendering algorithms

### Architecture

Context2D dispatches to shape-specific renderer classes based on transform state:

```
Context2D                              # Orchestration and state management
├── fillRect/strokeRect ─────────────→ RectOpsAA.*_AA_*()     [axis-aligned]
│                                    → RectOpsRot.*_Rot_*()   [rotated]
├── fillCircle/strokeCircle ─────────→ CircleOps.*()
├── strokeLine ──────────────────────→ LineOps.stroke_Any()
├── fillArc/strokeArc ───────────────→ ArcOps.*()
└── fillRoundRect/strokeRoundRect ───→ RoundedRectOpsAA.*_AA_*()  [axis-aligned]
                                     → RoundedRectOpsRot.*_Rot_*() [rotated]
```

### Static Utility Classes

| Class | Purpose |
|-------|---------|
| **SpanOps** | Shared horizontal span filling (foundation for all shape renderers) |
| **QuadScanOps** | Quadrilateral scanline fill (used by LineOps, RectOpsRot) |
| **RectOpsAA** | Axis-aligned rectangle fill and stroke |
| **RectOpsRot** | Rotated rectangle fill and stroke |
| **CircleOps** | Circle fill and stroke (rotation-invariant) |
| **LineOps** | Line stroke (Bresenham thin, polygon scan thick) |
| **ArcOps** | Partial arc fill and stroke |
| **RoundedRectOpsAA** | Axis-aligned rounded rectangle fill and stroke |
| **RoundedRectOpsRot** | Rotated rounded rectangle fill and stroke |

**Method naming convention**: `{operation}[Thickness]_{orientation}_{opacity}`
- Orientation: `AA` (axis-aligned) or `Rot` (rotated)
- Opacity: `Opaq`, `Alpha`, or `Any` (handles both)

For complete API reference with method signatures, conditions, and algorithms, see **DIRECT-RENDERING-SUMMARY.MD**.

### Benefits

1. **Reduced Context2D Size**: ~47% reduction (2,609 → 1,378 lines)
2. **Maintainability**: Shape-specific code isolated by shape type
3. **Testability**: Rendering algorithms can be tested in isolation
4. **Performance**: Static methods have negligible overhead vs instance methods
5. **Consistency**: Follows existing `PolygonFiller` pattern in codebase
6. **Discoverability**: Related methods grouped together by namespace

### Build Order Dependencies

The shape ops classes depend on `Surface` and are loaded in Phase 1.5 of the build:
```bash
# Phase 1.5: Shape rendering operations (depend on Surface)
cat src/renderers/SpanOps.js >> dist/swcanvas.js
cat src/renderers/QuadScanOps.js >> dist/swcanvas.js
cat src/renderers/RectOpsRot.js >> dist/swcanvas.js
cat src/renderers/RectOpsAA.js >> dist/swcanvas.js
cat src/renderers/CircleOps.js >> dist/swcanvas.js
cat src/renderers/ArcOps.js >> dist/swcanvas.js
cat src/renderers/LineOps.js >> dist/swcanvas.js
cat src/renderers/RoundedRectOpsRot.js >> dist/swcanvas.js
cat src/renderers/RoundedRectOpsAA.js >> dist/swcanvas.js
```

## Clipping Invariant: "Check Once, Check Correctly"

SWCanvas enforces that every pixel write path checks clipping **EXACTLY ONCE**. This invariant prevents both security holes (missing checks) and performance waste (redundant checks).

### Layer Responsibilities

| Layer | Clipping Responsibility | Bounds Responsibility | Example Methods |
|-------|------------------------|----------------------|-----------------|
| **Inline Markers** | NONE - caller must check | NONE - caller must check | `BLEND_ALPHA`, `SET_OPAQUE` |
| **SpanOps** | YES - primary checkpoint | NONE - caller must clamp | `fill_Opaq()`, `fill_Alpha()` |
| **Shape *Ops** | Delegate OR inline (never both) | YES - clamp before SpanOps | See method `@param` annotations |

### The Two Rendering Paths

**Path A: Span-Based Rendering** (most fills, thick strokes)
```
Shape renderer → clamp bounds → SpanOps.fill_* → clipBuffer check → pixel write
```
- Callers MUST clamp coordinates to canvas bounds BEFORE calling SpanOps
- SpanOps handles clipping with byte-skip optimization
- SpanOps TRUSTS that bounds are valid (debug assertions verify in development)

**Path B: Per-Pixel Rendering** (1px strokes, Bresenham lines)
```
Shape renderer → inline clipBuffer check → BLEND_ALPHA/SET_OPAQUE inline marker
```
- Shape renderer checks clipping inline before each pixel
- Inline markers have NO clipping responsibility (caller must check first)

### Rules for New Code

1. **Using SpanOps?** → Clamp bounds BEFORE calling, pass `clipBuffer`, do NOT pre-check clipping
2. **Writing pixels directly?** → Check bounds AND `clipBuffer` inline before each write
3. **Never** check clipping then call something that also checks
4. **Document** clipping responsibility in `@param` JSDoc using one of:
   - `(CLIPPING: delegated to SpanOps)`
   - `(CLIPPING: checked inline per-pixel)`
   - `(CLIPPING: delegated to QuadScanOps)` etc.

### SpanOps Bounds Contract

SpanOps methods TRUST that callers provide valid coordinates:
- `y` must be in `[0, surfaceHeight)`
- `startX` must be in `[0, surfaceWidth)`
- `startX + length` must be `<= surfaceWidth`
- `length` must be `> 0`

**Rationale:** Clamping operations should happen ONLY ONCE for clarity and architectural principle. Callers have the best context to clamp bounds BEFORE a potentially unnecessary call to SpanOps is made. This enables early-exit optimizations when spans are entirely off-screen.

**Development verification:** Debug assertions in SpanOps throw descriptive errors if bounds are violated. Enable with `globalThis.__SWCANVAS_DEBUG__ = true`.

**Example clamping pattern (from CircleOps):**
```javascript
// Clamp X coordinates to canvas bounds to prevent memory wrap-around
const clampedStartX = Math.max(0, abs_x_min);
const clampedEndX = Math.min(width - 1, abs_x_max);
const spanWidth = clampedEndX - clampedStartX + 1;

// Skip if span is entirely off-screen
if (spanWidth <= 0) continue;

// Y bounds check before calling SpanOps
if (abs_y_bottom >= 0 && abs_y_bottom < height) {
    SpanOps.fill_Opaq(data32, width, height, clampedStartX, abs_y_bottom, spanWidth, packedColor, clipBuffer);
}
```

### Standard Clipping Check Pattern

All inline clipping checks use this consistent bit-check pattern:
```javascript
if (!clipBuffer || (clipBuffer[pixelIndex >> 3] & (1 << (pixelIndex & 7)))) {
    // Pixel is visible - proceed with write
}
```

### Verification

Enable debug assertions in development to catch clipping contract violations:
```javascript
globalThis.__SWCANVAS_DEBUG__ = true;
// Then load SWCanvas
```

## Build-Time Preprocessing

SWCanvas uses a build-time preprocessor to inline performance-critical pixel operations, eliminating function call overhead in hot loops while maintaining a single source of truth for blending formulas.

### Why Preprocessing?

Static method calls incur function call overhead (stack frame, argument passing, return) that V8 doesn't always optimize away. For operations that are only ~10 arithmetic ops, this overhead is significant. Build-time inlining eliminates it while keeping a single source of truth for the blending formula.

### Chained Template Expansion

The preprocessor supports **nested/chained templates** - templates can reference other templates via inline markers. This eliminates code duplication while maintaining identical output. The preprocessor performs multi-pass expansion until no markers remain, with configurable depth protection (default 10 passes) to prevent infinite loops from circular references.

**Template Hierarchy:**
```
Level 0 (Base):     SET_OPAQUE, BLEND_ALPHA
Level 1 (Clipped):  SET_OPAQUE_CLIPPED → SET_OPAQUE
                    BLEND_ALPHA_CLIPPED → BLEND_ALPHA
Level 2 (Arc):      SET_OPAQUE_ARC_FAST_CLIPPED → SET_OPAQUE_CLIPPED
                    BLEND_ALPHA_ARC_FAST_CLIPPED → BLEND_ALPHA_CLIPPED
```

This architecture reduces template code by ~50% while ensuring all derived templates stay synchronized with base template changes.

### Marker Syntax

Source files use inline markers that are expanded during the build:

```javascript
/*@inline:TEMPLATE_NAME(arg1, arg2, ...)*/
```

Arguments can be expressions (e.g., `pos * 4`, `idx/4`). Templates can contain nested markers that are expanded in subsequent passes.

### Available Templates

| Template | Parameters | Purpose |
|----------|------------|---------|
| `BLEND_ALPHA` | `data, pixelIndex, r, g, b, alpha, invAlpha` | Porter-Duff source-over blending |
| `SET_OPAQUE` | `data32, pixelIndex, packedColor` | Direct 32-bit pixel write |
| `BLEND_ALPHA_CLIPPED` | `data, pixelIndex, r, g, b, alpha, invAlpha, clipBuffer` | Alpha blending with inline clipping |
| `SET_OPAQUE_CLIPPED` | `data32, pixelIndex, packedColor, clipBuffer` | Opaque write with inline clipping |
| `SET_OPAQUE_ARC_FAST_CLIPPED` | `data32, packedColor, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height` | Opaque write with cross-product angle check + bounds + clipping for arcs |
| `BLEND_ALPHA_ARC_FAST_CLIPPED` | `data, r, g, b, alpha, invAlpha, clipBuffer, dx, dy, startCos, startSin, endCos, endSin, isLargeArc, px, py, width, height` | Alpha blending with cross-product angle check + bounds + clipping for arcs |

### Clipping Contract

Templates follow three contracts based on their use case:

**Standard Templates** (`BLEND_ALPHA`, `SET_OPAQUE`):
- Do NOT check clipping - caller must check `clipBuffer` BEFORE the marker
- Used with span-based rendering where clipping is handled by SpanOps

**Clipped Templates** (`BLEND_ALPHA_CLIPPED`, `SET_OPAQUE_CLIPPED`):
- Include clipping check internally: `if (!clipBuffer || (clipBuffer[pos >> 3] & (1 << (pos & 7))))`
- Used in per-pixel loops where clipping cannot be hoisted to span level
- Bounds checking remains caller's responsibility

**Arc Templates** (`SET_OPAQUE_ARC_FAST_CLIPPED`, `BLEND_ALPHA_ARC_FAST_CLIPPED`):
- Include angle range check + bounds check + clipping check
- Use fast cross-product angle checking (10-50x faster than atan2)
- Include bounds checking and compute pixelIndex internally
- Used in `ArcOps.stroke1px_Opaq()` and `ArcOps.stroke1px_Alpha()` for Bresenham arc rendering

All contracts uphold the "Check Once, Check Correctly" invariant - clipping is checked exactly once per pixel write.

### Template Definitions

Templates are defined in `build-scripts/preprocess.js`. Local variables use `__` prefix to avoid conflicts with caller variables.

Derived templates (Level 1+) use nested markers to reference base templates:
```javascript
// BLEND_ALPHA_CLIPPED references BLEND_ALPHA via nested marker
'BLEND_ALPHA_CLIPPED': {
    params: ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer'],
    code: `if (!{{clipBuffer}} || ...) {
    /*@inline:BLEND_ALPHA({{data}}, {{pixelIndex}}, {{r}}, {{g}}, {{b}}, {{alpha}}, {{invAlpha}})*/
}`
}
```

The `preprocess()` function accepts an optional `maxDepth` parameter (default 10) for depth protection.

### Build Integration

The build process:
1. Preprocesses source files containing markers to `.preprocessed/`
2. Uses preprocessed versions during concatenation
3. Final `dist/swcanvas.js` contains no markers (all expanded)

### Example Expansion

**Source (SpanOps.js):**
```javascript
/*@inline:BLEND_ALPHA(data, pixelIndex, r, g, b, alpha, invAlpha)*/
```

**Expands to (dist/swcanvas.js):**
```javascript
{
    const __off = (pixelIndex) * 4;
    const __dstA = data[__off + 3] / 255;
    const __dstAScaled = __dstA * (invAlpha);
    const __outA = (alpha) + __dstAScaled;
    if (__outA > 0) {
        const __blend = 1 / __outA;
        data[__off]     = ((r) * (alpha) + data[__off] * __dstAScaled) * __blend;
        data[__off + 1] = ((g) * (alpha) + data[__off + 1] * __dstAScaled) * __blend;
        data[__off + 2] = ((b) * (alpha) + data[__off + 2] * __dstAScaled) * __blend;
        data[__off + 3] = __outA * 255;
    }
}
```

This architecture represents a **paradigm bridge** that successfully unifies web standards compliance, performance optimization, and clean API design in a single coherent system.