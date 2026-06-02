// Test: isPointInPath API validation
// This file will be concatenated into the main core test suite

// Test 035
test('isPointInPath API overload handling', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    // Create a simple rectangular path
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test 2-argument form: isPointInPath(x, y)
    assertEquals(ctx.isPointInPath(100, 100), true); // Inside
    assertEquals(ctx.isPointInPath(25, 25), false); // Outside
    
    // Test 3-argument form: isPointInPath(x, y, fillRule)  
    assertEquals(ctx.isPointInPath(100, 100, 'nonzero'), true);
    assertEquals(ctx.isPointInPath(100, 100, 'evenodd'), true);
    assertEquals(ctx.isPointInPath(25, 25, 'nonzero'), false);
    
    // Test 3-argument form: isPointInPath(path, x, y)
    const path = new SWCanvas.Core.SWPath2D();
    path.rect(10, 10, 50, 50);
    assertEquals(ctx.isPointInPath(path, 35, 35), true); // Inside path
    assertEquals(ctx.isPointInPath(path, 100, 100), false); // Outside path
    
    // Test 4-argument form: isPointInPath(path, x, y, fillRule)
    assertEquals(ctx.isPointInPath(path, 35, 35, 'nonzero'), true);
    assertEquals(ctx.isPointInPath(path, 35, 35, 'evenodd'), true);
    assertEquals(ctx.isPointInPath(path, 100, 100, 'evenodd'), false);
});

// Test 035b
test('isPointInPath parameter validation', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test non-number coordinates - should return false
    assertEquals(ctx.isPointInPath('100', 100), false);
    assertEquals(ctx.isPointInPath(100, '100'), false);
    assertEquals(ctx.isPointInPath(NaN, 100), false);
    assertEquals(ctx.isPointInPath(100, NaN), false);
    
    // Test empty path - should return false
    const emptyPath = new SWCanvas.Core.SWPath2D();
    assertEquals(ctx.isPointInPath(emptyPath, 100, 100), false);
    
    // Test invalid argument count - should throw TypeError
    assertThrows(() => {
        ctx.isPointInPath();
    }, 'TypeError');
    
    assertThrows(() => {
        ctx.isPointInPath(100);
    }, 'TypeError');
    
    assertThrows(() => {
        ctx.isPointInPath(100, 100, 'evenodd', 'extra');
    }, 'TypeError');
});

// Test 035c
test('isPointInPath fill rule behavior', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    // Create a path with a hole (outer rect with inner rect)
    const pathWithHole = new SWCanvas.Core.SWPath2D();
    pathWithHole.rect(0, 0, 100, 100);    // Outer rectangle
    pathWithHole.rect(25, 25, 50, 50);    // Inner rectangle (hole)
    
    // Point in the hole area
    const holeX = 50, holeY = 50;
    
    // With evenodd rule, hole should be empty (outside)
    assertEquals(ctx.isPointInPath(pathWithHole, holeX, holeY, 'evenodd'), false);
    
    // With nonzero rule, depends on winding direction
    // Since both rectangles have same winding, point should be inside
    assertEquals(ctx.isPointInPath(pathWithHole, holeX, holeY, 'nonzero'), true);
    
    // Point definitely outside both rectangles
    assertEquals(ctx.isPointInPath(pathWithHole, 150, 150, 'evenodd'), false);
    assertEquals(ctx.isPointInPath(pathWithHole, 150, 150, 'nonzero'), false);
});

// Test 035d
test('isPointInPath HTML5 Canvas compatibility API', () => {
    const canvas = SWCanvas.createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    
    // Test method exists and works
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test basic functionality
    assertEquals(ctx.isPointInPath(100, 100), true);
    assertEquals(ctx.isPointInPath(25, 25), false);
    
    // Test with external path
    const path = new SWCanvas.Core.SWPath2D();
    path.rect(10, 10, 30, 30);
    assertEquals(ctx.isPointInPath(path, 25, 25), true);
    assertEquals(ctx.isPointInPath(path, 50, 50), false);
});

// Test 035e  
test('isPointInPath bakes the build-time transform (current default path)', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);

    // Per the HTML5 spec the current default path bakes the CTM at build time. The
    // rect is built under identity, so the later translate() does NOT move it — the
    // (canvas-space) query point is tested against the rect where it was built.
    ctx.beginPath();
    ctx.rect(0, 0, 50, 50);
    ctx.translate(50, 50);

    assertEquals(ctx.isPointInPath(25, 25), true); // inside the baked rect (0,0,50,50)
    assertEquals(ctx.isPointInPath(75, 75), false); // where a translated copy would be — not baked

    // Building UNDER a transform bakes that transform into the geometry.
    ctx.beginPath();
    ctx.rect(0, 0, 50, 50); // CTM is translate(50,50) → baked at (50,50)-(100,100)
    assertEquals(ctx.isPointInPath(75, 75), true); // inside the baked-under-translate rect
    assertEquals(ctx.isPointInPath(25, 25), false); // origin no longer covered
});