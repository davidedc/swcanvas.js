#!/usr/bin/env node
/**
 * Unit tests for the build-time preprocessor (45 tests).
 *
 * Tests cover:
 * - Argument parsing (5 tests)
 * - Single-level marker expansion (6 tests)
 * - Full preprocessing with chained expansion (10 tests)
 * - Template validation (14 tests)
 * - Chained template expansion and depth protection (8 tests)
 * - Edge cases (2 tests)
 *
 * Run with: node tests/build/test-preprocessor.js
 */

const assert = require('assert');
const { preprocess, TEMPLATES, parseArgs, expandMarker, hasMarkers } = require('../../build-scripts/preprocess');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`✓ ${name}`);
    } catch (e) {
        failed++;
        console.log(`✗ ${name}`);
        console.log(`  Error: ${e.message}`);
    }
}

// ============================================================================
// parseArgs tests
// ============================================================================

test('parseArgs: simple arguments', () => {
    const args = parseArgs('a, b, c');
    assert.deepStrictEqual(args, ['a', 'b', 'c']);
});

test('parseArgs: expressions with nested parens', () => {
    const args = parseArgs('data, Math.floor(x + 1), y * width + x');
    assert.deepStrictEqual(args, ['data', 'Math.floor(x + 1)', 'y * width + x']);
});

test('parseArgs: single argument', () => {
    const args = parseArgs('  foo  ');
    assert.deepStrictEqual(args, ['foo']);
});

test('parseArgs: empty string', () => {
    const args = parseArgs('');
    assert.deepStrictEqual(args, []);
});

test('parseArgs: deeply nested parens', () => {
    const args = parseArgs('fn1(fn2(fn3(x))), y');
    assert.deepStrictEqual(args, ['fn1(fn2(fn3(x)))', 'y']);
});

// ============================================================================
// expandMarker tests
// ============================================================================

test('expandMarker: BLEND_ALPHA basic expansion', () => {
    const result = expandMarker('BLEND_ALPHA', 'd, i, r, g, b, a, inv');
    assert(!result.includes('const __srcA'), 'Should NOT cache alpha (V8 optimization)');
    assert(result.includes('const __off = i * 4;'), 'Should have offset calculation without parens');
    assert(result.includes('d[__off + 3] / 255'), 'Should read alpha from data');
    assert(result.includes('a + __dstAScaled'), 'Should use alpha directly in output alpha');
    assert(result.includes('r * a'), 'Should use alpha directly in RGB blending');
    // Template uses alignment spaces: d[__off]     = ...
    assert(/d\[__off\]\s+=/.test(result), 'Should write to data');
});

test('expandMarker: SET_OPAQUE basic expansion', () => {
    const result = expandMarker('SET_OPAQUE', 'data32, pos, color');
    assert.strictEqual(result, 'data32[pos] = color;');
});

test('expandMarker: expression arguments', () => {
    const result = expandMarker('SET_OPAQUE', 'data32, y * w + x, packed');
    assert.strictEqual(result, 'data32[y * w + x] = packed;');
});

test('expandMarker: unknown template throws', () => {
    assert.throws(() => expandMarker('UNKNOWN_TEMPLATE', 'a, b'), /Unknown template/);
});

test('expandMarker: wrong arg count throws', () => {
    assert.throws(() => expandMarker('SET_OPAQUE', 'a, b'), /expects 3 args/);
});

test('expandMarker: too many args throws', () => {
    assert.throws(() => expandMarker('SET_OPAQUE', 'a, b, c, d'), /expects 3 args/);
});

// ============================================================================
// preprocess tests
// ============================================================================

test('preprocess: single marker expansion', () => {
    const input = '/*@inline:SET_OPAQUE(data32, pos, color)*/';
    const output = preprocess(input, 'test.js');
    assert.strictEqual(output, 'data32[pos] = color;');
});

test('preprocess: BLEND_ALPHA marker expansion', () => {
    const input = '/*@inline:BLEND_ALPHA(d, i, r, g, b, a, inv)*/';
    const output = preprocess(input, 'test.js');
    assert(!output.includes('const __srcA'), 'Should NOT cache alpha');
    assert(output.includes('const __off = i * 4;'), 'Should have offset without parens');
    assert(output.includes('d[__off + 3] / 255'));
    assert(output.includes('r * a'), 'Should use alpha directly');
});

test('preprocess: no markers - passthrough unchanged', () => {
    const input = 'const x = 1;\nconst y = 2; // no markers here\n';
    const output = preprocess(input, 'test.js');
    assert.strictEqual(output, input);
});

