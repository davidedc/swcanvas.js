#!/usr/bin/env node
//
// One-shot Playwright smoke for the text demo. Adapted from
// BitmapText.js/scripts/playwright-smoke-loop.js.
//
// Loads examples/text-lru-atlas-demo.html over both file:// and http://, lets
// it run a few seconds, captures console.error and pageerror events. Used to
// catch issues like "BitmapText global not exposed" without having to open a
// browser manually.
//
// Usage:
//   node scripts/smoke-text-demo.js [--playwright-from <path>]
//
// Default Playwright source: ../BitmapText.js/node_modules/playwright
//   (SWCanvas doesn't depend on Playwright yet; we reuse the sibling repo's
//   install. If that path doesn't exist, override with --playwright-from.)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 8767;

let playwrightFrom = path.resolve(PROJECT_ROOT, '..', 'BitmapText.js', 'node_modules', 'playwright');
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--playwright-from') {
        playwrightFrom = process.argv[++i];
    }
}

let chromium;
try {
    ({ chromium } = require(playwrightFrom));
} catch (e) {
    console.error('ERROR: could not load playwright from ' + playwrightFrom);
    console.error('       Pass --playwright-from <path> or npm install playwright in SWCanvas.');
    process.exit(2);
}

const PAGES = [
    'examples/text-lru-atlas-demo.html',
];

function startStaticServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split('?')[0]);
            const filePath = path.join(PROJECT_ROOT, urlPath);
            if (!filePath.startsWith(PROJECT_ROOT)) { res.statusCode = 403; res.end(); return; }
            fs.stat(filePath, (err, stat) => {
                if (err || !stat.isFile()) { res.statusCode = 404; res.end('Not found: ' + urlPath); return; }
                const ext = path.extname(filePath).toLowerCase();
                const ct = ({
                    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                    '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
                })[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', ct);
                fs.createReadStream(filePath).pipe(res);
            });
        });
        server.listen(PORT, () => resolve(server));
        server.on('error', reject);
    });
}

async function visit(browser, url, label) {
    const isFile = url.startsWith('file://');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '(no stack)')));
    page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error') {
            // file:// can't fetch the upstream "minimum set" — atlas-*-webp.js
            // wrappers only exist after running `npm run text:wrap-for-file`
            // (which calls the vendored image-to-js-converter). We treat file://
            // asset 404s as informational, not failures.
            if (isFile && /ERR_FILE_NOT_FOUND/.test(msg.text())) return;
            errors.push('console.error: ' + msg.text());
        } else if (type === 'warning') {
            if (isFile && /will use placeholder rectangles/.test(msg.text())) return;
            // BitmapText emits a one-line warning whenever font-size < 9 is
            // requested ("minimum supported size … interpolated placeholder
            // rectangles"). The demo's FONT_POOL deliberately includes
            // sub-9 sizes to exercise that path; the warnings are intended
            // behavior, not failures. Filter in both http and file modes.
            if (/minimum supported size/.test(msg.text())) return;
            errors.push('console.warn: ' + msg.text());
        }
    });
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        // Give font loads + initial paints time. The text demo spawns one box
        // per 80ms and tries to load atlases; 2s is enough to see the
        // metrics+positioning+at-least-one-atlas pipeline succeed.
        await page.waitForTimeout(2500);
        // Verify the demo's status pill moved past "starting…".
        const status = await page.locator('#status').textContent();
        if (status === 'starting…' || /failed/.test(status || '')) {
            errors.push('status stuck at: ' + JSON.stringify(status));
        }
        // Sample a few display canvases: every textbox should have some
        // non-white pixels once atlases load (the glyphs themselves). All-white
        // canvases mean the rendering pipeline is silently broken even when
        // no JS error fires.
        const diag = await page.evaluate(() => {
            const canvases = Array.from(document.querySelectorAll('#stage canvas'));
            const samples = canvases.slice(0, 5).map(c => {
                const ctx = c.getContext('2d');
                const d = ctx.getImageData(0, 0, c.width, c.height).data;
                let nonWhite = 0;
                for (let i = 0; i < d.length; i += 4) {
                    if (d[i] !== 255 || d[i+1] !== 255 || d[i+2] !== 255) nonWhite++;
                }
                return { w: c.width, h: c.height, nonWhite };
            });
            return { canvases: canvases.length, samples };
        });
        // Treat zero-glyph-pixel canvases as failures only if we have a non-zero
        // sample to compare against. (Placeholder-only state — atlases haven't
        // loaded yet — is also legitimately all-white.)
        const allEmpty = diag.samples.length > 0 && diag.samples.every(s => s.nonWhite === 0);
        if (allEmpty && diag.canvases > 0) {
            errors.push('DIAG: all sampled canvases are pure white (no glyph pixels): ' + JSON.stringify(diag));
        }
    } catch (e) {
        errors.push('navigation: ' + e.message);
    }
    await ctx.close();
    return { label, url, errors };
}

(async () => {
    const server = await startStaticServer();
    const browser = await chromium.launch();
    const results = [];

    for (const p of PAGES) {
        const httpUrl = 'http://localhost:' + PORT + '/' + p;
        const fileUrl = 'file://' + path.join(PROJECT_ROOT, p);
        const r1 = await visit(browser, httpUrl, 'http  ' + p);
        const r2 = await visit(browser, fileUrl, 'file  ' + p);
        results.push(r1, r2);
        process.stdout.write('  ' + (r1.errors.length === 0 ? '✓' : '✗') + ' ' + r1.label + '\n');
        process.stdout.write('  ' + (r2.errors.length === 0 ? '✓' : '✗') + ' ' + r2.label + '\n');
    }

    await browser.close();
    server.close();

    const failed = results.filter(r => r.errors.length > 0);
    if (failed.length === 0) {
        console.log('\nAll pages clean.');
        process.exit(0);
    }
    console.log('\nFailures:\n');
    for (const r of failed) {
        console.log('  ' + r.label);
        for (const e of r.errors) console.log('    ' + e);
    }
    process.exit(1);
})();
