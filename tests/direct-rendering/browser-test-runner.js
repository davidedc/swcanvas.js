/**
 * Browser Direct Rendering Test Runner
 *
 * Runs direct rendering tests comparing SWCanvas output with native HTML5 Canvas
 * and verifies that direct rendering is used where expected.
 *
 * Note: SWCanvas-compatible polyfills are loaded from lib/swcanvas-compat-polyfill.js
 * via a script tag in index.html before this file.
 */

/**
 * Direct Rendering Test Runner for browser
 */
class DirectRenderingTestRunner {
    static results = { passed: 0, failed: 0 };
    static testElements = new Map();
    static runningIterations = new Map(); // Track running multi-iteration tests
    static flipStates = new Map(); // Track flip state per test: 'sw' or 'canvas'
    static iterationInputs = new Map(); // test.name -> <input> element for next iteration
    static currentLabels = new Map(); // test.name -> <span> element for current iteration label

    // Magnifier grid dimensions
    static GRID_COLUMNS = 11;
    static GRID_ROWS = 21;

    /**
     * Initialize the test runner
     */
    static initialize() {
        // Build navigation
        this.buildNavigation();

        // Create test sections
        this.createTestSections();

        // Build summary (initially empty)
        this.updateSummary();

        // Add controls
        this.addControls();
    }

    /**
     * Build navigation links
     */
    static buildNavigation() {
        const nav = document.getElementById('navigation');
        if (!nav) return;

        DIRECT_RENDERING_TESTS.forEach(test => {
            const link = document.createElement('a');
            link.href = `#test-${test.name}`;
            link.className = 'nav-link';
            link.textContent = test.name;
            link.dataset.testName = test.name;
            nav.appendChild(link);
        });
    }

