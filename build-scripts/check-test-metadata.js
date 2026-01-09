#!/usr/bin/env node
/**
 * This script checks all direct-rendering test files for comprehensive metadata validation.
 *
 * For all test files:
 * 1. Validates registerDirectRenderingTest metadata has title and description properties
 * 2. Validates the filename parameter in registerDirectRenderingTest matches the actual file
 * 3. Validates filename is parsable according to the naming convention
 * 4. Validates drawTest function has the expected signature: function drawTest(ctx, iterationNumber, instances)
 *
 * This is a read-only script and does not modify any files.
 *
 * Usage:
 *   node build-scripts/check-test-metadata.js
 */

const fs = require('fs');
const path = require('path');

// Import the test name parser
const TestNameParserPath = path.join(__dirname, '../tests/direct-rendering/test-name-parser.js');
const TestNameParserCode = fs.readFileSync(TestNameParserPath, 'utf8');

// Create a safe environment to evaluate the parser
const vm = require('vm');
const context = vm.createContext({
  console: console // Add console for any potential logging
});

// Execute the code and extract the TestNameParser class
// Wrap the code to make the class available as a property
const wrappedCode = TestNameParserCode + '\nthis.TestNameParser = TestNameParser;';
vm.runInContext(wrappedCode, context);

// The class should now be available in the context
const TestNameParser = context.TestNameParser;

if (!TestNameParser) {
  console.error('TestNameParser not found in context. Available keys:', Object.keys(context));
  process.exit(1);
}

// Configuration
const TEST_CASE_DIR = path.join(__dirname, '../tests/direct-rendering/cases');

/**
 * Find all test files in the test cases directory
 */
function findTestFiles() {
  try {
    const files = fs.readdirSync(TEST_CASE_DIR);
    return files
      .filter(file => file.endsWith('.js') && file.includes('test'))
      .map(file => path.join(TEST_CASE_DIR, file));
  } catch (error) {
    console.error(`Error reading test directory: ${error.message}`);
    return [];
  }
}

/**
 * Validate registerDirectRenderingTest metadata
 */
function validateRegisterMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const actualFilename = path.basename(filePath);

  // Check for registerDirectRenderingTest call
  if (!content.includes('registerDirectRenderingTest')) {
    errors.push('RegisterDirectRenderingTest: Call not found');
    return errors;
  }

  // Find the registerDirectRenderingTest line and extract metadata section
  const lines = content.split('\n');
  const registerLineIndex = lines.findIndex(line =>
    line.includes('registerDirectRenderingTest')
  );

  if (registerLineIndex === -1) {
    errors.push('RegisterDirectRenderingTest: Cannot locate call');
    return errors;
  }

  // Extract about 150 lines after registerDirectRenderingTest to capture metadata
  // (metadata object can be far from the registration call in longer test functions)
  const metadataSection = lines
    .slice(registerLineIndex, registerLineIndex + 150)
    .join('\n');

  // Check for required properties (title and description)
  const requiredProps = ['title:', 'description:'];
  requiredProps.forEach(prop => {
    if (!metadataSection.includes(prop)) {
      const propName = prop.replace(':', '');
      errors.push(`Metadata '${propName}': Missing`);
    }
  });

  // Extract and validate the filename parameter
  const filenameMatch = content.match(/registerDirectRenderingTest\s*\(\s*['"`]([^'"`]+)['"`]/);
  if (filenameMatch) {
    const declaredFilename = filenameMatch[1];
    const actualFilenameWithoutExt = actualFilename.replace(/\.js$/, '');
    // The registration uses the name without .js, so compare both ways
    if (declaredFilename !== actualFilenameWithoutExt &&
        declaredFilename !== actualFilename &&
        declaredFilename + '-test' !== actualFilenameWithoutExt) {
      errors.push(`Filename Mismatch: Declared '${declaredFilename}' but actual file is '${actualFilename}'`);
    }
  } else {
    errors.push('RegisterDirectRenderingTest: Cannot extract filename parameter');
  }

  return errors;
}

/**
 * Validate filename parsing
 */
function validateFilenameParsing(filename, parser) {
  const basename = path.basename(filename);
  const parseResult = parser.parseTestName(basename);

  return parseResult.errors || [];
}

/**
 * Validate drawTest function signature
 */
function validateDrawTestSignature(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];

  // The expected signature pattern (allows some flexibility in whitespace)
  const signaturePatterns = [
    /function\s+drawTest\s*\(\s*ctx\s*,\s*iterationNumber\s*,\s*instances\s*\)/,
    /function\s+drawTest\s*\(\s*ctx\s*,\s*iterationNumber\s*,\s*instances\s*=\s*null\s*\)/
  ];

  const hasValidSignature = signaturePatterns.some(pattern => pattern.test(content));

  if (!hasValidSignature) {
    errors.push("DrawTest Function: Missing or incorrect signature. Expected 'function drawTest(ctx, iterationNumber, instances)'");

    // Try to find any drawTest function for better error reporting
    const drawTestMatch = content.match(/function\s+drawTest\s*\([^)]*\)/);
    if (drawTestMatch) {
      errors.push(`DrawTest Function: Found '${drawTestMatch[0]}' but expected 'function drawTest(ctx, iterationNumber, instances)'`);
    }
  }

  return errors;
}

/**
 * Main function
 */
function main() {
  console.log('Checking comprehensive metadata for all direct-rendering test files...\n');

  const testFiles = findTestFiles();

  if (testFiles.length === 0) {
    console.log('No test files were found.');
    return;
  }

  const parser = new TestNameParser();
  let errorsFound = 0;
  let filesChecked = 0;

  testFiles.forEach(filePath => {
    filesChecked++;
    const filename = path.basename(filePath);

    console.log(`\u{1F4C4} ${filename}`);

    let fileErrors = [];

    // Validate registerDirectRenderingTest metadata
    const metadataErrors = validateRegisterMetadata(filePath);
    if (metadataErrors.length > 0) {
      fileErrors.push(...metadataErrors.map(err => `   \u{274C} ${err}`));
    } else {
      console.log('   \u{2705} RegisterDirectRenderingTest: Call found');
      console.log('   \u{2705} Metadata \'title\': Present');
      console.log('   \u{2705} Metadata \'description\': Present');
      console.log('   \u{2705} Filename Parameter: Matches actual filename');
    }

    // Validate drawTest function signature
    const drawTestErrors = validateDrawTestSignature(filePath);
    if (drawTestErrors.length > 0) {
      fileErrors.push(...drawTestErrors.map(err => `   \u{274C} ${err}`));
    } else {
      console.log('   \u{2705} DrawTest Function: Correct signature found');
    }

    // Validate filename parsing
    const parsingErrors = validateFilenameParsing(filename, parser);
    if (parsingErrors.length > 0) {
      fileErrors.push(`   \u{274C} Filename Parsing: ${parsingErrors.length} error(s)`);
      parsingErrors.forEach(error => {
        fileErrors.push(`      \u{2022} ${error}`);
      });
    } else {
      console.log('   \u{2705} Filename Parsing: Valid according to naming convention');
    }

    // Display any errors
    if (fileErrors.length > 0) {
      fileErrors.forEach(error => console.log(error));
      errorsFound++;
    }

    console.log('');
  });

  // Summary
  console.log('--------------------------------------------------');
  console.log(`Check complete. Scanned ${filesChecked} file(s).`);

  if (errorsFound === 0) {
    console.log('\u{2705} All test files have valid metadata (registerDirectRenderingTest properties + filename parameters + parsable filenames + drawTest function signature).');
    process.exit(0);
  } else {
    console.log(`\u{274C} Found ${errorsFound} file(s) with metadata issues.`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  validateFilenameParsing,
  validateRegisterMetadata,
  validateDrawTestSignature
};
