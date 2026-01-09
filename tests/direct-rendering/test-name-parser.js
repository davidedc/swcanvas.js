// Test filename parser based on the naming convention
// Adapted for SWCanvas direct-rendering tests
class TestNameParser {
  constructor() {
    // Mapping from abbreviations to full names
    this.facetMappings = {
      // Shape
      'line': 'Line',
      'circle': 'Circle',
      'rect': 'Rectangle',
      'roundrect': 'Rounded Rectangle',
      'arc': 'Arc',
      'scene': 'Scene',
      'mixshape': 'Mixed Shapes',

      // Count
      'sgl': 'Single',
      'multi': 'Multiple',

      // Size
      'xs': 'Extra Small (5-15px)',
      's': 'Small (16-39px)',
      'm': 'Medium (40-79px)',
      'l': 'Large (80-159px)',
      'xl': 'Extra Large (160-400px)',
      'szMix': 'Mixed Sizes',
      'szRand': 'Random Sizes',

      // Fill Style
      'fNone': 'No Fill',
      'fOpaq': 'Opaque Fill',
      'fSemi': 'Semitransparent Fill',
      'fMix': 'Mixed Fill',

      // Stroke Style
      'sNone': 'No Stroke',
      'sOpaq': 'Opaque Stroke',
      'sSemi': 'Semitransparent Stroke',
      'sMix': 'Mixed Stroke',

      // Layout
      'lytSpread': 'Spread Layout',
      'lytGrid': 'Grid Layout',
      'lytRand': 'Random Layout',
      'lytCenter': 'Centered Layout',
      'lytMix': 'Mixed Layout',

      // Centered At
      'cenPx': 'Pixel-Centered',
      'cenGrid': 'Grid-Centered',
      'cenMixPG': 'Mixed Pixel/Grid-Centered',
      'cenMix': 'Mixed Centered',
      'cenRand': 'Random-Centered',

      // Edge Alignment
      'edgeCrisp': 'Crisp Edges',
      'edgeNotCrisp': 'Non-Crisp Edges',
      'edgeMix': 'Mixed Edge Alignment',

      // Orientation
      'ornHoriz': 'Horizontal',
      'ornVert': 'Vertical',
      'ornAxial': 'Axis-Aligned',
      'ornDeg45': '45-Degree',
      'ornDiag': 'Diagonal',
      'ornRand': 'Random Orientation',
      'ornMix': 'Mixed Orientation',
      'ornRot': 'Rotated',

      // Arc Angle Extent
      'arcADeg90': '90-Degree Arc',
      'arcASmall': 'Small Arc Angle',
      'arcARand': 'Random Arc Angle',
      'arcAMix': 'Mixed Arc Angles',

      // Quadrant (Arc-specific)
      'quadRand': 'Random Quadrant',

      // Round Rect Radius
      'rrrLrg': 'Large Radius',
      'rrrRand': 'Random Radius',
      'rrrMix': 'Mixed Radius',

      // Context Transformations
      'ctxTransFixed': 'Fixed Translation',
      'ctxTransRand': 'Random Translation',
      'ctxRotFixed': 'Fixed Rotation',
      'ctxRotRand': 'Random Rotation',
      'ctxScaleFixed': 'Fixed Scaling',
      'ctxScaleRand': 'Random Scaling',

      // Special Modifiers
      'nonInt': 'Non-Integer Values',

      // Clipping
      'clpOnCirc': 'Circle',
      'clpOnArc': 'Arc',
      'clpOnRect': 'Rectangle',
      'clpOnRoundRect': 'Rounded Rectangle',
      'clpCt1': 'Single',
      'clpCtN': 'Multiple',
      'clpArrCenter': 'Centered',
      'clpArrRand': 'Random',
      'clpArrGrid': 'Grid',
      'clpArrSpread': 'Spread',
      'clpSzXs': 'Extra Small (5-15px)',
      'clpSzS': 'Small (16-39px)',
      'clpSzM': 'Medium (40-79px)',
      'clpSzL': 'Large (80-159px)',
      'clpSzXl': 'Extra Large (160-400px)',
      'clpSzMix': 'Mixed Sizes',
      'clpEdgeCrisp': 'Crisp',
      'clpEdgeNotCrisp': 'Non-Crisp'
    };

    // Facet categories in order
    this.facetOrder = [
      'Shape', 'Count', 'Size', 'Fill Style', 'Stroke Style', 'Stroke Thickness',
      'Layout', 'Centered At', 'Edge Alignment', 'Orientation', 'Arc Angle', 'Quadrant',
      'Round Rect Radius', 'Context Translation', 'Context Rotation', 'Context Scaling',
      'Special Modifiers', 'Clipping'
    ];
  }