    /**
     * Add run all button and iteration controls
     */
    static addControls() {
        const header = document.querySelector('header');
        if (!header) return;

        const controls = document.createElement('div');
        controls.id = 'controls';

        const runAllBtn = document.createElement('button');
        runAllBtn.className = 'primary';
        runAllBtn.textContent = 'Run All Tests';
        runAllBtn.onclick = () => this.runAllTests();
        controls.appendChild(runAllBtn);

        // Add iteration controls for running all tests
        const iterLabel = document.createElement('span');
        iterLabel.className = 'global-iter-label';
        iterLabel.textContent = 'All Tests:';
        controls.appendChild(iterLabel);

        const run1Btn = document.createElement('button');
        run1Btn.className = 'secondary iter-btn';
        run1Btn.textContent = '1 iter';
        run1Btn.onclick = () => this.runAllIterations(1);
        controls.appendChild(run1Btn);

        const run10Btn = document.createElement('button');
        run10Btn.className = 'secondary iter-btn';
        run10Btn.textContent = '10 iter';
        run10Btn.onclick = () => this.runAllIterations(10);
        controls.appendChild(run10Btn);

        const run100Btn = document.createElement('button');
        run100Btn.className = 'secondary iter-btn';
        run100Btn.textContent = '100 iter';
        run100Btn.onclick = () => this.runAllIterations(100);
        controls.appendChild(run100Btn);

        const run1000Btn = document.createElement('button');
        run1000Btn.className = 'secondary iter-btn';
        run1000Btn.textContent = '1000 iter';
        run1000Btn.onclick = () => this.runAllIterations(1000);
        controls.appendChild(run1000Btn);

        const stopAllBtn = document.createElement('button');
        stopAllBtn.id = 'stop-all-btn';
        stopAllBtn.className = 'secondary iter-btn stop-btn';
        stopAllBtn.textContent = 'Stop All';
        stopAllBtn.onclick = () => this.stopAllIterations();
        stopAllBtn.style.display = 'none';
        controls.appendChild(stopAllBtn);

        // Global progress display
        const progressDiv = document.createElement('div');
        progressDiv.id = 'global-progress';
        progressDiv.className = 'global-progress';
        progressDiv.style.display = 'none';
        controls.appendChild(progressDiv);

        // Add transparency pattern checkbox
        const transparencyControl = document.createElement('div');
        transparencyControl.className = 'transparency-control';

        const transparencyCheckbox = document.createElement('input');
        transparencyCheckbox.type = 'checkbox';
        transparencyCheckbox.id = 'showTransparencyPatternBackground';
        transparencyCheckbox.checked = true; // Default: show transparency pattern

        const transparencyLabel = document.createElement('label');
        transparencyLabel.htmlFor = 'showTransparencyPatternBackground';
        transparencyLabel.textContent = 'Show transparency pattern';

        transparencyCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('transparency-pattern');
            } else {
                document.body.classList.remove('transparency-pattern');
            }
        });

        transparencyControl.appendChild(transparencyCheckbox);
        transparencyControl.appendChild(transparencyLabel);
        controls.appendChild(transparencyControl);

        // Apply default transparency pattern on load
        document.body.classList.add('transparency-pattern');

        header.appendChild(controls);
    }

    /**
     * Create test sections for each registered test
     */
    static createTestSections() {
        const container = document.getElementById('test-container');
        if (!container) return;

        DIRECT_RENDERING_TESTS.forEach(test => {
            const section = this.createTestSection(test);
            container.appendChild(section);
            this.testElements.set(test.name, section);
        });
    }

    /**
     * Create a single test section
     */
    static createTestSection(test) {
        const section = document.createElement('div');
        section.className = 'test-section';
        section.id = `test-${test.name}`;

        // Header
        const header = document.createElement('div');
        header.className = 'test-header';

        const titleDiv = document.createElement('div');
        const title = document.createElement('h3');
        title.className = 'test-title';
        title.textContent = test.metadata.title || test.name;
        titleDiv.appendChild(title);

        // Test name (technical identifier)
        const testNameEl = document.createElement('p');
        testNameEl.className = 'test-name';
        testNameEl.textContent = test.name;
        titleDiv.appendChild(testNameEl);

        if (test.metadata.description) {
            const desc = document.createElement('p');
            desc.className = 'test-description';
            desc.textContent = test.metadata.description;
            titleDiv.appendChild(desc);
        }
        header.appendChild(titleDiv);

        const runBtn = document.createElement('button');
        runBtn.className = 'run-test-btn';
        runBtn.textContent = 'Run Test';
        runBtn.onclick = () => this.runTest(test);
        header.appendChild(runBtn);

        section.appendChild(header);

        // Iteration controls
        const iterControls = document.createElement('div');
        iterControls.className = 'iteration-controls';

        // Current iteration label
        const currentLabel = document.createElement('span');
        currentLabel.className = 'current-iteration-label';
        currentLabel.textContent = 'Current Iteration #1 | ';
        iterControls.appendChild(currentLabel);

        // Store reference for later access
        this.currentLabels.set(test.name, currentLabel);

        // Next iteration label and input
        const nextLabel = document.createElement('span');
        nextLabel.className = 'iter-label';
        nextLabel.textContent = 'Next #: ';
        iterControls.appendChild(nextLabel);

        const iterInput = document.createElement('input');
        iterInput.type = 'text';
        iterInput.value = '1';
        iterInput.className = 'iter-input';
        iterControls.appendChild(iterInput);

        // Store reference for later access
        this.iterationInputs.set(test.name, iterInput);

        const run1Btn = document.createElement('button');
        run1Btn.className = 'iter-btn';
        run1Btn.textContent = '1 iteration';
        run1Btn.onclick = () => this.runIterations(test, 1);
        iterControls.appendChild(run1Btn);

        const run10Btn = document.createElement('button');
        run10Btn.className = 'iter-btn';
        run10Btn.textContent = '10 iterations';
        run10Btn.onclick = () => this.runIterations(test, 10);
        iterControls.appendChild(run10Btn);

        const run100Btn = document.createElement('button');
        run100Btn.className = 'iter-btn';
        run100Btn.textContent = '100 iterations';
        run100Btn.onclick = () => this.runIterations(test, 100);
        iterControls.appendChild(run100Btn);

        const run1000Btn = document.createElement('button');
        run1000Btn.className = 'iter-btn';
        run1000Btn.textContent = '1000 iterations';
        run1000Btn.onclick = () => this.runIterations(test, 1000);
        iterControls.appendChild(run1000Btn);

        // Collect defects button (doesn't stop on error)
        const collect1kBtn = document.createElement('button');
        collect1kBtn.className = 'iter-btn collect-btn';
        collect1kBtn.textContent = 'Collect defects / 1k';
        collect1kBtn.onclick = () => this.runIterations(test, 1000, false);
        iterControls.appendChild(collect1kBtn);

        const stopBtn = document.createElement('button');
        stopBtn.className = 'iter-btn stop-btn';
        stopBtn.textContent = 'Stop';
        stopBtn.onclick = () => this.stopIterations(test);
        stopBtn.style.display = 'none';
        iterControls.appendChild(stopBtn);

        // Progress display
        const progressDiv = document.createElement('div');
        progressDiv.className = 'iter-progress';
        progressDiv.style.display = 'none';
        iterControls.appendChild(progressDiv);

        section.appendChild(iterControls);

        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'canvas-container';

        // SWCanvas side
        const swWrapper = document.createElement('div');
        swWrapper.className = 'canvas-wrapper';
        const swLabel = document.createElement('div');
        swLabel.className = 'canvas-label swcanvas-label';
        swLabel.textContent = 'SWCanvas';
        swWrapper.appendChild(swLabel);
        const swCanvas = document.createElement('canvas');
        swCanvas.width = 400;
        swCanvas.height = 300;
        swCanvas.dataset.renderer = 'swcanvas';
        swWrapper.appendChild(swCanvas);
        canvasContainer.appendChild(swWrapper);

        // HTML5 Canvas side
        const html5Wrapper = document.createElement('div');
        html5Wrapper.className = 'canvas-wrapper';
        const html5Label = document.createElement('div');
        html5Label.className = 'canvas-label html5-label';
        html5Label.textContent = 'HTML5 Canvas';
        html5Wrapper.appendChild(html5Label);
        const html5Canvas = document.createElement('canvas');
        html5Canvas.width = 400;
        html5Canvas.height = 300;
        html5Canvas.dataset.renderer = 'html5';
        html5Wrapper.appendChild(html5Canvas);
        canvasContainer.appendChild(html5Wrapper);

        // Comparison/Display canvas wrapper
        const displayWrapper = document.createElement('div');
        displayWrapper.className = 'canvas-wrapper display-wrapper';

        // Label container (for dynamic label switching)
        const displayLabelContainer = document.createElement('div');
        displayLabelContainer.className = 'display-label-container';

        // Alternating view label (shown by default)
        const displayAltLabel = document.createElement('div');
        displayAltLabel.className = 'canvas-label display-label';
        displayAltLabel.textContent = 'Alternating View (SW)';
        displayLabelContainer.appendChild(displayAltLabel);

        // Magnifier labels container (hidden by default)
        const displayMagContainer = document.createElement('div');
        displayMagContainer.className = 'magnifier-label-container';
        displayMagContainer.style.display = 'none';

        const magSwLabel = document.createElement('div');
        magSwLabel.className = 'canvas-label mag-label';
        magSwLabel.textContent = 'SW Magnified';

        const magCanvasLabel = document.createElement('div');
        magCanvasLabel.className = 'canvas-label mag-label';
        magCanvasLabel.textContent = 'Canvas Magnified';

        displayMagContainer.appendChild(magSwLabel);
        displayMagContainer.appendChild(magCanvasLabel);
        displayLabelContainer.appendChild(displayMagContainer);

        displayWrapper.appendChild(displayLabelContainer);

        // Third canvas (same size as others)
        const displayCanvas = document.createElement('canvas');
        displayCanvas.width = 400;
        displayCanvas.height = 300;
        displayCanvas.dataset.renderer = 'display';
        displayWrapper.appendChild(displayCanvas);

        // Flip button
        const flipBtn = document.createElement('button');
        flipBtn.className = 'flip-btn';
        flipBtn.textContent = 'Flip View';
        flipBtn.onclick = () => this.flipView(test.name);
        displayWrapper.appendChild(flipBtn);

        canvasContainer.appendChild(displayWrapper);

        // Add mouse event listeners for pixel inspection
        swCanvas.style.cursor = 'crosshair';
        html5Canvas.style.cursor = 'crosshair';

        swCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, test.name, swCanvas));
        html5Canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e, test.name, html5Canvas));
        swCanvas.addEventListener('mouseout', () => this.handleMouseOut(test.name));
        html5Canvas.addEventListener('mouseout', () => this.handleMouseOut(test.name));

        // Initialize flip state
        if (!this.flipStates.has(test.name)) {
            this.flipStates.set(test.name, 'sw');
        }

        section.appendChild(canvasContainer);

        // Results section (initially hidden)
        const results = document.createElement('div');
        results.className = 'test-results';
        results.style.display = 'none';
        section.appendChild(results);

        // Add back-to-top link
        const backToTop = document.createElement('a');
        backToTop.href = '#navigation';
        backToTop.className = 'back-to-top';
        backToTop.textContent = 'Back to top';
        section.appendChild(backToTop);

        return section;
    }

    /**
     * Run a single test
     */
    static runTest(test, iterationNumber = 1) {
        const section = this.testElements.get(test.name);
        if (!section) return;

        // Update current label for this test
        const currentLabel = this.currentLabels.get(test.name);
        if (currentLabel) {
            currentLabel.textContent = `Current Iteration #${iterationNumber} | `;
        }

        // Update input to next iteration
        const iterInput = this.iterationInputs.get(test.name);
        if (iterInput) {
            iterInput.value = (iterationNumber + 1).toString();
        }

        const swCanvas = section.querySelector('canvas[data-renderer="swcanvas"]');
        const html5Canvas = section.querySelector('canvas[data-renderer="html5"]');
        const resultsDiv = section.querySelector('.test-results');

        // Run on SWCanvas
        const swResult = this.runOnSWCanvas(test, swCanvas, iterationNumber);

        // Get direct rendering status AFTER running SWCanvas
        const pathBasedUsed = SWCanvas.Core.Context2D.wasPathBasedUsed();
        const allowPathBased = test.checks.allowPathBasedRendering === true;

        // Run on HTML5 Canvas
        const html5Result = this.runOnHTML5Canvas(test, html5Canvas, iterationNumber);

        // Update the flip display canvas
        this.updateFlipDisplay(test.name);

        // Run validation checks comparing both canvases
        const checkResults = this.runValidationChecks(test, swCanvas, html5Canvas, swResult, iterationNumber);

        // Display results
        return this.displayResults(section, test, pathBasedUsed, allowPathBased, checkResults, swResult, iterationNumber);
    }

    /**
     * Run multiple iterations of a test
     * @param {Object} test - The test object
     * @param {number} count - Number of iterations to run
     * @param {boolean} stopAtError - If true (default), stop on first failure; if false, collect all errors
     */
    static runIterations(test, count, stopAtError = true) {
        const section = this.testElements.get(test.name);
        if (!section) return;

        // Stop any existing run
        this.stopIterations(test);

        // Reset tracking for fresh iteration run
        section.dataset.everFailed = 'false';
        section.dataset.hasKnownFailure = 'false';

        // Get UI elements
        const iterControls = section.querySelector('.iteration-controls');
        const stopBtn = iterControls.querySelector('.stop-btn');
        const progressDiv = iterControls.querySelector('.iter-progress');
        const iterBtns = iterControls.querySelectorAll('.iter-btn:not(.stop-btn)');

        // Get iteration input and current label
        const iterInput = this.iterationInputs.get(test.name);
        const currentLabel = this.currentLabels.get(test.name);

        // Read starting iteration from input
        let currentIter = parseInt(iterInput.value) || 1;
        const startIter = currentIter;
        const targetIter = currentIter + count;

        // Show progress, disable other buttons
        stopBtn.style.display = 'inline-block';
        progressDiv.style.display = 'inline-block';
        iterBtns.forEach(btn => btn.disabled = true);

        let passed = 0;
        let failed = 0;
        const errors = [];

        // Reset section run state for fresh summary tracking
        section.dataset.hasRun = 'false';

        const runState = {
            running: true,
            errors: [],
            passed: 0,
            failed: 0
        };
        this.runningIterations.set(test.name, runState);

        const runFrame = () => {
            if (!runState.running || currentIter >= targetIter) {
                // Done - show final results
                this.finishIterations(test, section, passed, failed, errors, currentIter - startIter);
                return;
            }

            // Update progress
            const itersDone = currentIter - startIter;
            progressDiv.textContent = `${itersDone + 1}/${count}`;

            // Update current label BEFORE running
            currentLabel.textContent = `Current Iteration #${currentIter} | `;

            // Run iteration with the current iteration number
            const iterPassed = this.runTest(test, currentIter);

            if (iterPassed) {
                passed++;
            } else {
                failed++;
                errors.push(`Iteration ${currentIter}`);

                // STOP if stopAtError is true and test failed
                if (stopAtError) {
                    // Update input to show the failing iteration for easy re-run
                    iterInput.value = currentIter.toString();
                    this.finishIterations(test, section, passed, failed, errors, currentIter - startIter + 1);
                    return;
                }
            }

            currentIter++;
            iterInput.value = currentIter.toString();  // Update input to next iteration

            // Schedule next frame
            requestAnimationFrame(runFrame);
        };

        // Start running
        requestAnimationFrame(runFrame);
    }

    /**
     * Stop running iterations
     */
    static stopIterations(test) {
        const runState = this.runningIterations.get(test.name);
        if (runState) {
            runState.running = false;
            this.runningIterations.delete(test.name);
        }
    }

    /**
     * Finish iteration run and show summary
     */
    static finishIterations(test, section, passed, failed, errors, total) {
        // Clean up run state
        this.runningIterations.delete(test.name);

        // Reset UI
        const iterControls = section.querySelector('.iteration-controls');
        const stopBtn = iterControls.querySelector('.stop-btn');
        const progressDiv = iterControls.querySelector('.iter-progress');
        const iterBtns = iterControls.querySelectorAll('.iter-btn:not(.stop-btn)');

        stopBtn.style.display = 'none';
        iterBtns.forEach(btn => btn.disabled = false);

        // Show iteration summary in progress div
        const allPassed = failed === 0;
        progressDiv.className = 'iter-progress ' + (allPassed ? 'iter-pass' : 'iter-fail');
        progressDiv.textContent = `${passed}/${total} passed`;

        // Add error details if any failures
        if (errors.length > 0) {
            const resultsDiv = section.querySelector('.test-results');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'iter-errors';

            // Extract just the iteration numbers for easy copy-paste into skipOnIterations
            const iterNumbers = errors.map(e => parseInt(e.replace('Iteration ', '')));
            errorDiv.innerHTML = `<strong>Failed iterations:</strong> ${iterNumbers.join(', ')}`;

            resultsDiv.appendChild(errorDiv);
        }
    }

    /**
     * Run test on SWCanvas
     */
    static runOnSWCanvas(test, canvas, iterationNumber = 1) {
        // Create SWCanvas from the canvas element
        const swCanvas = SWCanvas.createCanvas(canvas.width, canvas.height);
        const ctx = swCanvas.getContext('2d');
        ctx.canvas = swCanvas;

        // Reset path-based rendering flag before drawing
        SWCanvas.Core.Context2D.resetPathBasedFlag();

        // Seed random for reproducibility - different seed per iteration
        SeededRandom.seedWithInteger(12345 + iterationNumber - 1);

        // Run the test draw function
        const result = test.drawFunction(ctx, iterationNumber, null);

        // Copy SWCanvas result to visible canvas
        const visibleCtx = canvas.getContext('2d');
        const swImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Create a native browser ImageData from SWCanvas data
        const nativeImageData = visibleCtx.createImageData(canvas.width, canvas.height);
        nativeImageData.data.set(swImageData.data);
        visibleCtx.putImageData(nativeImageData, 0, 0);

        return result || {};
    }

    /**
     * Run test on native HTML5 Canvas
     */
    static runOnHTML5Canvas(test, canvas, iterationNumber = 1) {
        const ctx = canvas.getContext('2d');
        // Note: ctx.canvas is already set and readonly on native Canvas

        // Seed random with same seed for reproducibility - different seed per iteration
        SeededRandom.seedWithInteger(12345 + iterationNumber - 1);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Run the test draw function
        const result = test.drawFunction(ctx, iterationNumber, null);

        return result || {};
    }

    /**
     * Run validation checks comparing SWCanvas and HTML5 Canvas outputs
     */
    static runValidationChecks(test, swCanvas, html5Canvas, drawResult, iterationNumber = 1) {
        const results = [];
        const checks = test.checks || {};

        // Helper to create surface object from canvas
        const createSurface = (canvas) => {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return {
                width: canvas.width,
                height: canvas.height,
                stride: canvas.width * 4,
                data: imageData.data
            };
        };

        // Extremes check - analyze BOTH canvases
        if (checks.extremes) {
            // Check if this iteration should be skipped
            const skipIterations = (typeof checks.extremes === 'object' && checks.extremes.skipOnIterations) || [];
            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: 'Extremes',
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known HTML5 Canvas issue)`
                });
            } else {
                // Get color tolerance for HTML5 Canvas (to handle faint overspill)
                const colorTolerance = typeof checks.extremes === 'object' && checks.extremes.colorTolerance
                    ? checks.extremes.colorTolerance
                    : 0;

                // Analyze SWCanvas (no tolerance - should be pixel-perfect)
                const swSurface = createSurface(swCanvas);
                const swExtremes = analyzeExtremes(swSurface);

                // Analyze HTML5 Canvas (with tolerance for overspill artifacts)
                const canvasSurface = createSurface(html5Canvas);
                const canvasExtremes = analyzeExtremes(canvasSurface, { r: 255, g: 255, b: 255, a: 255 }, colorTolerance);

                let passed = true;
                let details = '';

                // Check if either renderer produced no drawing
                const swNoDrawing = swExtremes.topY === swSurface.height || swExtremes.bottomY === -1;
                const canvasNoDrawing = canvasExtremes.topY === canvasSurface.height || canvasExtremes.bottomY === -1;

                if (swNoDrawing && canvasNoDrawing) {
                    passed = false;
                    details = 'No drawing detected in either renderer';
                } else if (swNoDrawing) {
                    passed = false;
                    details = 'No drawing in SW | Canvas: T=' + canvasExtremes.topY + ' B=' + canvasExtremes.bottomY + ' L=' + canvasExtremes.leftX + ' R=' + canvasExtremes.rightX;
                } else if (canvasNoDrawing) {
                    passed = false;
                    details = 'SW: T=' + swExtremes.topY + ' B=' + swExtremes.bottomY + ' L=' + swExtremes.leftX + ' R=' + swExtremes.rightX + ' | No drawing in Canvas';
                } else {
                    // Check if bounds match exactly between renderers
                    const boundsMatch =
                        swExtremes.topY === canvasExtremes.topY &&
                        swExtremes.bottomY === canvasExtremes.bottomY &&
                        swExtremes.leftX === canvasExtremes.leftX &&
                        swExtremes.rightX === canvasExtremes.rightX;

                    passed = boundsMatch;
                    details = `SW: T=${swExtremes.topY} B=${swExtremes.bottomY} L=${swExtremes.leftX} R=${swExtremes.rightX} | ` +
                        `Canvas: T=${canvasExtremes.topY} B=${canvasExtremes.bottomY} L=${canvasExtremes.leftX} R=${canvasExtremes.rightX}` +
                        (boundsMatch ? '' : ' (MISMATCH)');
                }

                results.push({
                    name: 'Extremes',
                    passed,
                    details
                });
            }
        }

        // Run shared validation checks on SW surface (color counts, speckles, etc.)
        const swSurface = createSurface(swCanvas);
        const validationResult = runValidationChecks(swSurface, checks);

        // Convert shared validation results to browser display format
        // Unique colors check
        if (checks.totalUniqueColors !== undefined) {
            // Support both number format and object format with skipOnIterations
            const isObject = typeof checks.totalUniqueColors === 'object';
            const expected = isObject ? checks.totalUniqueColors.expected : checks.totalUniqueColors;
            const skipIterations = (isObject && checks.totalUniqueColors.skipOnIterations) || [];

            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: 'Unique Colors',
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known issue)`
                });
            } else {
                const uniqueColors = countUniqueColors(swSurface);
                const passed = uniqueColors === expected;
                results.push({
                    name: 'Unique Colors',
                    passed,
                    details: `${uniqueColors} (expected exactly ${expected})`
                });
            }
        }

        // Max unique colors check
        if (checks.maxUniqueColors !== undefined) {
            const uniqueColors = countUniqueColors(swSurface);
            const passed = uniqueColors <= checks.maxUniqueColors;
            results.push({
                name: 'Max Unique Colors',
                passed,
                details: `${uniqueColors} colors` + (passed ? '' : ` (exceeds max ${checks.maxUniqueColors})`)
            });
        }

        // Middle row unique colors check (both SW and HTML5 Canvas for comparison)
        if (checks.uniqueColors && checks.uniqueColors.middleRow) {
            const skipIterations = checks.uniqueColors.middleRow.skipOnIterations || [];
            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: 'Middle Row Unique Colors',
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known issue)`
                });
            } else {
                const expected = getAdjustedExpectedColorCount(checks.uniqueColors.middleRow.count, swSurface);
                const canvasSurface = createSurface(html5Canvas);
                const swCount = countUniqueColorsInMiddleRow(swSurface);
                const canvasCount = countUniqueColorsInMiddleRow(canvasSurface);
                const passed = swCount === expected && canvasCount === expected;
                results.push({
                    name: 'Middle Row Unique Colors',
                    passed,
                    details: `SW: ${swCount}, Canvas: ${canvasCount}` + (passed ? '' : ` (expected ${expected})`)
                });
            }
        }

        // Middle column unique colors check (both SW and HTML5 Canvas for comparison)
        if (checks.uniqueColors && checks.uniqueColors.middleColumn) {
            const skipIterations = checks.uniqueColors.middleColumn.skipOnIterations || [];
            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: 'Middle Column Unique Colors',
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known issue)`
                });
            } else {
                const expected = getAdjustedExpectedColorCount(checks.uniqueColors.middleColumn.count, swSurface);
                const canvasSurface = createSurface(html5Canvas);
                const swCount = countUniqueColorsInMiddleColumn(swSurface);
                const canvasCount = countUniqueColorsInMiddleColumn(canvasSurface);
                const passed = swCount === expected && canvasCount === expected;
                results.push({
                    name: 'Middle Column Unique Colors',
                    passed,
                    details: `SW: ${swCount}, Canvas: ${canvasCount}` + (passed ? '' : ` (expected ${expected})`)
                });
            }
        }

        // Speckle count check (SW only)
        if (checks.speckles === true || (checks.speckles && typeof checks.speckles === 'object')) {
            // Check if this iteration should be skipped
            const skipIterations = (typeof checks.speckles === 'object' && checks.speckles.skipOnIterations) || [];
            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: 'Speckle Count',
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known issue)`
                });
            } else {
                const expected = (typeof checks.speckles === 'object' && checks.speckles.expected !== undefined)
                    ? checks.speckles.expected : 0;
                const maxSpeckles = typeof checks.speckles === 'object' ? checks.speckles.maxSpeckles : undefined;
                const isKnownFailure = typeof checks.speckles === 'object' && checks.speckles.knownFailure === true;
                const speckleResult = countSpeckles(swSurface);
                const speckleCount = speckleResult.count;
                const passed = maxSpeckles !== undefined
                    ? speckleCount <= maxSpeckles
                    : speckleCount === expected;
                const firstInfo = speckleResult.firstSpeckle
                    ? ` (first at ${speckleResult.firstSpeckle.x},${speckleResult.firstSpeckle.y})`
                    : '';
                const expectedMsg = maxSpeckles !== undefined ? `≤${maxSpeckles}` : `${expected}`;
                results.push({
                    name: 'Speckle Count',
                    passed,
                    knownFailure: isKnownFailure && !passed,
                    details: `SW: ${speckleCount} (${expectedMsg})` + (passed ? '' : `${firstInfo}`) +
                        (!passed && isKnownFailure ? ' [KNOWN]' : '')
                });
            }
        }

        // Legacy speckles check (on SWCanvas)
        if (checks.noSpeckles === true) {
            const hasSpecklePixels = hasSpeckles(swSurface);
            results.push({
                name: 'No Speckles',
                passed: !hasSpecklePixels,
                details: hasSpecklePixels ? 'Speckles detected' : 'Clean edges'
            });
        }

        // Dimension consistency check (SW only)
        if (checks.dimensionConsistency) {
            const result = checkDimensionConsistency(swSurface);
            const passed = result.widthConsistent && result.heightConsistent;
            results.push({
                name: 'Dimension Consistency',
                passed,
                details: passed ? `${result.expectedWidth}x${result.expectedHeight}px` :
                    result.issues.join('; ')
            });
        }

        // 1px stroke 8-connectivity check (SW only)
        // NOTE: This check only works for 1px strokes.
        if (checks.stroke8Connectivity) {
            const config = checks.stroke8Connectivity;
            const [r, g, b] = config.color;
            const tolerance = config.tolerance || 0;
            const isKnownFailure = config.knownFailure === true;

            const result = check1pxClosedStrokeContinuity(swSurface, r, g, b, tolerance);
            const passed = result.continuous;
            const firstInfo = result.gaps.length > 0
                ? ` (first at ${result.gaps[0].x},${result.gaps[0].y} with ${result.gaps[0].neighbors} neighbor(s))`
                : '';

            results.push({
                name: 'Stroke 8-Connectivity',
                passed,
                knownFailure: isKnownFailure && !passed,
                details: passed
                    ? `${result.totalPixels} pixels, all connected`
                    : `${result.gaps.length} gap(s)${firstInfo}` + (isKnownFailure ? ' [KNOWN]' : '')
            });
        }

        // Shape integrity check (universal: stroke-only, fill-only, or fill+stroke)
        // NOTE: Only works for closed convex shapes (circles, rectangles, rounded rects)
        if (checks.shapeIntegrity) {
            const config = typeof checks.shapeIntegrity === 'object'
                ? checks.shapeIntegrity
                : {};
            const isKnownFailure = config.knownFailure === true;
            const skipIterations = config.skipOnIterations || [];

            // Determine display name based on mode (needed for both skip and normal cases)
            const hasStroke = config.hasStroke !== false;
            const hasFill = config.hasFill === true;
            let checkName;
            if (hasStroke && hasFill) {
                checkName = 'Shape Boundary';
            } else if (hasStroke) {
                checkName = 'Stroke Continuity';
            } else {
                checkName = 'Fill Continuity';
            }

            if (skipIterations.includes(iterationNumber)) {
                results.push({
                    name: checkName,
                    passed: true,
                    details: `Skipped on iteration ${iterationNumber} (known issue)`
                });
            } else {
                const result = checkShapeIntegrity(swSurface, {
                    hasStroke: hasStroke,
                    hasFill: hasFill,
                    verticalScan: config.verticalScan !== false,
                    horizontalScan: config.horizontalScan !== false,
                    strokeColor: config.strokeColor,
                    fillColor: config.fillColor,
                    colorTolerance: config.colorTolerance
                });
                const passed = result.valid;

                let successMsg;
                if (hasStroke && hasFill) {
                    successMsg = 'No gaps, fill contained';
                } else if (hasStroke) {
                    successMsg = 'Continuous (no holes)';
                } else {
                    successMsg = 'Solid (no gaps)';
                }

                results.push({
                    name: checkName,
                    passed,
                    knownFailure: isKnownFailure && !passed,
                    details: passed
                        ? successMsg
                        : result.issues.join('; ') + (isKnownFailure ? ' [KNOWN]' : '')
                });
            }
        }

        return results;
    }

    /**
     * Display test results
     */
    static displayResults(section, test, pathBasedUsed, allowPathBased, checkResults, drawResult, iterationNumber = 1) {
        const resultsDiv = section.querySelector('.test-results');
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'block';

        // Show iteration number if not 1
        if (iterationNumber > 1) {
            const iterRow = document.createElement('div');
            iterRow.className = 'result-row iter-row';
            iterRow.innerHTML = `<span class="result-label">Iteration:</span><span class="result-value">#${iterationNumber}</span>`;
            resultsDiv.appendChild(iterRow);
        }

        // Direct rendering status
        const directRenderRow = document.createElement('div');
        directRenderRow.className = 'result-row';

        const directRenderLabel = document.createElement('span');
        directRenderLabel.className = 'result-label';
        directRenderLabel.textContent = 'Rendering:';
        directRenderRow.appendChild(directRenderLabel);

        const directRenderValue = document.createElement('span');
        directRenderValue.className = 'result-value';

        let directRenderPassed;
        if (!pathBasedUsed) {
            directRenderValue.innerHTML = '<span class="check-icon">&#x2705;</span><span class="direct-render-pass">Direct rendering used (PASS)</span>';
            directRenderPassed = true;
        } else if (allowPathBased) {
            directRenderValue.innerHTML = '<span class="check-icon">&#x26A0;</span><span class="direct-render-expected">Path-based rendering used (Expected - alpha blending)</span>';
            directRenderPassed = true;
        } else {
            directRenderValue.innerHTML = '<span class="check-icon">&#x274C;</span><span class="direct-render-fail">Path-based rendering used (FAIL - direct rendering expected)</span>';
            directRenderPassed = false;
        }
        directRenderRow.appendChild(directRenderValue);
        resultsDiv.appendChild(directRenderRow);

        // Validation checks
        let allChecksPassed = true;
        checkResults.forEach(check => {
            const row = document.createElement('div');
            row.className = 'result-row';

            const label = document.createElement('span');
            label.className = 'result-label';
            label.textContent = check.name + ':';
            row.appendChild(label);

            const value = document.createElement('span');
            let icon, cssClass;
            if (check.knownFailure) {
                // Known failure - show as warning (yellow)
                icon = '&#x26A0;';
                cssClass = 'check-warning';
            } else if (check.passed) {
                icon = '&#x2705;';
                cssClass = 'check-pass';
            } else {
                icon = '&#x274C;';
                cssClass = 'check-fail';
            }
            value.className = 'result-value ' + cssClass;
            value.innerHTML = `<span class="check-icon">${icon}</span>${check.details}`;
            row.appendChild(value);

            resultsDiv.appendChild(row);

            // Known failures don't count as actual failures
            if (!check.passed && !check.knownFailure) {
                allChecksPassed = false;
            }
        });

        // Overall result banner
        const overallPassed = directRenderPassed && allChecksPassed;
        const banner = document.createElement('div');
        banner.className = 'test-result-banner ' + (overallPassed ? 'test-pass' : 'test-fail');
        banner.textContent = overallPassed ? 'PASS' : 'FAIL';
        resultsDiv.appendChild(banner);

        // Logs
        if (drawResult.logs && drawResult.logs.length > 0) {
            const logsDiv = document.createElement('div');
            logsDiv.className = 'test-logs';
            const logsTitle = document.createElement('div');
            logsTitle.className = 'test-logs-title';
            logsTitle.textContent = 'Test Logs:';
            logsDiv.appendChild(logsTitle);

            drawResult.logs.forEach(log => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.textContent = log;
                logsDiv.appendChild(logEntry);
            });
            resultsDiv.appendChild(logsDiv);
        }

        // Track if this test ever failed across iterations
        if (!overallPassed) {
            section.dataset.everFailed = 'true';
        }

        // Update navigation link color
        const navLink = document.querySelector(`.nav-link[data-test-name="${test.name}"]`);
        if (navLink) {
            // Track if ANY iteration had known failures (persist across iterations)
            const hasKnownFailuresThisIteration = checkResults.some(r => r.knownFailure);
            if (hasKnownFailuresThisIteration) {
                section.dataset.hasKnownFailure = 'true';
            }
            const everHadKnownFailure = section.dataset.hasKnownFailure === 'true';

            // Check if test EVER failed across iterations (not just this one)
            const everFailed = section.dataset.everFailed === 'true';

            navLink.classList.remove('passed', 'failed', 'warning');
            if (everFailed) {
                navLink.classList.add('failed');
            } else if (everHadKnownFailure) {
                navLink.classList.add('warning');
            } else {
                navLink.classList.add('passed');
            }
        }

        // Update global results
        if (section.dataset.hasRun !== 'true') {
            section.dataset.hasRun = 'true';
            if (overallPassed) {
                this.results.passed++;
            } else {
                this.results.failed++;
            }
            this.updateSummary();
        }

        return overallPassed;
    }

    /**
     * Update summary display
     */
    static updateSummary() {
        const summary = document.getElementById('summary');
        if (!summary) return;

        const total = DIRECT_RENDERING_TESTS.length;
        const run = this.results.passed + this.results.failed;

        summary.innerHTML = `
            <div class="summary-item">
                <span>Total:</span>
                <span class="summary-count summary-total">${total}</span>
            </div>
            <div class="summary-item">
                <span>Passed:</span>
                <span class="summary-count summary-passed">${this.results.passed}</span>
            </div>
            <div class="summary-item">
                <span>Failed:</span>
                <span class="summary-count summary-failed">${this.results.failed}</span>
            </div>
            ${run < total ? `<div class="summary-item"><span>(${total - run} not yet run)</span></div>` : ''}
        `;
    }

    /**
     * Flip the alternating view for a test
     */
    static flipView(testName) {
        const section = this.testElements.get(testName);
        if (!section) return;

        const currentState = this.flipStates.get(testName) || 'sw';
        const newState = currentState === 'sw' ? 'canvas' : 'sw';
        this.flipStates.set(testName, newState);

        this.updateFlipDisplay(testName);
    }

    /**
     * Update the flip display canvas
     */
    static updateFlipDisplay(testName) {
        const section = this.testElements.get(testName);
        if (!section) return;

        const state = this.flipStates.get(testName) || 'sw';
        const displayCanvas = section.querySelector('canvas[data-renderer="display"]');
        const swCanvas = section.querySelector('canvas[data-renderer="swcanvas"]');
        const html5Canvas = section.querySelector('canvas[data-renderer="html5"]');
        const displayAltLabel = section.querySelector('.display-label');
        const displayMagContainer = section.querySelector('.magnifier-label-container');

        if (!displayCanvas || !swCanvas || !html5Canvas) return;

        const displayCtx = displayCanvas.getContext('2d');
        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

        if (state === 'sw') {
            displayCtx.drawImage(swCanvas, 0, 0);
            if (displayAltLabel) displayAltLabel.textContent = 'Alternating View (SW)';
        } else {
            displayCtx.drawImage(html5Canvas, 0, 0);
            if (displayAltLabel) displayAltLabel.textContent = 'Alternating View (Canvas)';
        }

        // Ensure alternating label is visible, magnifier is hidden
        if (displayAltLabel) displayAltLabel.style.display = 'block';
        if (displayMagContainer) displayMagContainer.style.display = 'none';
    }

    /**
     * Handle mouse move over source canvases for pixel inspection
     */
    static handleMouseMove(event, testName, sourceCanvas) {
        const section = this.testElements.get(testName);
        if (!section) return;

        // Get mouse position in canvas coordinates
        const rect = sourceCanvas.getBoundingClientRect();
        const x = Math.floor(event.clientX - rect.left);
        const y = Math.floor(event.clientY - rect.top);

        // Get canvas references
        const swCanvas = section.querySelector('canvas[data-renderer="swcanvas"]');
        const html5Canvas = section.querySelector('canvas[data-renderer="html5"]');
        const displayCanvas = section.querySelector('canvas[data-renderer="display"]');
        const displayAltLabel = section.querySelector('.display-label');
        const displayMagContainer = section.querySelector('.magnifier-label-container');

        if (!swCanvas || !html5Canvas || !displayCanvas) return;

        // Switch to magnifier view (labels)
        if (displayAltLabel) displayAltLabel.style.display = 'none';
        if (displayMagContainer) displayMagContainer.style.display = 'flex';

        // Clear display canvas
        const displayCtx = displayCanvas.getContext('2d');
        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

        // Get image data from both canvases
        const swCtx = swCanvas.getContext('2d');
        const html5Ctx = html5Canvas.getContext('2d');

        const halfCols = Math.floor(this.GRID_COLUMNS / 2);
        const halfRows = Math.floor(this.GRID_ROWS / 2);

        const swImageData = swCtx.getImageData(
            Math.max(0, x - halfCols),
            Math.max(0, y - halfRows),
            this.GRID_COLUMNS,
            this.GRID_ROWS
        );

        const canvasImageData = html5Ctx.getImageData(
            Math.max(0, x - halfCols),
            Math.max(0, y - halfRows),
            this.GRID_COLUMNS,
            this.GRID_ROWS
        );

        // Calculate pixel size for magnified view
        // Leave room at top for coordinates/labels and bottom for RGBA text
        const topMargin = 25;  // Space for coordinates and labels
        const bottomMargin = 20; // Space for RGBA text
        const pixelSize = Math.min(
            (displayCanvas.width / 2) / this.GRID_COLUMNS,
            (displayCanvas.height - topMargin - bottomMargin) / this.GRID_ROWS
        );

        // Draw magnified grids
        this.drawMagnifiedGrid(displayCtx, swImageData, 0, pixelSize, x, y, swCanvas.width, swCanvas.height);
        this.drawMagnifiedGrid(displayCtx, canvasImageData, displayCanvas.width / 2, pixelSize, x, y, html5Canvas.width, html5Canvas.height);

        // Draw separator line
        this.drawSeparator(displayCtx, displayCanvas.width, displayCanvas.height);

        // Draw coordinates at top center
        displayCtx.font = '14px monospace';
        displayCtx.textAlign = 'center';
        displayCtx.fillStyle = 'black';
        displayCtx.fillText(`(${x}, ${y})`, displayCanvas.width / 2, 15);

        // Draw grid labels
        displayCtx.font = 'bold 12px sans-serif';
        displayCtx.fillStyle = '#2ecc71'; // Green for SW
        displayCtx.fillText('SW', displayCanvas.width / 4, 15);
        displayCtx.fillStyle = '#3498db'; // Blue for HTML5
        displayCtx.fillText('HTML5', displayCanvas.width * 3 / 4, 15);
    }

    /**
     * Draw a magnified pixel grid
     */
    static drawMagnifiedGrid(ctx, imageData, offsetX, pixelSize, mouseX, mouseY, canvasWidth, canvasHeight) {
        const halfCols = Math.floor(this.GRID_COLUMNS / 2);
        const halfRows = Math.floor(this.GRID_ROWS / 2);

        // Calculate source coordinates
        const sourceX = mouseX - halfCols;
        const sourceY = mouseY - halfRows;

        // Calculate read offsets for edge cases
        const readOffsetX = Math.max(0, -sourceX);
        const readOffsetY = Math.max(0, -sourceY);

        const gridTop = 25; // Offset for coordinates text and labels at top

        // Draw each pixel
        for (let py = 0; py < this.GRID_ROWS; py++) {
            for (let px = 0; px < this.GRID_COLUMNS; px++) {
                const actualX = sourceX + px;
                const actualY = sourceY + py;

                const isOutOfBounds = actualX < 0 || actualY < 0 ||
                    actualX >= canvasWidth || actualY >= canvasHeight;

                if (isOutOfBounds) {
                    ctx.fillStyle = 'rgb(128, 128, 128)'; // Grey for out-of-bounds
                } else {
                    const dataX = px - readOffsetX;
                    const dataY = py - readOffsetY;
                    const i = (dataY * this.GRID_COLUMNS + dataX) * 4;
                    const r = imageData.data[i];
                    const g = imageData.data[i + 1];
                    const b = imageData.data[i + 2];
                    const a = imageData.data[i + 3];
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                }

                // Fill magnified pixel
                ctx.fillRect(
                    offsetX + px * pixelSize,
                    py * pixelSize + gridTop,
                    pixelSize,
                    pixelSize
                );

                // Draw grid lines
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    offsetX + px * pixelSize,
                    py * pixelSize + gridTop,
                    pixelSize,
                    pixelSize
                );
            }
        }

        // Draw red crosshair at center
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;

        const centerPxX = offsetX + halfCols * pixelSize + pixelSize / 2;
        const gridBottom = gridTop + this.GRID_ROWS * pixelSize;

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerPxX, gridTop);
        ctx.lineTo(centerPxX, gridBottom);
        ctx.stroke();

        // Horizontal line
        const centerPxY = gridTop + halfRows * pixelSize + pixelSize / 2;
        ctx.beginPath();
        ctx.moveTo(offsetX, centerPxY);
        ctx.lineTo(offsetX + this.GRID_COLUMNS * pixelSize, centerPxY);
        ctx.stroke();

        // Display center pixel RGBA below grid
        const centerIdx = (halfRows * this.GRID_COLUMNS + halfCols) * 4;
        const r = imageData.data[centerIdx];
        const g = imageData.data[centerIdx + 1];
        const b = imageData.data[centerIdx + 2];
        const a = imageData.data[centerIdx + 3];

        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';
        const textX = offsetX + (this.GRID_COLUMNS * pixelSize) / 2;
        const textY = gridBottom + 15;
        ctx.fillText(`rgba(${r},${g},${b},${a})`, textX, textY);
    }

    /**
     * Draw separator line between the two grids
     */
    static drawSeparator(ctx, width, height) {
        const centerX = width / 2;

        // Main separator line
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.stroke();

        // White highlights on sides
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(centerX - 2, 0);
        ctx.lineTo(centerX - 2, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX + 2, 0);
        ctx.lineTo(centerX + 2, height);
        ctx.stroke();
    }

    /**
     * Handle mouse out from source canvases
     */
    static handleMouseOut(testName) {
        // Restore alternating view
        this.updateFlipDisplay(testName);
    }

    /**
     * Run all tests
     */
    static runAllTests() {
        // Reset results
        this.results = { passed: 0, failed: 0 };
        this.testElements.forEach(section => {
            section.dataset.hasRun = 'false';
        });

        // Run each test
        DIRECT_RENDERING_TESTS.forEach(test => {
            this.runTest(test);
        });
    }

    /**
     * Run all tests for multiple iterations
     */
    static runAllIterations(iterCount) {
        // Stop any existing run
        this.stopAllIterations();

        // Get UI elements
        const controls = document.getElementById('controls');
        const stopBtn = document.getElementById('stop-all-btn');
        const progressDiv = document.getElementById('global-progress');
        const iterBtns = controls.querySelectorAll('.iter-btn:not(.stop-btn)');

        // Show progress, disable other buttons
        stopBtn.style.display = 'inline-block';
        progressDiv.style.display = 'inline-block';
        iterBtns.forEach(btn => btn.disabled = true);

        const totalTests = DIRECT_RENDERING_TESTS.length;
        let currentTest = 0;
        let currentIter = 0;
        let totalPassed = 0;
        let totalFailed = 0;

        // Reset all sections
        this.results = { passed: 0, failed: 0 };
        this.testElements.forEach(section => {
            section.dataset.hasRun = 'false';
            section.dataset.everFailed = 'false';  // Track if any iteration failed
            section.dataset.hasKnownFailure = 'false';  // Track if any iteration had known failures
        });

        this.globalRunState = {
            running: true,
            iterCount,
            totalTests,
            currentTest,
            currentIter
        };

        const runFrame = () => {
            if (!this.globalRunState.running) {
                this.finishAllIterations(totalPassed, totalFailed, iterCount);
                return;
            }

            // Update progress
            const totalOps = totalTests * iterCount;
            const currentOp = currentTest * iterCount + currentIter + 1;
            progressDiv.textContent = `Test ${currentTest + 1}/${totalTests}, Iter ${currentIter + 1}/${iterCount} (${currentOp}/${totalOps})`;

            // Run current test iteration
            const test = DIRECT_RENDERING_TESTS[currentTest];
            const passed = this.runTest(test, currentIter + 1);
            if (passed) {
                totalPassed++;
                // Move to next iteration
                currentIter++;
                if (currentIter >= iterCount) {
                    currentIter = 0;
                    currentTest++;
                }
            } else {
                totalFailed++;
                // Test failed - stop at this iteration (so user can see the failing case)
                // Skip remaining iterations for this test and move to next test
                currentIter = 0;
                currentTest++;
            }

            // Check if done
            if (currentTest >= totalTests) {
                this.finishAllIterations(totalPassed, totalFailed, iterCount);
                return;
            }

            this.globalRunState.currentTest = currentTest;
            this.globalRunState.currentIter = currentIter;

            // Schedule next frame
            requestAnimationFrame(runFrame);
        };

        // Start running
        requestAnimationFrame(runFrame);
    }

    /**
     * Stop all iterations
     */
    static stopAllIterations() {
        if (this.globalRunState) {
            this.globalRunState.running = false;
        }
        // Also stop individual test iterations
        DIRECT_RENDERING_TESTS.forEach(test => {
            this.stopIterations(test);
        });
    }

    /**
     * Finish all iterations and show summary
     */
    static finishAllIterations(totalPassed, totalFailed, iterCount) {
        this.globalRunState = null;

        // Reset UI
        const controls = document.getElementById('controls');
        const stopBtn = document.getElementById('stop-all-btn');
        const progressDiv = document.getElementById('global-progress');
        const iterBtns = controls.querySelectorAll('.iter-btn:not(.stop-btn)');

        stopBtn.style.display = 'none';
        iterBtns.forEach(btn => btn.disabled = false);

        // Show final summary
        const total = totalPassed + totalFailed;
        const allPassed = totalFailed === 0;
        progressDiv.className = 'global-progress ' + (allPassed ? 'iter-pass' : 'iter-fail');
        progressDiv.textContent = `${totalPassed}/${total} passed (${DIRECT_RENDERING_TESTS.length} tests × ${iterCount} iterations)`;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.DirectRenderingTestRunner = DirectRenderingTestRunner;
}
