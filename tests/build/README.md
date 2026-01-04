# SWCanvas.js Test Build Utilities

This directory contains utility scripts for managing the SWCanvas.js test system.

## Scripts Overview

### `concat-tests.js`
**Purpose**: Concatenates individual modular test files into unified test suites for optimal performance.

**What it does**:
- Combines all test files from `/tests/core/` into `tests/dist/core-functionality-tests.js`
- Combines all test files from `/tests/visual/` into `tests/dist/visual-rendering-tests.js`
- Maintains proper test ordering and dependencies
- Handles fallback to original files when modular files are unavailable
- Used automatically by `npm run build`

**Usage**: Called automatically by the build system, not typically run directly.

### `update-test-counts.js`
**Purpose**: Automatically updates test count references throughout all documentation files to match actual filesystem counts.

**What it does**:
- Counts actual test files in `/tests/core/`, `/tests/visual/`, and `/tests/direct-rendering/cases/` directories
- Updates all documentation files (README.md, CLAUDE.md, tests/README.md) with correct counts
- Maintains consistency across all test count references using regex patterns
- Validates counts for reasonableness before applying updates

**Usage**:
```bash
# Update test count references to match current file counts
node tests/build/update-test-counts.js

# Or use as npm script (if configured)
npm run update-test-counts
```

**When to use**:
- After adding or removing test files to keep documentation accurate
- As part of automated CI/CD pipeline to prevent documentation drift
- Before releasing to ensure all documentation reflects current test coverage
- When restructuring test suites

**Output**: The script provides detailed logging of changes made and suggests appropriate commit messages.

### `renumber-tests.js`
**Purpose**: Renumbers test files to make space for inserting new tests at specific positions.

**What it does**:
- Shifts test file numbers (e.g., 025-test.js → 026-test.js)
- Preserves git history when possible using `git mv`
- Generates undo scripts for reverting changes
- Provides dry-run mode for previewing changes

**Usage**:
```bash
# Make space for a new visual test at position 25
node tests/build/renumber-tests.js --type visual --position 25 --shift forward

# Close a gap after removing core test 15
node tests/build/renumber-tests.js --type core --position 15 --shift backward

# Preview changes without executing
node tests/build/renumber-tests.js --type visual --position 30 --shift forward --dry-run
```

**Arguments**:
- `--type`: Test type ('core' or 'visual')
- `--position`: Position to insert/remove at (1-999)
- `--shift`: Direction ('forward' to make space, 'backward' to close gap)
- `--dry-run`: Preview changes without executing
- `--git`: Use git mv (auto-detected)
- `--help`: Show detailed help

## Workflow for Adding Tests in the Middle

When you want to add a new test at a specific position (e.g., position 25) instead of at the end:

### 1. **Make space for the new test**
```bash
# Shift all tests from position 25 onwards forward by 1
node tests/build/renumber-tests.js --type visual --position 25 --shift forward
```

This renames:
- `025-existing-test.js` → `026-existing-test.js`
- `026-another-test.js` → `027-another-test.js`
- And so on...

### 2. **Create your new test file**
```bash
# Now position 025 is free
echo "// Test: My New Test" > tests/visual/025-my-new-test.js
# Add your test implementation...
```

### 3. **Rebuild and test**
```bash
npm run build  # Regenerate built test files
npm test       # Run all tests including your new one
```

### 4. **Undo if needed**
The renumbering script generates an `undo-renumber.sh` script:
```bash
./undo-renumber.sh  # Revert the renumbering operation
```

## File Naming Convention

**Note**: This naming convention applies to `/tests/core/` and `/tests/visual/` directories only. Direct rendering tests in `/tests/direct-rendering/cases/` use a different parametrized naming scheme (e.g., `rect-fill-opaque-test.js`, `circle-m8-szMix-fOpaq-test.js`).

Test files in `/tests/core/` and `/tests/visual/` follow this naming pattern:
- **Format**: `{3-digit-number}-{descriptive-name}.js`
- **Examples**:
  - `001-simple-rectangle-test.js`
  - `025-enhanced-clipping-intersection-test.js`
  - `056-stroke-pixel-analysis-test.js`

**Internal Structure**:
```javascript
// Test {number}: {description}
// This file will be concatenated into the main test suite

// Test {number}
registerVisualTest('test-id', {
    name: 'Human-readable test name',
    width: 200, height: 150,
    draw: function(canvas) {
        // Test implementation
    }
});
```

## Directory Structure

```
tests/build/
├── README.md              # This documentation
├── concat-tests.js        # Test concatenation utility
├── update-test-counts.js  # Automated test count updater
└── renumber-tests.js      # Test renumbering utility
```

## Error Handling and Safety

### Renumbering Safety Features:
- **Conflict detection**: Checks for existing files before renaming
- **Dry-run mode**: Preview changes without executing
- **Undo scripts**: Automatic generation of revert scripts
- **Git integration**: Preserves history with `git mv` when available
- **Input validation**: Comprehensive argument and state checking

### Common Error Scenarios:
1. **Conflict**: Target file already exists
   - **Solution**: Use `--dry-run` to preview, resolve conflicts manually
   
2. **Git not available**: Script falls back to regular `mv`
   - **Solution**: Manual git history preservation if needed
   
3. **Invalid position**: Position outside valid range (1-999)
   - **Solution**: Check existing test numbers, use valid range
   
4. **Missing directory**: Test directory doesn't exist
   - **Solution**: Ensure you're in the correct project directory

## Integration with Build System

The build utilities integrate seamlessly with the main SWCanvas build process:

```bash
# Full development cycle
npm run build              # Runs concat-tests.js automatically
npm test                   # Uses built test files from /tests/dist/

# Test development cycle
node tests/build/renumber-tests.js --type visual --position 30 --shift forward
# Create your new test at position 030
npm run build              # Rebuild with new test
npm test                   # Verify all tests pass
```

## Tips and Best Practices

### When to Use Renumbering:
- **Logical grouping**: Keep related tests together numerically
- **Feature organization**: Group tests by Canvas API features
- **Maintenance**: Insert regression tests near related functionality

### When NOT to Use Renumbering:
- **Simple additions**: If adding at the end, just use the next number
- **Temporary tests**: For debugging, use high numbers that won't conflict
- **Major reorganization**: Consider if the current organization serves the project

### Recommended Workflow:
1. **Plan first**: Use `--dry-run` to see the impact
2. **Small batches**: Renumber small ranges to minimize disruption
3. **Test thoroughly**: Run full test suite after renumbering
4. **Commit atomically**: Commit renumbering and new test separately for clear history

### Git Integration:
- **Auto-detection**: Script detects git repositories automatically
- **History preservation**: Uses `git mv` to maintain file history
- **Clean commits**: Renumbering shows as file moves, not deletions/additions
- **Undo support**: Generated undo scripts use appropriate git commands

This comprehensive utility system ensures that test organization remains maintainable as the SWCanvas test suite continues to grow and evolve.