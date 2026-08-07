/**
 * ESLint Configuration for SWCanvas
 *
 * This configuration handles the unique build architecture of SWCanvas:
 * - 43 source files are concatenated into a single bundle during build
 * - All classes become globals after concatenation (hence the extensive globals list)
 * - Preprocessor markers (/*@inline:...* /) are valid JS comments and preserved by ESLint
 *
 * Style rules match existing code conventions:
 * - 4-space indentation
 * - Single quotes for strings
 * - Semicolons always required
 * - No trailing commas (ES5 style)
 *
 * Usage:
 * - npm run lint        - Check for issues
 * - npm run lint:fix    - Auto-fix fixable issues
 * - npm run format      - Format with Prettier
 * - npm run format:check - Check formatting
 *
 * Note: Using ESLint 8.x (not 9.x) for stable .eslintrc.js config format.
 */
module.exports = {
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script' // Concatenated script, not ES modules
    },

    env: {
        browser: true,
        node: true,
        es2022: true
    },

    // All classes become globals after build concatenation
    globals: {
        // Debug utilities (Debug.js)
        IS_DEBUG: 'readonly',
        assertDebug: 'readonly',
        debugLog: 'readonly',
        debugWarn: 'readonly',

        // Constants (SWCanvasConstants.js)
        SWCanvasConstants: 'readonly',
        FLOAT_EPSILON: 'readonly',
        TRANSFORM_EPSILON: 'readonly',
        TAU: 'readonly',
        HALF_PI: 'readonly',
        THREE_HALF_PI: 'readonly',
        QUARTER_PI: 'readonly',
        DEG_TO_RAD: 'readonly',
        FILL_EPSILON: 'readonly',
        STROKE_1PX_TOLERANCE: 'readonly',
        QUADRANT_TRIG_EPSILON: 'readonly',
        ANGLE_TOLERANCE: 'readonly',
        ARC_FULLCIRCLE_TOLERANCE: 'readonly',
        MIN_EDGE_LENGTH: 'readonly',
        MIN_EDGE_LENGTH_SQUARED: 'readonly',
        PATH_FLATTENING_TOLERANCE: 'readonly',
        THIN_LINE_THRESHOLD: 'readonly',
        DEFAULT_MITER_LIMIT: 'readonly',

        // Core classes (src/core/)
        Context2D: 'readonly',
        Surface: 'readonly',
        Transform2D: 'readonly',
        SWPath2D: 'readonly',
        Color: 'readonly',
        ClipMask: 'readonly',
        SourceMask: 'readonly',
        StateStack: 'readonly',
        Rasterizer: 'readonly',

        // Utilities (src/utils/)
        Point: 'readonly',
        Rectangle: 'readonly',
        BitBuffer: 'readonly',
        BoundsTracker: 'readonly',
        CompositeOperations: 'readonly',
        ImageProcessor: 'readonly',
        Validators: 'readonly',

        // Renderers (src/renderers/)
        SpanOps: 'readonly',
        QuadScanOps: 'readonly',
        RectOpsAA: 'readonly',
        RectOpsRot: 'readonly',
        CircleOps: 'readonly',
        StadiumOps: 'readonly',
        ArcOps: 'readonly',
        LineOps: 'readonly',
        RoundedRectOpsAA: 'readonly',
        RoundedRectOpsRot: 'readonly',
        RoundedRectUtils: 'readonly',
        DepthBuffer: 'readonly',
        Texture3D: 'readonly',
        Triangle3DOps: 'readonly',
        PolygonFiller: 'readonly',
        PathFlattener: 'readonly',
        StrokeGenerator: 'readonly',

        // Paint (src/paint/)
        Gradient: 'readonly',
        LinearGradient: 'readonly',
        RadialGradient: 'readonly',
        ConicGradient: 'readonly',
        Pattern: 'readonly',
        ColorParser: 'readonly',

        // Filters (src/filters/)
        ShadowBuffer: 'readonly',
        BoxBlur: 'readonly',
        ShadowPipeline: 'readonly',

        // I/O (src/io/)
        BitmapEncoder: 'readonly',
        BitmapEncodingOptions: 'readonly',
        PngEncoder: 'readonly',
        PngEncodingOptions: 'readonly',

        // Compat (src/compat/)
        CanvasCompatibleContext2D: 'readonly',
        SWCanvasElement: 'readonly'
    },

    rules: {
        // === POSSIBLE ERRORS (catch real bugs) ===
        'no-cond-assign': ['error', 'except-parens'],
        'no-constant-condition': 'error',
        'no-dupe-keys': 'error',
        'no-dupe-args': 'error',
        'no-duplicate-case': 'error',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'no-ex-assign': 'error',
        'no-extra-boolean-cast': 'error',
        'no-func-assign': 'error',
        'no-inner-declarations': 'error',
        'no-invalid-regexp': 'error',
        'no-irregular-whitespace': 'error',
        'no-obj-calls': 'error',
        'no-sparse-arrays': 'error',
        'no-unexpected-multiline': 'error',
        'no-unreachable': 'error',
        'no-unsafe-finally': 'error',
        'use-isnan': 'error',
        'valid-typeof': 'error',

        // === BEST PRACTICES ===
        'eqeqeq': ['error', 'always', { null: 'ignore' }],
        'no-caller': 'error',
        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'error',
        'no-fallthrough': 'error',
        'no-floating-decimal': 'error',
        'no-implied-eval': 'error',
        'no-labels': 'error',
        'no-lone-blocks': 'error',
        'no-loop-func': 'warn',
        'no-multi-spaces': ['error', { ignoreEOLComments: true }],
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-octal': 'error',
        'no-redeclare': 'error',
        'no-return-await': 'error',
        'no-script-url': 'error',
        'no-self-assign': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
        'no-useless-call': 'error',
        'no-useless-concat': 'error',
        'no-useless-escape': 'error',
        'no-useless-return': 'error',
        'no-with': 'error',
        'radix': 'error',

        // === VARIABLES ===
        'no-delete-var': 'error',
        'no-shadow-restricted-names': 'error',
        'no-undef': 'error',
        'no-undef-init': 'error',
        // varsIgnorePattern includes class/function names that are exported globals (used across files after build concatenation)
        'no-unused-vars': ['error', {
            args: 'none',
            ignoreRestSiblings: true,
            varsIgnorePattern: '^(_|Context2D|Surface|Transform2D|SWPath2D|Color|ClipMask|SourceMask|StateStack|Rasterizer|Point|Rectangle|BitBuffer|BoundsTracker|CompositeOperations|ImageProcessor|Validators|SpanOps|QuadScanOps|Triangle3DOps|DepthBuffer|Texture3D|RectOpsAA|RectOpsRot|CircleOps|StadiumOps|ArcOps|LineOps|RoundedRectOpsAA|RoundedRectOpsRot|RoundedRectUtils|PolygonFiller|PathFlattener|StrokeGenerator|Gradient|LinearGradient|RadialGradient|ConicGradient|Pattern|ColorParser|ShadowBuffer|BoxBlur|ShadowPipeline|BitmapEncoder|BitmapEncodingOptions|PngEncoder|PngEncodingOptions|CanvasCompatibleContext2D|SWCanvasElement|SWCanvasConstants|IS_DEBUG|assertDebug|debugLog|debugWarn|FLOAT_EPSILON|TRANSFORM_EPSILON|TAU|HALF_PI|THREE_HALF_PI|QUARTER_PI|DEG_TO_RAD|FILL_EPSILON|STROKE_1PX_TOLERANCE|QUADRANT_TRIG_EPSILON|ANGLE_TOLERANCE|ARC_FULLCIRCLE_TOLERANCE|MIN_EDGE_LENGTH|MIN_EDGE_LENGTH_SQUARED|PATH_FLATTENING_TOLERANCE|THIN_LINE_THRESHOLD|DEFAULT_MITER_LIMIT)$'
        }],

        // === STYLE (match existing) ===
        // Note: Some rules are disabled because Prettier handles them and has different formatting
        'brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'comma-dangle': ['error', 'never'],
        'comma-style': ['error', 'last'],
        'eol-last': ['error', 'always'],
        'func-call-spacing': ['error', 'never'],
        'indent': ['error', 4, {
            SwitchCase: 1,
            // Ignore nodes where Prettier's formatting differs from ESLint's expectations
            ignoredNodes: [
                'ConditionalExpression',
                'ConditionalExpression > *',
                'ArrowFunctionExpression > BlockStatement'
            ]
        }],
        'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
        'semi': ['error', 'always'],
        // Disabled: Prettier adds space for anonymous functions, which conflicts with this rule
        'space-before-function-paren': 'off',
        'space-infix-ops': 'error',
        'keyword-spacing': 'error',
        'space-before-blocks': 'error',
        'no-trailing-spaces': 'error',
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],

        // === ES6 ===
        'prefer-const': ['error', { destructuring: 'all' }],
        'no-var': 'error',
        'no-useless-constructor': 'error',
        'no-dupe-class-members': 'error',
        'no-useless-computed-key': 'error',

        // === DISABLED (intentional patterns in codebase) ===
        'no-console': 'off',      // Used in Debug.js
        'no-debugger': 'off',     // Used in Debug.js
        'no-bitwise': 'off',      // Heavy use for pixel ops
        'no-plusplus': 'off',     // Used throughout
        'no-continue': 'off',     // Used in loops
        'no-nested-ternary': 'off',
        'no-magic-numbers': 'off',
        'no-underscore-dangle': 'off'  // Private member convention
    },

    // Overrides for specific directories with special patterns
    overrides: [
        {
            // Renderer files use preprocessor markers like /*@inline:BLEND_ALPHA(data, pixelIndex, ...)*/
            // Variables declared for use in these markers appear unused to ESLint since it doesn't
            // understand that the comment will be expanded to real code that uses them.
            files: ['src/renderers/**/*.js'],
            rules: {
                'no-unused-vars': ['error', {
                    args: 'none',
                    ignoreRestSiblings: true,
                    // Ignore variables commonly used in preprocessor markers
                    // Includes: data buffers, pixel coordinates, colors, clipping, arc parameters, octant points
                    varsIgnorePattern: '^(_|data|data32|pixelIndex|packedColor|pos|r|g|b|alpha|invAlpha|effectiveAlpha|clipBuffer|startCos|startSin|endCos|endSin|isLargeArc|px|py|screenX|screenY|width|height|dx|dy|bx|by|adjCX|adjCY|pAx|pAy|pBx|pBy|pCx|pCy|pDx|pDy|pEx|pEy|pFx|pFy|pGx|pGy|pHx|pHy|strokeInvAlpha|strokePacked|strokeEffectiveAlpha|SpanOps|QuadScanOps|Triangle3DOps|DepthBuffer|Texture3D|RectOpsAA|RectOpsRot|CircleOps|StadiumOps|ArcOps|LineOps|RoundedRectOpsAA|RoundedRectOpsRot|RoundedRectUtils|PolygonFiller|PathFlattener|StrokeGenerator)$'
                }],
                // PolygonFiller uses intentional while(true) loops for scanline processing
                'no-constant-condition': 'off',
                // Early returns before preprocessor markers appear "useless" to ESLint but are needed
                // to skip pixel blending when clipping fails (the marker expands to real code)
                'no-useless-return': 'off'
            }
        }
    ]
};
