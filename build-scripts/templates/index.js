/**
 * Template Registry - Aggregates all template levels
 *
 * Template Hierarchy:
 *   Level 0 (Base):     BLEND_ALPHA, SET_OPAQUE
 *   Level 1 (Clipped):  *_CLIPPED → chains to Level 0
 *   Level 2 (Arc):      *_ARC_FAST_CLIPPED → chains to Level 1
 *
 * Chained expansion: Templates can reference other templates via nested markers.
 * The preprocessor performs multi-pass expansion until no markers remain.
 *
 * See ARCHITECTURE.md "Check Once, Check Correctly" for clipping contract details.
 */

const BASE_TEMPLATES = require('./base');
const CLIPPED_TEMPLATES = require('./clipped');
const ARC_TEMPLATES = require('./arc');

const TEMPLATES = {
    ...BASE_TEMPLATES,
    ...CLIPPED_TEMPLATES,
    ...ARC_TEMPLATES
};

module.exports = TEMPLATES;
