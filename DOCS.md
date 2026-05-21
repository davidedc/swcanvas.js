# Documentation Index

## Documentation Strategy

Each document has a **single responsibility** to avoid duplication:

### Primary Responsibilities

- **README.md**: Quick start, API examples, build instructions, brief testing overview
- **ARCHITECTURE.md**: System design, component organization, architectural patterns, OO design
- **tests/README.md**: Complete test system documentation, adding tests, build utilities
- **tests/direct-rendering/README.md**: Direct rendering test API, dual-mode pattern, check options, utilities, naming conventions
- **tests/direct-rendering/PERFORMANCE-BENCHMARKING.md**: Performance benchmarking mechanics (VSync cliff detection, scaling correction)
- **tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md**: Workflow guide for benchmarking code changes (regressions, improvements, discovery)
- **tests/build/README.md**: Build utility scripts documentation (concat-tests.js, renumber-tests.js)
- **build-scripts/README.md**: Build scripts documentation, inline markers system, preprocessor templates
- **debug/README.md**: Debug utilities, investigation scripts, and debugging workflows
- **examples/README.md**: Examples documentation and usage instructions
- **DIRECT-RENDERING-SUMMARY.MD**: Direct rendering system documentation, APIs, conditions, and implementation details
- **test_naming_convention.md**: Test file naming conventions, facet abbreviations, and naming rules
- **TEXT-INTEGRATION-HANDOFF.md**: Text rendering integration — vendored BitmapText engine, fast/slow render paths, vendor refresh workflow, LRU demo
- **CLAUDE.md**: Claude-specific development context and workflow tips ONLY

### What NOT to Include (Anti-Duplication Rules)

**README.md should NOT contain:**
- Detailed test architecture (→ tests/README.md)
- Detailed build utility instructions (→ tests/build/README.md)
- Architecture implementation details (→ ARCHITECTURE.md)

**CLAUDE.md should NOT contain:**
- API usage examples (→ README.md)
- Test architecture details (→ tests/README.md)
- Architecture explanations (→ ARCHITECTURE.md)
- Detailed inline markers documentation (→ build-scripts/README.md)
- Inferable information (OO patterns, file organization, generic principles)

**ARCHITECTURE.md should NOT contain:**
- API usage examples (→ README.md)
- Test development instructions (→ tests/README.md)

**tests/README.md should NOT contain:**
- API examples (→ README.md)
- Architecture theory (→ ARCHITECTURE.md)

### Cross-Reference Pattern

**Instead of duplicating content, use references:**
- "See README.md for API examples"
- "See ARCHITECTURE.md for design details" 
- "See tests/README.md for test documentation"
- "See tests/build/README.md for build utilities"

### Single Source of Truth

- **API examples**: README.md only
- **Architecture details**: ARCHITECTURE.md only
- **Test documentation**: tests/README.md only
- **Direct rendering tests**: tests/direct-rendering/README.md only
- **Performance benchmarking mechanics**: tests/direct-rendering/PERFORMANCE-BENCHMARKING.md only
- **Performance testing workflow**: tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md only
- **Build utilities**: tests/build/README.md only
- **Inline markers/preprocessor**: build-scripts/README.md only
- **Debug utilities**: debug/README.md only
- **Direct rendering system**: DIRECT-RENDERING-SUMMARY.MD only
- **Test naming conventions**: test_naming_convention.md only
- **Text rendering integration**: TEXT-INTEGRATION-HANDOFF.md only
- **Claude guidance**: CLAUDE.md only (no duplication from other docs)

## Quick Navigation

- **Getting started** → README.md
- **Understanding the design** → ARCHITECTURE.md
- **Adding/running tests** → tests/README.md
- **Direct rendering tests** → tests/direct-rendering/README.md
- **Performance benchmarking** → tests/direct-rendering/PERFORMANCE-BENCHMARKING.md
- **Performance testing workflow** → tests/direct-rendering/PERFORMANCE-TESTING-WORKFLOW.md
- **Build utilities** → tests/build/README.md
- **Build scripts & inline markers** → build-scripts/README.md
- **Debug utilities** → debug/README.md
- **Examples and demos** → examples/README.md
- **Direct rendering system** → DIRECT-RENDERING-SUMMARY.MD
- **Test naming conventions** → test_naming_convention.md
- **Text rendering integration** → TEXT-INTEGRATION-HANDOFF.md
- **Development with Claude** → CLAUDE.md

## Documentation Maintenance

### Automated Test Count Synchronization

**Command**: `npm run update-test-counts`

Single command automatically synchronizes all test count references across the entire documentation suite, ensuring perpetual accuracy with zero manual effort.

**Usage**: Run this command whenever test files are added or removed to keep all documentation (README.md, CLAUDE.md, tests/README.md) accurate with current test counts. The script scans actual filesystem and updates 15+ different reference patterns throughout the documentation.