  parseTestName(filename) {
    const errors = [];

    // Remove .js extension and split by dashes
    const nameWithoutExt = filename.replace(/\.js$/, '');
    const parts = nameWithoutExt.split('-');

    // Validate basic structure
    if (parts.length < 2) {
      errors.push(`Filename too short - needs at least shape and count: ${filename}`);
    }

    // Remove 'test' from the end
    if (parts[parts.length - 1] === 'test') {
      parts.pop();
    } else {
      errors.push(`Filename must end with '-test.js': ${filename}`);
    }

    const facets = {};
    let i = 0;

    // Initialize all facets to N/A first
    facets['Shape'] = 'N/A';
    facets['Count'] = 'N/A';
    facets['Size'] = 'N/A';
    facets['Fill Style'] = 'N/A';
    facets['Stroke Style'] = 'N/A';
    facets['Stroke Thickness'] = 'N/A';
    facets['Layout'] = 'N/A';
    facets['Centered At'] = 'N/A';
    facets['Edge Alignment'] = 'N/A';
    facets['Orientation'] = 'N/A';
    facets['Arc Angle'] = 'N/A';
    facets['Quadrant'] = 'N/A';
    facets['Round Rect Radius'] = 'N/A';
    facets['Context Translation'] = 'N/A';
    facets['Context Rotation'] = 'N/A';
    facets['Context Scaling'] = 'N/A';
    facets['Special Modifiers'] = 'N/A';
    facets['Clip Shape'] = 'N/A';
    facets['Clip Count'] = 'N/A';
    facets['Clip Arrangement'] = 'N/A';
    facets['Clip Size'] = 'N/A';
    facets['Clip Edge Alignment'] = 'N/A';

    // Parse in expected order
    if (i < parts.length) {
      const shapePart = parts[i++];
      if (!this.isValidShape(shapePart)) {
        errors.push(`Invalid shape '${shapePart}' - expected: line, circle, rect, roundrect, arc, scene, mixshape`);
      }
      facets['Shape'] = this.mapValue(shapePart);
    } else {
      errors.push('Missing required shape facet (position 1)');
    }

    if (i < parts.length) {
      // Handle count (sgl, multi, m[N])
      const countPart = parts[i++];
      if (countPart.startsWith('m') && /^\d+$/.test(countPart.substring(1))) {
        facets['Count'] = `Multi-${countPart.substring(1)}`;
      } else if (this.isValidCount(countPart)) {
        facets['Count'] = this.mapValue(countPart);
      } else {
        errors.push(`Invalid count '${countPart}' - expected: sgl, multi, or m[number]`);
        facets['Count'] = this.mapValue(countPart);
      }
    } else {
      errors.push('Missing required count facet (position 2)');
    }

    if (i < parts.length) {
      const sizePart = parts[i];
      if (this.isValidSize(sizePart)) {
        facets['Size'] = this.mapValue(sizePart);
        i++;
      } else if (sizePart.startsWith('f')) {
        // Size was omitted, proceeding to fill style
        // This is valid for tests like line-sgl-fNone-...
      } else {
        errors.push(`Invalid size '${sizePart}' - expected: xs, s, m, l, xl, szMix, szRand`);
        i++;
      }
    }

    if (i < parts.length && parts[i].startsWith('f')) {
      const fillPart = parts[i++];
      if (!this.isValidFillStyle(fillPart)) {
        errors.push(`Invalid fill style '${fillPart}' - expected: fNone, fOpaq, fSemi, fMix`);
      }
      facets['Fill Style'] = this.mapValue(fillPart);
    }

    if (i < parts.length && parts[i].startsWith('s') && !parts[i].startsWith('sw')) {
      const strokePart = parts[i++];
      if (!this.isValidStrokeStyle(strokePart)) {
        errors.push(`Invalid stroke style '${strokePart}' - expected: sNone, sOpaq, sSemi, sMix`);
      }
      facets['Stroke Style'] = this.mapValue(strokePart);
    }

    if (i < parts.length && parts[i].startsWith('sw')) {
      let strokeThicknessPart = parts[i++];

      // Check if this is a range that got split (sw1-10px becomes sw1, 10px)
      if (i < parts.length && strokeThicknessPart.match(/^sw\d+$/) && parts[i].match(/^\d+px$/)) {
        strokeThicknessPart = strokeThicknessPart + '-' + parts[i++];
      }

      if (!this.isValidStrokeThickness(strokeThicknessPart)) {
        errors.push(`Invalid stroke thickness '${strokeThicknessPart}' - expected: swMix, sw0, sw[N]px, or sw[N]-[M]px`);
      }

      // Handle stroke thickness (sw0, sw1px, sw1-10px, swMix)
      if (strokeThicknessPart === 'swMix') {
        facets['Stroke Thickness'] = 'Mixed Thickness';
      } else if (strokeThicknessPart === 'sw0') {
        facets['Stroke Thickness'] = '0 (No Stroke)';
      } else {
        facets['Stroke Thickness'] = strokeThicknessPart.replace('sw', '') + (strokeThicknessPart.includes('px') ? '' : ' pixels');
      }
    }

    // Parse remaining parts by prefix
    while (i < parts.length) {
      const part = parts[i++];

      if (part.startsWith('lyt')) {
        facets['Layout'] = this.mapValue(part);
      } else if (part.startsWith('cen')) {
        facets['Centered At'] = this.mapValue(part);
      } else if (part.startsWith('edge')) {
        facets['Edge Alignment'] = this.mapValue(part);
      } else if (part.startsWith('orn')) {
        facets['Orientation'] = this.mapValue(part);
      } else if (part.startsWith('arcA')) {
        facets['Arc Angle'] = this.mapValue(part);
      } else if (part.startsWith('quad')) {
        facets['Quadrant'] = this.mapValue(part);
      } else if (part.startsWith('rrr')) {
        // Handle rrrFix[N] pattern
        if (part.startsWith('rrrFix') && /^\d+$/.test(part.substring(6))) {
          facets['Round Rect Radius'] = `Fixed ${part.substring(6)}px`;
        } else {
          facets['Round Rect Radius'] = this.mapValue(part);
        }
      } else if (part.startsWith('ctxTrans')) {
        facets['Context Translation'] = this.mapValue(part);
      } else if (part.startsWith('ctxRot')) {
        facets['Context Rotation'] = this.mapValue(part);
      } else if (part.startsWith('ctxScale')) {
        facets['Context Scaling'] = this.mapValue(part);
      } else if (part === 'nonInt') {
        facets['Special Modifiers'] = this.mapValue(part);
      } else if (part.startsWith('clpOn')) {
        facets['Clip Shape'] = this.mapValue(part);
      } else if (part.startsWith('clpCt')) {
        facets['Clip Count'] = this.mapValue(part);
      } else if (part.startsWith('clpArr')) {
        facets['Clip Arrangement'] = this.mapValue(part);
      } else if (part.startsWith('clpSz')) {
        facets['Clip Size'] = this.mapValue(part);
      } else if (part.startsWith('clpEdge')) {
        facets['Clip Edge Alignment'] = this.mapValue(part);
      }
    }

    // Check for any unexpected parts that weren't parsed
    if (i < parts.length) {
      const remainingParts = parts.slice(i);
      remainingParts.forEach(part => {
        if (!this.isKnownPrefix(part)) {
          errors.push(`Unknown facet part '${part}' - check naming convention`);
        }
      });
    }

    return {
      facets: facets,
      errors: errors,
      isValid: errors.length === 0
    };
  }