test('preprocess: marker with surrounding code', () => {
    const input = `function blend(data, pos, r, g, b, alpha, invAlpha) {
    /*@inline:BLEND_ALPHA(data, pos, r, g, b, alpha, invAlpha)*/
}`;
    const output = preprocess(input, 'test.js');
    assert(output.includes('function blend'));
    assert(!output.includes('const __srcA'), 'Should NOT cache alpha');
    assert(output.includes('const __off = pos * 4;'), 'Should have offset without parens');
    assert(output.includes('r * alpha'), 'Should use alpha directly');
    assert(!output.includes('/*@inline:'));
});

test('preprocess: multiple markers in same file', () => {
    const input = `
/*@inline:SET_OPAQUE(d1, p1, c1)*/
// some code
/*@inline:SET_OPAQUE(d2, p2, c2)*/
`;
    const output = preprocess(input, 'test.js');
    assert(output.includes('d1[p1] = c1;'));
    assert(output.includes('d2[p2] = c2;'));
    assert(!output.includes('/*@inline:'));
});

test('preprocess: error includes filename', () => {
    const input = '/*@inline:UNKNOWN()*/';
    assert.throws(() => preprocess(input, 'myfile.js'), /myfile\.js/);
});

// ============================================================================
// hasMarkers tests
// ============================================================================

test('hasMarkers: returns true when markers present', () => {
    const input = 'some code /*@inline:SET_OPAQUE(a, b, c)*/ more code';
    // Reset regex lastIndex
    assert(hasMarkers(input) || hasMarkers(input), 'Should detect marker');
});

test('hasMarkers: returns false when no markers', () => {
    const input = 'const x = 1; // no markers';
    assert(!hasMarkers(input));
});

// ============================================================================
// Template validation tests
// ============================================================================

test('TEMPLATES: BLEND_ALPHA has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.BLEND_ALPHA.params,
        ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha']);
});

test('TEMPLATES: SET_OPAQUE has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.SET_OPAQUE.params,
        ['data32', 'pixelIndex', 'packedColor']);
});

