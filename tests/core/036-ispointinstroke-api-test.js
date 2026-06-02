// Test: isPointInStroke API validation
// This file will be concatenated into the main core test suite

// Test 036
test('isPointInStroke API overload handling', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    // Set stroke properties for testing
    ctx.lineWidth = 10;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    
    // Create a simple rectangular path
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test 2-argument form: isPointInStroke(x, y)
    assertEquals(ctx.isPointInStroke(45, 100), true); // On left edge of stroke
    assertEquals(ctx.isPointInStroke(155, 100), true); // On right edge of stroke 
    assertEquals(ctx.isPointInStroke(100, 45), true); // On top edge of stroke
    assertEquals(ctx.isPointInStroke(100, 155), true); // On bottom edge of stroke
    assertEquals(ctx.isPointInStroke(25, 25), false); // Outside stroke
    assertEquals(ctx.isPointInStroke(100, 100), false); // Inside path but not in stroke
    
    // Test 3-argument form: isPointInStroke(path, x, y)
    const path = new SWCanvas.Core.SWPath2D();
    path.rect(10, 10, 50, 50);
    assertEquals(ctx.isPointInStroke(path, 5, 35), true); // On left edge of stroke
    assertEquals(ctx.isPointInStroke(path, 65, 35), true); // On right edge of stroke
    assertEquals(ctx.isPointInStroke(path, 35, 5), true); // On top edge of stroke
    assertEquals(ctx.isPointInStroke(path, 35, 65), true); // On bottom edge of stroke
    assertEquals(ctx.isPointInStroke(path, 35, 35), false); // Inside path but not in stroke
    assertEquals(ctx.isPointInStroke(path, 100, 100), false); // Outside stroke
});

// Test 036b
test('isPointInStroke parameter validation', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test non-number coordinates - should return false
    assertEquals(ctx.isPointInStroke('100', 100), false);
    assertEquals(ctx.isPointInStroke(100, '100'), false);
    assertEquals(ctx.isPointInStroke(NaN, 100), false);
    assertEquals(ctx.isPointInStroke(100, NaN), false);
    
    // Test empty path - should return false
    const emptyPath = new SWCanvas.Core.SWPath2D();
    assertEquals(ctx.isPointInStroke(emptyPath, 100, 100), false);
    
    // Test invalid argument count - should throw TypeError
    assertThrows(() => {
        ctx.isPointInStroke();
    }, 'TypeError');
    
    assertThrows(() => {
        ctx.isPointInStroke(100);
    }, 'TypeError');
    
    assertThrows(() => {
        ctx.isPointInStroke(100, 100, 'evenodd', 'extra');
    }, 'TypeError');
    
    // Test invalid path object - should throw TypeError
    assertThrows(() => {
        ctx.isPointInStroke({}, 100, 100);
    }, 'TypeError');
    
    assertThrows(() => {
        ctx.isPointInStroke(null, 100, 100);
    }, 'TypeError');
});

// Test 036c
test('isPointInStroke stroke properties', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    // Create a simple line path
    const path = new SWCanvas.Core.SWPath2D();
    path.moveTo(50, 100);
    path.lineTo(150, 100);
    
    // Test different stroke widths
    ctx.lineWidth = 1;
    assertEquals(ctx.isPointInStroke(path, 100, 99.5), true); // Just inside thin stroke
    assertEquals(ctx.isPointInStroke(path, 100, 98), false); // Outside thin stroke
    
    ctx.lineWidth = 20;
    assertEquals(ctx.isPointInStroke(path, 100, 90), true); // Inside thick stroke
    assertEquals(ctx.isPointInStroke(path, 100, 80), false); // Outside thick stroke
    
    // Test HTML5 Canvas compliance: zero width should be ignored (keep previous lineWidth=20)
    const previousWidth = ctx.lineWidth; // Should be 20 from above
    ctx.lineWidth = 0; // This should be ignored per HTML5 Canvas spec
    assertEquals(ctx.lineWidth, previousWidth); // lineWidth should remain unchanged
    assertEquals(ctx.isPointInStroke(path, 100, 90), true); // Inside thick stroke (lineWidth=20)
    assertEquals(ctx.isPointInStroke(path, 100, 80), false); // Outside thick stroke
});

// Test 036d
test('isPointInStroke line caps and joins', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    ctx.lineWidth = 10;
    
    // Test line caps with open path
    const openPath = new SWCanvas.Core.SWPath2D();
    openPath.moveTo(50, 100);
    openPath.lineTo(100, 100);
    
    // Test butt caps (default)
    ctx.lineCap = 'butt';
    assertEquals(ctx.isPointInStroke(openPath, 45, 100), false); // Beyond butt cap
    assertEquals(ctx.isPointInStroke(openPath, 105, 100), false); // Beyond butt cap
    
    // Test square caps
    ctx.lineCap = 'square';
    assertEquals(ctx.isPointInStroke(openPath, 45, 100), true); // Within square cap extension
    assertEquals(ctx.isPointInStroke(openPath, 105, 100), true); // Within square cap extension
    
    // Test round caps  
    ctx.lineCap = 'round';
    assertEquals(ctx.isPointInStroke(openPath, 47, 97), true); // Within round cap
    assertEquals(ctx.isPointInStroke(openPath, 103, 97), true); // Within round cap
});

