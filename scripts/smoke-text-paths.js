#!/usr/bin/env node
// Focused diagnostic: open a minimal page that loads one font explicitly and
// renders the same text via both fast path (identity transform) and slow path
// (rotation). Sample pixels of each and report whether glyphs landed.
//
// Used to localise "boxes are empty" bugs that don't fire JS errors.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8768;

let playwrightFrom = path.resolve(PROJECT_ROOT, '..', '..', 'code', 'BitmapText.js', 'node_modules', 'playwright');
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--playwright-from') playwrightFrom = process.argv[++i];
}
const { chromium } = require(playwrightFrom);

const PAGE_HTML = `<!DOCTYPE html><html><body>
<canvas id="fast" width="200" height="60"></canvas>
<canvas id="slow" width="200" height="60"></canvas>
<pre id="log"></pre>
<script src="dist/swcanvas.js"></script>
<script>
(async () => {
  const log = (msg) => { document.getElementById('log').textContent += msg + '\\n'; console.log(msg); };
  try {
    const { BitmapText, FontProperties, AtlasDataStore } = SWCanvas.fonts._raw;
    BitmapText.setFontDirectory('font-assets/');
    // Diag: what does the runtime see for character counts?
    const CS = window.__SW_DIAG_CharacterSets;
    log('CS.FONT_SPECIFIC_CHARS.length=' + (CS && CS.FONT_SPECIFIC_CHARS.length));
    log('CS.FONT_INVARIANT_CHARS.length=' + (CS && CS.FONT_INVARIANT_CHARS.length));
    log('Last char of FONT_SPECIFIC_CHARS: ' + JSON.stringify(CS && CS.FONT_SPECIFIC_CHARS.slice(-3)));
    // Trap setAtlasData so we know if it's being called.
    const origSet = AtlasDataStore.setAtlasData.bind(AtlasDataStore);
    AtlasDataStore.setAtlasData = (fp, ad) => {
        log('AtlasDataStore.setAtlasData called for ' + fp.idString);
        return origSet(fp, ad);
    };
    const idStr = 'density-1-0-Arial-style-normal-weight-normal-size-18-0';
    log('loading: ' + idStr);
    log('atlasFormat=' + BitmapText._atlasFormat);
    await SWCanvas.fonts.load({ family: 'Arial', size: 18 });
    log('loaded. hasAtlas=' + BitmapText.hasAtlas(idStr));
    log('hasMetrics=' + BitmapText.hasMetrics(idStr));
    log('hasFont=' + BitmapText.hasFont(idStr));
    log('AtlasDataStore.size=' + AtlasDataStore.size());
    log('AtlasDataStore.getAvailableFonts=' + JSON.stringify(AtlasDataStore.getAvailableFonts()));
    const fp = new FontProperties(1, 'Arial', 'normal', 'normal', 18);
    const ad = AtlasDataStore.getAtlasData(fp);
    log('getAtlasData=' + (ad ? 'instance(' + ad.constructor.name + ')' : 'null'));
    if (ad) {
      log('atlas.image.width=' + ad.atlasImage.image.width + ' image.height=' + ad.atlasImage.image.height + ' image.data=' + (ad.atlasImage.image.data && ad.atlasImage.image.data.constructor.name));
      log('atlasImage.isValid=' + ad.atlasImage.isValid() + ' atlasImage.width=' + ad.atlasImage.width);
    }

    // ---- FAST PATH: identity transform ----
    {
      const c = SWCanvas.createCanvas(200, 60);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,60);
      ctx.fillStyle = '#ff0000';
      ctx.font = '18px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText('Hello', 10, 40);
      const data = ctx.getImageData(0,0,200,60).data;
      let red = 0, nonWhite = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i+1] < 100 && data[i+2] < 100) red++;
        if (!(data[i]===255 && data[i+1]===255 && data[i+2]===255)) nonWhite++;
      }
      log('fast: nonWhite=' + nonWhite + ' redPixels=' + red);
      // Blit to display.
      const id = ctx.getImageData(0,0,200,60);
      const realId = new ImageData(id.data, id.width, id.height);
      document.getElementById('fast').getContext('2d').putImageData(realId, 0, 0);
    }

    // ---- SLOW PATH: rotation ----
    {
      const c = SWCanvas.createCanvas(200, 60);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,60);
      ctx.fillStyle = '#0000ff';
      ctx.font = '18px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.translate(100, 30);
      ctx.rotate(0.3);
      ctx.translate(-100, -30);
      ctx.fillText('Hello', 10, 40);
      const data = ctx.getImageData(0,0,200,60).data;
      let blue = 0, nonWhite = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 100 && data[i+1] < 100 && data[i+2] > 200) blue++;
        if (!(data[i]===255 && data[i+1]===255 && data[i+2]===255)) nonWhite++;
      }
      log('slow: nonWhite=' + nonWhite + ' bluePixels=' + blue);
      const id = ctx.getImageData(0,0,200,60);
      const realId = new ImageData(id.data, id.width, id.height);
      document.getElementById('slow').getContext('2d').putImageData(realId, 0, 0);
    }

    window.__diag = document.getElementById('log').textContent;
  } catch (e) {
    log('ERROR: ' + e.message + '\\n' + e.stack);
    window.__diag = document.getElementById('log').textContent;
  }
})();
</script></body></html>
`;

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            if (urlPath === '/test.html') {
                res.setHeader('Content-Type', 'text/html');
                res.end(PAGE_HTML);
                return;
            }
            const fp = path.join(PROJECT_ROOT, urlPath);
            if (!fp.startsWith(PROJECT_ROOT)) { res.statusCode = 403; res.end(); return; }
            fs.stat(fp, (e, st) => {
                if (e || !st.isFile()) { res.statusCode = 404; res.end(); return; }
                const ext = path.extname(fp).toLowerCase();
                const ct = ({ '.js': 'application/javascript', '.webp': 'image/webp', '.css': 'text/css' })[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', ct);
                fs.createReadStream(fp).pipe(res);
            });
        });
        server.listen(PORT, () => resolve(server));
    });
}

(async () => {
    const server = await startServer();
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('pageerror:', e.message));
    page.on('console', m => {
        if (m.type() === 'error') console.error('console.error:', m.text());
        else if (m.type() !== 'log') console.log('[' + m.type() + ']', m.text());
        else console.log(m.text());
    });
    await page.goto('http://localhost:' + PORT + '/test.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const diag = await page.evaluate(() => window.__diag);
    console.log('--- in-page log ---');
    console.log(diag);
    await browser.close();
    server.close();
})();
