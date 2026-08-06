// Probe 3: semi-transparent 1px stroke at half-integer coords — the Alpha
// variant shortens edges expecting corners to cover junctions; a shifted
// corner should leave GAPS there.
const SWCanvas = require('../dist/swcanvas.js');

function run(label, x, y) {
    const canvas = SWCanvas.createCanvas(60, 50);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 60, 50);
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRoundRect(x, y, 28, 22, 5);
    const img = ctx.getImageData(0, 0, 60, 50);
    console.log(`\n${label}:`);
    for (let yy = 4; yy < 34; yy++) {
        let row = '';
        for (let xx = 6; xx < 46; xx++) {
            const i = (yy * 60 + xx) * 4;
            const isTouched = img.data[i] !== 255 || img.data[i + 1] !== 255;
            row += isTouched ? '#' : '.';
        }
        console.log(String(yy).padStart(3) + ' ' + row);
    }
}

run('ALPHA integer (10, 8)', 10, 8);
run('ALPHA half-integer (10.5, 8.5)', 10.5, 8.5);