// Test 036e
test('isPointInStroke line dash patterns', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    ctx.lineWidth = 5;
    
    // Create a longer horizontal line for dash testing
    const path = new SWCanvas.Core.SWPath2D();
    path.moveTo(20, 100);
    path.lineTo(180, 100);
    
    // Test solid line (no dashing)
    ctx.setLineDash([]);
    assertEquals(ctx.isPointInStroke(path, 100, 100), true); // Middle of solid line
    
    // Test dashed line
    ctx.setLineDash([20, 10]); // 20px dash, 10px gap
    ctx.lineDashOffset = 0;
    
    // Points in dash segments should be true, points in gaps should be false
    assertEquals(ctx.isPointInStroke(path, 30, 100), true); // In first dash (20-40)
    assertEquals(ctx.isPointInStroke(path, 45, 100), false); // In first gap (40-50)
    assertEquals(ctx.isPointInStroke(path, 60, 100), true); // In second dash (50-70)
    assertEquals(ctx.isPointInStroke(path, 75, 100), false); // In second gap (70-80)
    
    // Test with dash offset
    ctx.lineDashOffset = 10;
    // This shifts the pattern by 10px, starting 10px into the pattern cycle
    // So we get: remaining 10px of first dash (20-30), then 10px gap (30-40), then 20px dash (40-60)
    assertEquals(ctx.isPointInStroke(path, 25, 100), true); // In remaining dash segment (20-30)
    assertEquals(ctx.isPointInStroke(path, 35, 100), false); // In gap (30-40)
    assertEquals(ctx.isPointInStroke(path, 50, 100), true); // In dash (40-60)
});

// Test 036f
test('isPointInStroke HTML5 Canvas compatibility API', () => {
    const canvas = SWCanvas.createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    
    ctx.lineWidth = 8;
    
    // Test method exists and works
    ctx.beginPath();
    ctx.rect(50, 50, 100, 100);
    
    // Test basic functionality
    assertEquals(ctx.isPointInStroke(46, 100), true); // On stroke edge
    assertEquals(ctx.isPointInStroke(100, 100), false); // Inside path, not in stroke
    assertEquals(ctx.isPointInStroke(25, 25), false); // Outside stroke
    
    // Test with external path
    const path = new SWCanvas.Core.SWPath2D();
    path.rect(10, 10, 30, 30);
    assertEquals(ctx.isPointInStroke(path, 6, 25), true); // On stroke edge
    assertEquals(ctx.isPointInStroke(path, 25, 25), false); // Inside path, not in stroke
    assertEquals(ctx.isPointInStroke(path, 100, 100), false); // Outside stroke
});

// Test 036g
test('isPointInStroke bakes the build-time transform (current default path)', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);

    ctx.lineWidth = 10;

    // Built under identity, then translated: the baked stroke stays at (0,0,50,50)
    // with a 10px pen (extends 5px either side of each edge). The pen width is
    // interpreted in draw-time user space; here drawT is a pure translate (scale 1).
    ctx.beginPath();
    ctx.rect(0, 0, 50, 50);
    ctx.translate(50, 50);

    assertEquals(ctx.isPointInStroke(0, 25), true); // centered on the baked left edge (x≈0)
    assertEquals(ctx.isPointInStroke(50, 25), true); // centered on the baked right edge (x≈50)
    assertEquals(ctx.isPointInStroke(25, 25), false); // interior, 25px from any edge → not in the 10px stroke
    assertEquals(ctx.isPointInStroke(75, 75), false); // where a translated copy would be — not baked
});

// Test 036h
test('isPointInStroke edge cases', () => {
    const surface = SWCanvas.Core.Surface(200, 200);
    const ctx = new SWCanvas.Core.Context2D(surface);
    
    ctx.lineWidth = 5;
    
    // Test with path containing only moveTo (should return false)
    const moveOnlyPath = new SWCanvas.Core.SWPath2D();
    moveOnlyPath.moveTo(100, 100);
    assertEquals(ctx.isPointInStroke(moveOnlyPath, 100, 100), false);
    
    // Test with current path that has no commands
    ctx.beginPath(); // Clear current path
    assertEquals(ctx.isPointInStroke(100, 100), false);
    
    // Test with very small line segments
    const tinyPath = new SWCanvas.Core.SWPath2D();
    tinyPath.moveTo(100, 100);
    tinyPath.lineTo(100.1, 100); // Tiny line
    assertEquals(ctx.isPointInStroke(tinyPath, 100, 97.5), true); // Should still detect stroke
    
    // Test with closed path
    const closedPath = new SWCanvas.Core.SWPath2D();
    closedPath.moveTo(50, 50);
    closedPath.lineTo(150, 50);
    closedPath.lineTo(150, 150);
    closedPath.lineTo(50, 150);
    closedPath.closePath();
    assertEquals(ctx.isPointInStroke(closedPath, 47.5, 100), true); // On left stroke edge
    assertEquals(ctx.isPointInStroke(closedPath, 100, 100), false); // Inside closed path
});