  mapValue(value) {
    return this.facetMappings[value] || value;
  }

  // Validation helper methods
  isValidShape(value) {
    return ['line', 'circle', 'rect', 'roundrect', 'arc', 'scene', 'mixshape'].includes(value);
  }

  isValidCount(value) {
    return ['sgl', 'multi'].includes(value) || (value.startsWith('m') && /^\d+$/.test(value.substring(1)));
  }

  isValidSize(value) {
    return ['xs', 's', 'm', 'l', 'xl', 'szMix', 'szRand'].includes(value);
  }

  isValidFillStyle(value) {
    return ['fNone', 'fOpaq', 'fSemi', 'fMix'].includes(value);
  }

  isValidStrokeStyle(value) {
    return ['sNone', 'sOpaq', 'sSemi', 'sMix'].includes(value);
  }

  isValidStrokeThickness(value) {
    if (value === 'swMix') return true;
    if (value === 'sw0') return true;
    if (value.match(/^sw\d+px$/)) return true; // sw1px, sw10px, etc.
    if (value.match(/^sw\d+-\d+px$/)) return true; // sw1-10px, etc.
    return false;
  }

  isKnownPrefix(value) {
    const knownPrefixes = [
      'lyt', 'cen', 'edge', 'orn', 'arcA', 'quad', 'rrr',
      'ctxTrans', 'ctxRot', 'ctxScale', 'nonInt',
      'clpOn', 'clpCt', 'clpArr', 'clpSz', 'clpEdge'
    ];
    return knownPrefixes.some(prefix => value.startsWith(prefix)) ||
           this.isValidShape(value) || this.isValidCount(value) || this.isValidSize(value) ||
           this.isValidFillStyle(value) || this.isValidStrokeStyle(value) || this.isValidStrokeThickness(value);
  }

