#!/usr/bin/env node
//
// Runs tests/browser/index.html headless over file:// and checks what Node's
// `npm test` checks, plus the parity the page exists for:
//   - the smoke fonts loaded (the committed font-assets/_smoke/ fixture);
//   - every core test passed (a test needing what only Node has is listed as
//     skipped by the page, and `npm test` runs it);
//   - every visual test drew without an error;
//   - every visual test's SWCanvas render, encoded with SWCanvas's own
//     deterministic PngEncoder, is byte-identical to the PNG Node wrote at
//     tests/output/<name>.basic.png (run `npm run build && npm test` first).
// Exit 0 = all held, 1 = something failed, 2 = could not run (no browser driver,
// or the page never finished): never read 2 as a pass.
//
// SWCanvas does not depend on a browser driver (like scripts/smoke-text-demo.js),
// so point it at an installed one:
//   node tests/browser/run-headless.js --playwright-from <path>/node_modules/playwright [--browser=chromium|webkit]
//   node tests/browser/run-headless.js --puppeteer-from <path>/node_modules/puppeteer      (Chromium)
// Default: --playwright-from ../BitmapText.js/node_modules/playwright, chromium.

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PAGE = path.join(__dirname, 'index.html');
const PAGE_TIMEOUT_MS = 120000;

function flag(name) {
    const prefix = `--${name}=`;
    for (let i = 2; i < process.argv.length; i++) {
        if (process.argv[i].startsWith(prefix)) return process.argv[i].slice(prefix.length);
        if (process.argv[i] === `--${name}`) return process.argv[i + 1];
    }
    return undefined;
}

async function openBrowser() {
    const browserName = flag('browser') || 'chromium';
    const puppeteerFrom = flag('puppeteer-from');
    if (puppeteerFrom) {
        if (browserName !== 'chromium') throw new Error('--puppeteer-from drives Chromium only');
        const puppeteer = require(path.resolve(puppeteerFrom));
        const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
        const page = await browser.newPage();
        // Puppeteer's waitForFunction takes (fn, options); Playwright's (fn, arg, options).
        const waitFor = (fn, timeout) => page.waitForFunction(fn, { timeout });
        return { browser, page, waitFor, label: 'chromium (puppeteer)' };
    }
    const playwrightFrom = flag('playwright-from') ||
        path.resolve(PROJECT_ROOT, '..', 'BitmapText.js', 'node_modules', 'playwright');
    const playwright = require(path.resolve(playwrightFrom));
    const type = playwright[browserName];
    if (!type) throw new Error(`unknown --browser=${browserName} (chromium or webkit)`);
    const browser = await type.launch(browserName === 'chromium' ? { args: ['--allow-file-access-from-files'] } : {});
    const page = await (await browser.newContext()).newPage();
    const waitFor = (fn, timeout) => page.waitForFunction(fn, undefined, { timeout });
    return { browser, page, waitFor, label: `${browserName} (playwright)` };
}

// In the page: every visual test rendered with SWCanvas as tests/run-tests.js
// renders it, as base64 PNG bytes from SWCanvas's PngEncoder.
function renderVisualTestsInPage() {
    const tests = VisualRenderingTests.getTests();
    const out = {};
    for (const name of Object.keys(tests)) {
        const t = tests[name];
        try {
            let surface;
            if (typeof t.draw === 'function') {
                const canvas = SWCanvas.createCanvas(t.width, t.height);
                t.draw(canvas);
                surface = canvas._coreSurface;
            } else {
                surface = t.drawSWCanvas(SWCanvas);
            }
            const bytes = new Uint8Array(SWCanvas.Core.PngEncoder.encode(surface));
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            out[name] = { png: btoa(binary) };
        } catch (error) {
            out[name] = { error: error.message };
        }
    }
    return out;
}

(async () => {
    let session;
    try {
        session = await openBrowser();
    } catch (error) {
        console.error(`run-headless: could not start a browser: ${error.message.split('\n')[0]}`);
        console.error('  Pass --playwright-from <path>/node_modules/playwright or --puppeteer-from <path>/node_modules/puppeteer.');
        process.exit(2);
    }
    const { browser, page, waitFor, label } = session;
    const problems = [];
    let exitCode = 0;
    try {
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') pageErrors.push(`console.error: ${message.text()}`);
        });
        await page.goto('file://' + PAGE);
        try {
            await waitFor(() => window.SWCanvasPageResults && window.SWCanvasPageResults.done, PAGE_TIMEOUT_MS);
        } catch (error) {
            console.error(`run-headless: the page did not finish within ${PAGE_TIMEOUT_MS / 1000}s`);
            exitCode = 2;
            return;
        }
        const results = await page.evaluate(() => window.SWCanvasPageResults);
        const core = results.core || {};

        if (results.smokeFonts !== 'loaded') problems.push(`smoke fonts: ${results.smokeFonts}`);
        if (core.error) problems.push(`core harness error: ${core.error}`);
        for (const f of core.failures || []) problems.push(`core ✗ ${f.name}: ${f.message}`);
        for (const e of results.visual.errors) problems.push(`visual error ${e.name}: ${e.message}`);
        for (const e of pageErrors) problems.push(`page error: ${e}`);

        const renders = await page.evaluate(renderVisualTestsInPage);
        let identical = 0;
        for (const [name, r] of Object.entries(renders)) {
            const nodePng = path.join(PROJECT_ROOT, 'tests', 'output', `${name}.basic.png`);
            if (r.error) problems.push(`visual ${name}: ${r.error}`);
            else if (!fs.existsSync(nodePng)) problems.push(`visual ${name}: no Node PNG at tests/output/ (run npm test first)`);
            else if (Buffer.compare(Buffer.from(r.png, 'base64'), fs.readFileSync(nodePng)) !== 0) {
                problems.push(`visual ${name}: browser render differs from Node's tests/output/${name}.basic.png`);
            } else identical++;
        }

        console.log(`Browser page (${label}): core ${core.passed}/${core.total} passed, ` +
            `${(core.skipped || []).length} skipped (need no DOM; npm test runs them), ${(core.failures || []).length} failed; ` +
            `visual ${results.visual.run}/${results.visual.total} drawn, ` +
            `${identical}/${Object.keys(renders).length} byte-identical to Node's PNGs`);
        for (const p of problems) console.log(`  ✗ ${p}`);
        exitCode = problems.length === 0 ? 0 : 1;
        console.log(exitCode === 0 ? '✅ Browser page agrees with Node' : `❌ ${problems.length} problems`);
    } finally {
        await browser.close();
        process.exitCode = exitCode;
    }
})();
