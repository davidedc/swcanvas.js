// Test: SWCanvas.fonts namespace shape

test('SWCanvas.fonts exposes load/has/unload + _raw', () => {
    assertEquals(typeof SWCanvas.fonts, 'object');
    assertEquals(typeof SWCanvas.fonts.load, 'function');
    assertEquals(typeof SWCanvas.fonts.has, 'function');
    assertEquals(typeof SWCanvas.fonts.unload, 'function');
    assertEquals(typeof SWCanvas.fonts._raw, 'object');
});

test('SWCanvas.fonts._raw exposes the BitmapText runtime escape hatch', () => {
    const raw = SWCanvas.fonts._raw;
    assertEquals(typeof raw.BitmapText, 'function');     // class
    assertEquals(typeof raw.FontProperties, 'function');
    assertEquals(typeof raw.TextProperties, 'function');
    assertEquals(typeof raw.AtlasDataStore, 'function');
    assertEquals(typeof raw.AtlasLRU, 'function');
});

test('SWCanvas.fonts.has returns false for an unloaded font', () => {
    // Just check the call shape — we can't load anything in Phase 2 (no atlases
    // available in test env yet). False is the only legal return here.
    const result = SWCanvas.fonts.has({ family: 'NonexistentFont', size: 99 });
    assertEquals(result, false);
});
