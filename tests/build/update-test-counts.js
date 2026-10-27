#!/usr/bin/env node

/**
 * Test Count and Range Updater / Checker
 *
 * The test counts and numbering ranges the documentation states are derived
 * from the files: tests/core/NNN-*.js, tests/visual/NNN-*.js and
 * tests/direct-rendering/cases/*-test.js. Each place a doc states one is an
 * ANCHOR below - a pattern in one file plus how to render it from the files.
 * tests/README.md owns the test documentation (DOCS.md), so it is the one
 * file that states them; other docs point there.
 *
 * A stale count cannot pass unnoticed:
 * - every configured anchor must match in its file - a pattern that matches
 *   nothing is an ERROR naming the file and pattern, never a silent skip;
 * - every phrase that LOOKS like a test count in any doc (COUNT_PHRASES) must
 *   lie inside an anchor's match, so a restatement in a new phrasing is an
 *   ERROR too, rather than a number nobody updates.
 *
 * Usage:
 *   node tests/build/update-test-counts.js          rewrite stale anchors
 *   node tests/build/update-test-counts.js --check  report, rewrite nothing
 *   npm run update-test-counts / npm run check:test-counts
 * Both exit 1 when an anchor is missing or a count phrase is unanchored;
 * --check also exits 1 when any anchor is stale.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Labels for numbering blocks, by hundreds digit (tests/README.md's tree).
const CORE_BLOCK_LABELS = { 3: 'text', 4: '3D' };

const ANCHORS = [
    {
        file: 'tests/README.md',
        pattern: /\b\d+ core tests \+ \d+ visual tests \+ \d+ direct rendering tests\b/g,
        render: f => `${f.core.count} core tests + ${f.visual.count} visual tests + ${f.direct.count} direct rendering tests`
    },
    {
        file: 'tests/README.md',
        pattern: /# \d+ individual core test files \([^)\n]*\)/g,
        render: f => `# ${f.core.count} individual core test files (${f.core.ranges})`
    },
    {
        file: 'tests/README.md',
        pattern: /# \d+ individual visual test files \([^)\n]*\)/g,
        render: f => `# ${f.visual.count} individual visual test files (${f.visual.ranges})`
    },
    {
        file: 'tests/README.md',
        pattern: /# \d+ individual parametrized test case files\b/g,
        render: f => `# ${f.direct.count} individual parametrized test case files`
    }
];

// Phrases that state a test count. Any match outside an anchor's match is an
// unanchored count. They cover the phrasings the docs have used; a phrasing
// none of them matches is not caught, so prefer pointing at tests/README.md
// over restating a number.
const COUNT_PHRASES = [
    // "95 core + 157 visual"
    /\b\d+\s+core\s*\+\s*\d+\s+visual\b/gi,
    // "157 visual tests", "85 direct-renderer correctness tests", "106 modular core functionality tests"
    /\b\d+\+?\s+(?:[A-Za-z-]+\s+){0,2}(?:core|visual|direct[- ]render\w*)(?:\s+[A-Za-z-]+){0,3}?\s+(?:tests?|test\s+files?|test\s+cases?)\b/gi,
    // "37 unit tests", "144 individual test files", "85 parametrized test cases"
    /\b\d+\+?\s+(?:individual|parametrized|unit)\s+(?:[A-Za-z-]+\s+){0,2}(?:tests?|files?|cases?)\b/gi,
    // "85 test files"
    /\b\d+\+?\s+test\s+files?\b/gi,
    // headings like "Core Functionality Tests - 88 Individual Files"
    /\btests?\s+-\s+\d+\b/gi,
    // "(85 tests)", "PNG test images (144+ files)"
    /\(\d+\+?\s+tests?\)/gi,
    /\btest\s+images\s+\(\d+\+?\s+files?\)/gi
];

// Every Markdown doc, minus generated/vendored trees and the dated plans.
const DOC_EXCLUDE = new Set(['node_modules', '.git', 'dist', 'plans', 'font-assets', 'bitmaptext', 'output']);

function listDocs(dir = PROJECT_ROOT, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!DOC_EXCLUDE.has(entry.name)) listDocs(path.join(dir, entry.name), out);
        } else if (/\.md$/i.test(entry.name)) {
            out.push(path.relative(PROJECT_ROOT, path.join(dir, entry.name)));
        }
    }
    return out.sort();
}

/** Numbers of the NNN-*.js files in a directory, sorted (duplicates kept). */
function testNumbers(dir) {
    return fs
        .readdirSync(path.join(PROJECT_ROOT, dir))
        .filter(file => /^\d{3}-.*\.js$/.test(file))
        .map(file => parseInt(file.substring(0, 3), 10))
        .sort((a, b) => a - b);
}