test('TEMPLATES: BLEND_ALPHA code has all placeholders', () => {
    const code = TEMPLATES.BLEND_ALPHA.code;
    for (const param of TEMPLATES.BLEND_ALPHA.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('TEMPLATES: SET_OPAQUE code has all placeholders', () => {
    const code = TEMPLATES.SET_OPAQUE.code;
    for (const param of TEMPLATES.SET_OPAQUE.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('TEMPLATES: SET_OPAQUE_CLIPPED has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.SET_OPAQUE_CLIPPED.params,
        ['data32', 'pixelIndex', 'packedColor', 'clipBuffer']);
});

test('TEMPLATES: SET_OPAQUE_CLIPPED code has all placeholders', () => {
    const code = TEMPLATES.SET_OPAQUE_CLIPPED.code;
    for (const param of TEMPLATES.SET_OPAQUE_CLIPPED.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('TEMPLATES: BLEND_ALPHA_CLIPPED has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.BLEND_ALPHA_CLIPPED.params,
        ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer']);
});

test('TEMPLATES: BLEND_ALPHA_CLIPPED code has all placeholders', () => {
    const code = TEMPLATES.BLEND_ALPHA_CLIPPED.code;
    for (const param of TEMPLATES.BLEND_ALPHA_CLIPPED.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('preprocess: SET_OPAQUE_CLIPPED full expansion (chained)', () => {
    const input = '/*@inline:SET_OPAQUE_CLIPPED(data32, pos, color, clip)*/';
    const result = preprocess(input, 'test.js');
    assert(result.includes('if (!clip ||'), 'Should have null clipBuffer check');
    assert(result.includes('clip[pos >> 3]'), 'Should check clipBuffer byte');
    assert(result.includes('(1 << (pos & 7))'), 'Should check clipBuffer bit');
    assert(result.includes('data32[pos] = color;'), 'Should write to data32');
    assert(!result.includes('/*@inline:'), 'Should have no remaining markers');
});

test('preprocess: BLEND_ALPHA_CLIPPED full expansion (chained)', () => {
    const input = '/*@inline:BLEND_ALPHA_CLIPPED(d, i, r, g, b, a, inv, clip)*/';
    const result = preprocess(input, 'test.js');
    assert(result.includes('if (!clip ||'), 'Should have null clipBuffer check');
    assert(result.includes('clip[i >> 3]'), 'Should check clipBuffer byte');
    assert(result.includes('const __off = i * 4;'), 'Should have offset calculation');
    assert(result.includes('r * a'), 'Should use alpha directly in RGB blending');
    assert(!result.includes('/*@inline:'), 'Should have no remaining markers');
});

test('TEMPLATES: SET_OPAQUE_ARC_CLIPPED has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.SET_OPAQUE_ARC_CLIPPED.params,
        ['data32', 'pixelIndex', 'packedColor', 'clipBuffer', 'dx', 'dy', 'startAngle', 'endAngle']);
});

test('TEMPLATES: SET_OPAQUE_ARC_CLIPPED code has all placeholders', () => {
    const code = TEMPLATES.SET_OPAQUE_ARC_CLIPPED.code;
    for (const param of TEMPLATES.SET_OPAQUE_ARC_CLIPPED.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('TEMPLATES: BLEND_ALPHA_ARC_CLIPPED has correct params', () => {
    assert.deepStrictEqual(TEMPLATES.BLEND_ALPHA_ARC_CLIPPED.params,
        ['data', 'pixelIndex', 'r', 'g', 'b', 'alpha', 'invAlpha', 'clipBuffer', 'dx', 'dy', 'startAngle', 'endAngle']);
});

test('TEMPLATES: BLEND_ALPHA_ARC_CLIPPED code has all placeholders', () => {
    const code = TEMPLATES.BLEND_ALPHA_ARC_CLIPPED.code;
    for (const param of TEMPLATES.BLEND_ALPHA_ARC_CLIPPED.params) {
        assert(code.includes(`{{${param}}}`), `Missing placeholder for ${param}`);
    }
});

test('preprocess: SET_OPAQUE_ARC_CLIPPED full expansion (chained)', () => {
    const input = '/*@inline:SET_OPAQUE_ARC_CLIPPED(data32, pos, color, clip, dx, dy, start, end)*/';
    const result = preprocess(input, 'test.js');
    assert(result.includes('Math.atan2(dy, dx)'), 'Should have inline atan2 call');
    assert(result.includes('6.283185307179586'), 'Should have TAU constant inlined');
    assert(result.includes('__angle >= start && __angle <= end'), 'Should have angle range check');
    assert(result.includes('if (!clip ||'), 'Should have null clipBuffer check');
    assert(result.includes('data32[pos] = color;'), 'Should write to data32');
    assert(!result.includes('/*@inline:'), 'Should have no remaining markers');
});

test('preprocess: BLEND_ALPHA_ARC_CLIPPED full expansion (chained)', () => {
    const input = '/*@inline:BLEND_ALPHA_ARC_CLIPPED(d, i, r, g, b, a, inv, clip, dx, dy, start, end)*/';
    const result = preprocess(input, 'test.js');
    assert(result.includes('Math.atan2(dy, dx)'), 'Should have inline atan2 call');
    assert(result.includes('6.283185307179586'), 'Should have TAU constant inlined');
    assert(result.includes('__angle >= start && __angle <= end'), 'Should have angle range check');
    assert(result.includes('if (!clip ||'), 'Should have null clipBuffer check');
    assert(result.includes('const __off = i * 4;'), 'Should have offset calculation');
    assert(!result.includes('/*@inline:'), 'Should have no remaining markers');
});

// ============================================================================
// Chained template expansion tests
// ============================================================================

test('preprocess: chained expansion depth 2 (ARC → CLIPPED → BASE)', () => {
    // SET_OPAQUE_ARC_CLIPPED references SET_OPAQUE_CLIPPED which references SET_OPAQUE
    const input = '/*@inline:SET_OPAQUE_ARC_CLIPPED(d32, idx, c, cb, px, py, s, e)*/';
    const result = preprocess(input, 'test.js');
    // Level 2 (arc) content
    assert(result.includes('Math.atan2(py, px)'), 'Should have atan2 from arc template');
    // Level 1 (clipped) content
    assert(result.includes('if (!cb ||'), 'Should have clip check from clipped template');
    // Level 0 (base) content
    assert(result.includes('d32[idx] = c;'), 'Should have direct write from base template');
    // No remaining markers
    assert(!result.includes('/*@inline:'), 'All markers should be expanded');
});

test('preprocess: chained expansion BLEND_ALPHA chain', () => {
    // BLEND_ALPHA_ARC_CLIPPED → BLEND_ALPHA_CLIPPED → BLEND_ALPHA
    const input = '/*@inline:BLEND_ALPHA_ARC_CLIPPED(buf, pi, 255, 128, 64, 0.5, 0.5, mask, x, y, 0, 3.14)*/';
    const result = preprocess(input, 'test.js');
    // Arc level
    assert(result.includes('Math.atan2(y, x)'), 'Should have atan2');
    // Clipped level
    assert(result.includes('if (!mask ||'), 'Should have clip check');
    // Base level - Porter-Duff blending
    assert(result.includes('const __off = pi * 4;'), 'Should have offset calculation');
    assert(result.includes('255 * 0.5'), 'Should have color*alpha multiplication');
    assert(!result.includes('/*@inline:'), 'No remaining markers');
});

test('preprocess: FAST arc templates also chain correctly', () => {
    const input = '/*@inline:SET_OPAQUE_ARC_FAST_CLIPPED(d32, i, col, clip, dx, dy, sc, ss, ec, es, false)*/';
    const result = preprocess(input, 'test.js');
    // Fast arc uses cross-product, not atan2
    assert(result.includes('const __afterStart ='), 'Should have cross-product check');
    assert(result.includes('sc * dy - ss * dx'), 'Should have start angle cross-product');
    // Should chain to clipped → base
    assert(result.includes('if (!clip ||'), 'Should have clip check');
    assert(result.includes('d32[i] = col;'), 'Should have direct write');
    assert(!result.includes('/*@inline:'), 'No remaining markers');
});

test('preprocess: depth protection triggers at maxDepth', () => {
    // Use maxDepth=1 on a 2-level nested template
    // SET_OPAQUE_CLIPPED needs 2 passes: 1) expands to SET_OPAQUE marker, 2) expands SET_OPAQUE
    const input = '/*@inline:SET_OPAQUE_CLIPPED(d, p, c, cb)*/';
    assert.throws(() => {
        preprocess(input, 'test.js', 1);  // maxDepth=1, but needs 2 passes
    }, /Max expansion depth/);
});

test('preprocess: depth protection allows sufficient depth', () => {
    // With maxDepth=2, a 2-level template should expand successfully
    const input = '/*@inline:SET_OPAQUE_CLIPPED(d, p, c, cb)*/';
    const result = preprocess(input, 'test.js', 2);
    assert(result.includes('d[p] = c;'), 'Should fully expand with sufficient depth');
    assert(!result.includes('/*@inline:'), 'No remaining markers');
});

test('preprocess: depth protection for 3-level chain', () => {
    // ARC_CLIPPED → CLIPPED → BASE needs 3 passes
    const input = '/*@inline:SET_OPAQUE_ARC_CLIPPED(d, i, c, cb, x, y, s, e)*/';
    // Should fail with maxDepth=2
    assert.throws(() => {
        preprocess(input, 'test.js', 2);
    }, /Max expansion depth/);
    // Should succeed with maxDepth=3
    const result = preprocess(input, 'test.js', 3);
    assert(result.includes('d[i] = c;'), 'Should fully expand');
});

test('hasMarkers: regex lastIndex handling with multiple calls', () => {
    const input = 'some code /*@inline:SET_OPAQUE(a, b, c)*/ more code';
    // Multiple consecutive calls should all return correct result
    // (tests that lastIndex is properly reset)
    assert(hasMarkers(input), 'First call should find marker');
    assert(hasMarkers(input), 'Second call should still find marker');
    assert(hasMarkers(input), 'Third call should still find marker');
});

test('hasMarkers: returns false consistently for non-marker code', () => {
    const input = 'const x = 1; // no markers here';
    assert(!hasMarkers(input), 'First call');
    assert(!hasMarkers(input), 'Second call');
    assert(!hasMarkers(input), 'Third call');
});

// ============================================================================
// Edge cases
// ============================================================================

test('preprocess: complex expression in marker args', () => {
    const input = '/*@inline:SET_OPAQUE(surface.data32, (y * width) + x, Surface.packColor(r, g, b, 255))*/';
    const output = preprocess(input, 'test.js');
    assert.strictEqual(output, 'surface.data32[(y * width) + x] = Surface.packColor(r, g, b, 255);');
});

test('preprocess: BLEND_ALPHA with simple variable pixelIndex', () => {
    // All call sites now pass simple variables for pixelIndex (pre-computed before the marker)
    const input = '/*@inline:BLEND_ALPHA(surface.data, pixelIndex, color.r, color.g, color.b, effectiveAlpha, invAlpha)*/';
    const output = preprocess(input, 'test.js');
    // Alpha is NOT cached - used directly (all call sites pass simple variables)
    assert(!output.includes('const __srcA'), 'Should NOT cache alpha');
    // pixelIndex without parens (all call sites now pass simple variables)
    assert(output.includes('const __off = pixelIndex * 4;'), 'Should have offset without parens');
    // r, g, b and alpha without extra parens
    assert(output.includes('color.r * effectiveAlpha'), 'Should use alpha directly');
    // invAlpha without parens (all call sites pass simple variables)
    assert(output.includes('* invAlpha'), 'invAlpha without parens');
});

// ============================================================================
// Summary
// ============================================================================

console.log('');
console.log(`Tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}

console.log('\nAll preprocessor tests passed!');
