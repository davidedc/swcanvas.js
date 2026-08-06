// Probe: does strokeRoundRect's 1px fast path render half-integer (crisp-idiom)
// geometry consistently between edges and corners?
// Dumps the top-left corner neighborhood for integer vs half-integer x/y.
const SWCanvas = require('../dist/swcanvas.js');

function render(x, y, w, h, r) {
    const canvas = SWCanvas.createCanvas(120, 120);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 120, 120);
    ctx.strokeStyle = 'rgb(255,0,0)';
    ctx.lineWidth = 1;
    ctx.strokeRoundRect(x, y, w, h, r);
    return ctx.getImageData(0, 0, 120, 120);
}

function dump(label, img, x0, y0, size) {
    console.log(`\n${label} — window (${x0},${y0})..(${x0 + size - 1},${y0 + size - 1}), '#'=stroke '.'=bg:`);
    for (let y = y0; y < y0 + size; y++) {
        let row = '';
        for (let x = x0; x < x0 + size; x++) {
            const i = (y * 120 + x) * 4;
            const isStroke = img.data[i] === 255 && img.data[i + 1] === 0;
            row += isStroke ? '#' : '.';
        }
        console.log(String(y).padStart(3) + ' ' + row);
    }
}

// Integer geometry (grid-centered crisp idiom)
dump('INTEGER strokeRoundRect(50, 70, 30, 20, 5)', render(50, 70, 30, 20, 5), 48, 68, 14);

// Half-integer geometry (pixel-centered crisp idiom, the cenPx test's case)
dump('HALF-INT strokeRoundRect(50.5, 70.5, 30, 20, 5)', render(50.5, 70.5, 30, 20, 5), 48, 68, 14);
