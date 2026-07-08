// Test: Texture3D power-of-two validation and packed word order
// This file will be concatenated into the main test suite

test('Texture3D creation validation and packing', () => {
    const mk = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

    assertThrows(() => new SWCanvas.Core.Texture3D(mk(100, 64)), 'power of two');
    assertThrows(() => new SWCanvas.Core.Texture3D(mk(64, 48)), 'power of two');
    assertThrows(() => new SWCanvas.Core.Texture3D({ width: 4, height: 4, data: new Uint8ClampedArray(3) }), 'RGBA');

    // Addressing constants
    const img = mk(4, 2);
    // texel (u=2, v=1) = RGB(10, 20, 30)
    img.data.set([10, 20, 30, 255], (1 * 4 + 2) * 4);
    const tex = new SWCanvas.Core.Texture3D(img);
    assertEquals(tex.uMask, 3);
    assertEquals(tex.vMask, 1);
    assertEquals(tex.shift, 2);
    assertEquals(tex.data32.length, 8);

    // Packed word must match the Surface pixel word order exactly, so a
    // textured span can copy texels with a single 32-bit store
    const surf = SWCanvas.Core.Surface(1, 1);
    surf.setPixelOpaque(0, 10, 20, 30);
    assertEquals(tex.data32[((1 & tex.vMask) << tex.shift) | (2 & tex.uMask)], surf.data32[0],
        'texel packing must match surface word order');
});
