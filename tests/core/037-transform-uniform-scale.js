// Test: Transform2D uniformScale property
// Validates the pre-computed uniform scale factor (sqrt of absolute determinant)

test('Transform2D uniformScale - identity matrix', () => {
    const t = new SWCanvas.Core.Transform2D();
    // Identity matrix: |1*1 - 0*0| = 1, sqrt(1) = 1
    if (Math.abs(t.uniformScale - 1) > 0.0001) {
        throw new Error(`Identity matrix uniformScale should be 1, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - uniform scale 2x', () => {
    const t = SWCanvas.Core.Transform2D.scaling(2, 2);
    // Scale 2x: |2*2 - 0*0| = 4, sqrt(4) = 2
    if (Math.abs(t.uniformScale - 2) > 0.0001) {
        throw new Error(`Uniform 2x scale uniformScale should be 2, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - non-uniform scale', () => {
    const t = SWCanvas.Core.Transform2D.scaling(3, 4);
    // Scale 3x4: |3*4 - 0*0| = 12, sqrt(12) ≈ 3.464
    const expected = Math.sqrt(12);
    if (Math.abs(t.uniformScale - expected) > 0.0001) {
        throw new Error(`Non-uniform scale (3,4) uniformScale should be ${expected}, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - rotation only', () => {
    const t = SWCanvas.Core.Transform2D.rotation(Math.PI / 4); // 45 degrees
    // Rotation: |cos*cos - sin*(-sin)| = cos²+sin² = 1, sqrt(1) = 1
    if (Math.abs(t.uniformScale - 1) > 0.0001) {
        throw new Error(`45-degree rotation uniformScale should be 1, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - rotation plus uniform scale', () => {
    // Scale 3x then rotate 30 degrees
    const t = SWCanvas.Core.Transform2D.scaling(3, 3).rotate(Math.PI / 6);
    // After scaling 3x: determinant = 9, after rotation: still 9
    // sqrt(9) = 3
    if (Math.abs(t.uniformScale - 3) > 0.0001) {
        throw new Error(`Scaled rotation uniformScale should be 3, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - 90 degree rotation', () => {
    const t = SWCanvas.Core.Transform2D.rotation(Math.PI / 2);
    // 90-degree rotation: |0*0 - 1*(-1)| = 1, sqrt(1) = 1
    if (Math.abs(t.uniformScale - 1) > 0.0001) {
        throw new Error(`90-degree rotation uniformScale should be 1, got ${t.uniformScale}`);
    }
});

test('Transform2D uniformScale - negative scale (flip)', () => {
    const t = SWCanvas.Core.Transform2D.scaling(-2, 2);
    // Flip: |-2*2 - 0*0| = |-4| = 4, sqrt(4) = 2
    if (Math.abs(t.uniformScale - 2) > 0.0001) {
        throw new Error(`Flipped scale uniformScale should be 2, got ${t.uniformScale}`);
    }
});