  formatFacets(parseResult) {
    // Handle both old API (direct facets object) and new API (result object)
    const facets = parseResult.facets || parseResult;
    const themes = {
      'Basic': ['Shape', 'Count', 'Size', 'Orientation'],
      'Fill & Stroke': ['Fill Style', 'Stroke Style', 'Stroke Thickness'],
      'Layout & Position': ['Layout', 'Centered At', 'Edge Alignment'],
      'Shape-Specific': ['Arc Angle', 'Quadrant', 'Round Rect Radius'],
      'Context Transforms': ['Context Translation', 'Context Rotation', 'Context Scaling'],
      'Modifiers': ['Special Modifiers'],
      'Clipping': ['Clip Shape', 'Clip Count', 'Clip Arrangement', 'Clip Size', 'Clip Edge Alignment']
    };

    let html = '<div class="test-facets" style="margin-top: 10px; font-size: 14px; color: #666; border-top: 1px solid #eee; padding-top: 8px;">';
    html += '<div style="display: flex; flex-wrap: wrap; gap: 15px;">';

    for (const [themeName, facetNames] of Object.entries(themes)) {
      // Always show all themes (match Minimal Renderer behavior)
      html += '<div style="flex: 1; min-width: 140px; margin-bottom: 10px;">';
      html += `<div style="font-weight: bold; color: #444; margin-bottom: 4px; font-size: 16px;">${themeName}</div>`;

      for (const facetName of facetNames) {
        const value = facets[facetName];
        if (value !== undefined) {
          const displayValue = Array.isArray(value) ? value.join(', ') : value;
          html += `<div style="margin: 1px 0;"><strong>${facetName}:</strong> ${displayValue}</div>`;
        }
      }

      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }
}