/** "001-086 + 300-308 text + 401-410 3D": contiguous runs of the distinct numbers. */
function renderRanges(numbers, labels = {}) {
    const distinct = [...new Set(numbers)];
    const runs = [];
    for (const n of distinct) {
        const last = runs[runs.length - 1];
        if (last && n === last.end + 1) last.end = n;
        else runs.push({ start: n, end: n });
    }
    const pad = n => String(n).padStart(3, '0');
    return runs
        .map(({ start, end }) => {
            const label = labels[Math.floor(start / 100)];
            const range = start === end ? pad(start) : `${pad(start)}-${pad(end)}`;
            return label ? `${range} ${label}` : range;
        })
        .join(' + ');
}

function gatherFacts() {
    const core = testNumbers('tests/core');
    const visual = testNumbers('tests/visual');
    const directDir = path.join(PROJECT_ROOT, 'tests/direct-rendering/cases');
    const direct = fs.readdirSync(directDir).filter(file => file.endsWith('-test.js')).length;
    return {
        core: { count: core.length, ranges: renderRanges(core, CORE_BLOCK_LABELS) },
        visual: { count: visual.length, ranges: renderRanges(visual) },
        direct: { count: direct }
    };
}

function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

function run(checkOnly) {
    const facts = gatherFacts();
    console.log(
        `Files: ${facts.core.count} core (${facts.core.ranges}), ` +
            `${facts.visual.count} visual (${facts.visual.ranges}), ${facts.direct.count} direct rendering`
    );

    const errors = [];
    const stale = [];
    const anchoredSpans = {}; // file -> [[start, end), ...] in the CURRENT text
    const texts = {};
    const read = file => {
        if (!(file in texts)) texts[file] = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8');
        return texts[file];
    };

    for (const anchor of ANCHORS) {
        const text = read(anchor.file);
        const matches = [...text.matchAll(anchor.pattern)];
        if (matches.length === 0) {
            errors.push(`MISSING ANCHOR ${anchor.file}: ${anchor.pattern} matches nothing`);
            continue;
        }
        const expected = anchor.render(facts);
        for (const m of matches) {
            (anchoredSpans[anchor.file] = anchoredSpans[anchor.file] || []).push([m.index, m.index + m[0].length]);
            if (m[0] !== expected) {
                stale.push({ file: anchor.file, line: lineOf(text, m.index), from: m[0], to: expected });
            }
        }
    }

    for (const file of listDocs()) {
        const text = read(file);
        const spans = anchoredSpans[file] || [];
        for (const phrase of COUNT_PHRASES) {
            for (const m of text.matchAll(phrase)) {
                const inside = spans.some(([start, end]) => m.index >= start && m.index + m[0].length <= end);
                if (!inside) {
                    errors.push(`UNANCHORED COUNT ${file}:${lineOf(text, m.index)}: "${m[0].trim()}"`);
                }
            }
        }
    }

    for (const s of stale) {
        console.log(`${checkOnly ? 'STALE' : 'UPDATED'} ${s.file}:${s.line}: "${s.from}" -> "${s.to}"`);
    }
    if (!checkOnly && stale.length > 0) {
        const byFile = {};
        for (const s of stale) (byFile[s.file] = byFile[s.file] || []).push(s);
        for (const file of Object.keys(byFile)) {
            let text = texts[file];
            for (const anchor of ANCHORS.filter(a => a.file === file)) {
                text = text.replace(anchor.pattern, anchor.render(facts));
            }
            fs.writeFileSync(path.join(PROJECT_ROOT, file), text, 'utf8');
        }
    }

    // A count phrase is reported once even when two detectors overlap on it,
    // and the report reads in file and line order.
    const location = e => {
        const m = e.match(/ ([^ ]+):(\d+): /);
        return m ? [m[1], Number(m[2])] : ['', 0];
    };
    const uniqueErrors = [...new Set(errors)].sort((x, y) => {
        const [fx, lx] = location(x);
        const [fy, ly] = location(y);
        return fx === fy ? lx - ly : fx < fy ? -1 : 1;
    });
    uniqueErrors.forEach(e => console.log(e));

    const failed = uniqueErrors.length > 0 || (checkOnly && stale.length > 0);
    if (failed) {
        console.log(
            `\n❌ Test counts: ${checkOnly ? stale.length + ' stale, ' : ''}${uniqueErrors.length} error(s). ` +
                'State counts only through the anchors in tests/build/update-test-counts.js (tests/README.md).'
        );
        process.exitCode = 1;
    } else {
        console.log(
            checkOnly
                ? '\n✅ Test counts and ranges match the files.'
                : `\n✅ Test counts and ranges are current (${stale.length} updated).`
        );
    }
}

if (require.main === module) {
    run(process.argv.includes('--check'));
}

module.exports = { gatherFacts, renderRanges, ANCHORS, COUNT_PHRASES };
