#!/usr/bin/env node
/**
 * Generates build metadata JavaScript file.
 *
 * Usage: node generate-build-info.js <type> <output-path>
 *   type: 'dev' or 'min'
 *   output-path: path to write the build info file
 *
 * Example: node generate-build-info.js dev dist/swcanvas.build-info.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitInfo() {
    try {
        const commitFull = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
        return { commit, commitFull, branch };
    } catch (e) {
        return { commit: 'unknown', commitFull: 'unknown', branch: 'unknown' };
    }
}

function getVersion() {
    try {
        const packagePath = path.join(__dirname, '..', 'package.json');
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        return pkg.version || '0.0.0';
    } catch (e) {
        return '0.0.0';
    }
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: node generate-build-info.js <type> <output-path>');
        console.error('  type: "dev" or "min"');
        console.error('  output-path: path to write the build info file');
        process.exit(1);
    }

    const type = args[0];
    const outputPath = args[1];

    if (type !== 'dev' && type !== 'min') {
        console.error('Error: type must be "dev" or "min"');
        process.exit(1);
    }

    const gitInfo = getGitInfo();
    const version = getVersion();
    const timestamp = new Date().toISOString();

    const buildInfo = {
        timestamp,
        commit: gitInfo.commit,
        commitFull: gitInfo.commitFull,
        branch: gitInfo.branch,
        version,
        type
    };

    const content = `// SWCanvas Build Information
// Generated: ${timestamp}
window.SWCANVAS_BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`Build info written to ${outputPath}`);
}

main();
