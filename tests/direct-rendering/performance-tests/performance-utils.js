// Performance testing utilities for SWCanvas Direct Rendering

// Constants
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 768;
let FRAME_BUDGET = 16.7; // Default milliseconds (60fps), will be updated after detection
let DETECTED_FPS = 60; // Default, will be updated after detection
const STARTING_SHAPE_COUNT = 10;

// Browser detection for timing diagnostics
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isChrome = /chrome/i.test(navigator.userAgent) && !/edge/i.test(navigator.userAgent);
const browserName = isSafari ? 'Safari' : (isChrome ? 'Chrome' : 'Other');
console.log(`[PERF] Browser detected: ${browserName}`);

// Debug flag for timing diagnostics (set to true to diagnose timing issues)
const DEBUG_TIMING = false;

// Set up test state
let currentTest = null;
let abortRequested = false;
let animationFrameId = null;
let refreshRateDetected = false;

// Blit SWCanvas content to the visible display canvas
function blitSwCanvasToDisplay() {
  const displayCanvas = swCtx._displayCanvas;
  if (!displayCanvas) return;

  const visibleCtx = displayCanvas.getContext('2d');
  const swImageData = swCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Create a native browser ImageData from SWCanvas data
  const nativeImageData = visibleCtx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  nativeImageData.data.set(swImageData.data);
  visibleCtx.putImageData(nativeImageData, 0, 0);
}

// Detect display refresh rate and update frame budget
function detectRefreshRate(callback) {
  let times = [];
  let lastTime = performance.now();
  let frameCount = 0;

  // Standard refresh rates in Hz
  const STANDARD_REFRESH_RATES = [60, 75, 90, 120, 144, 165, 240, 360, 500];

  // Helper function to find closest standard refresh rate
  function findClosestRefreshRate(detectedFPS) {
    let closestRate = STANDARD_REFRESH_RATES[0];
    let minDifference = Math.abs(detectedFPS - closestRate);

    for (let i = 1; i < STANDARD_REFRESH_RATES.length; i++) {
      const currentDifference = Math.abs(detectedFPS - STANDARD_REFRESH_RATES[i]);
      if (currentDifference < minDifference) {
        closestRate = STANDARD_REFRESH_RATES[i];
        minDifference = currentDifference;
      }
    }

    return closestRate;
  }

  function measureFrames(timestamp) {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    if (frameCount > 0) {
      times.push(deltaTime);
    }

    frameCount++;

    if (frameCount <= 20) {
      requestAnimationFrame(measureFrames);
    } else {
      times.sort((a, b) => a - b);
      const startIdx = Math.floor(times.length * 0.2);
      const endIdx = Math.ceil(times.length * 0.8);
      const reliableTimes = times.slice(startIdx, endIdx);

      const avgFrameTime = reliableTimes.reduce((sum, time) => sum + time, 0) / reliableTimes.length;
      const rawDetectedFPS = Math.round(1000 / avgFrameTime);
      const closestStandardFPS = findClosestRefreshRate(rawDetectedFPS);

      window.RAW_DETECTED_FPS = rawDetectedFPS;
      DETECTED_FPS = closestStandardFPS;
      FRAME_BUDGET = 1000 / closestStandardFPS;
      refreshRateDetected = true;

      document.getElementById('detected-fps').textContent = `${DETECTED_FPS} (raw: ${RAW_DETECTED_FPS})`;
      document.getElementById('frame-budget').textContent = FRAME_BUDGET.toFixed(2);

      if (callback) callback();
    }
  }

  requestAnimationFrame(measureFrames);
}

// Helper function to log results based on quiet mode
function logResult(message) {
  if (!quietModeCheckbox.checked) {
    resultsContainer.innerHTML += message;
    resultsContainer.scrollTop = resultsContainer.scrollHeight;
  }
}

// Find the maximum number of shapes that stayed within the frame budget
function findMaxShapes(shapeCounts, timings) {
  if (shapeCounts.length === 0) {
    return 0;
  }
  return shapeCounts[shapeCounts.length - 1];
}

// Warm-up function to ensure JIT optimization before measurement
// This is critical for accurate results - the adaptive algorithm reaches high shape counts
// too quickly for the JIT compiler to optimize, causing inaccurate measurements.
function runWarmup(testType, targetCtx, warmupCount, warmupIterations, includeBlitting, callback) {
  let iteration = 0;

  resultsContainer.innerHTML += `  Warmup (${warmupIterations}x${warmupCount})... `;
  resultsContainer.scrollTop = resultsContainer.scrollHeight;

  function warmupIteration() {
    if (iteration >= warmupIterations) {
      resultsContainer.innerHTML += `done.\n`;
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
      callback();
      return;
    }

    targetCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    SeededRandom.seedWithInteger(iteration);
    testType.drawFunction(targetCtx, 0, warmupCount);

    // For SWCanvas, also warm up the blitting path if needed
    if (includeBlitting && targetCtx._displayCanvas) {
      blitSwCanvasToDisplay();
    }

    iteration++;
    animationFrameId = requestAnimationFrame(warmupIteration);
  }

  warmupIteration();
}

// Adaptive SWCanvas Ramp Test (Geometric Growth + Binary Search)
function runAdaptiveSWCanvasRampTest(testType, startCount, precision, growthFactor, includeBlitting, testData, callback) {
  const isQuietMode = testData.isQuietMode;

  resultsContainer.innerHTML += "PHASE 1: Testing SWCanvas (Adaptive Algorithm)...\n";
  resultsContainer.innerHTML += `  Precision: ${precision} shapes, Growth factor: ${growthFactor}\n`;
  resultsContainer.scrollTop = resultsContainer.scrollHeight;

  // Warm-up phase first to ensure JIT optimization
  runWarmup(testType, swCtx, 500, 100, includeBlitting, () => {
    // Now run the actual adaptive measurement
    let count = startCount;
    let lowerBound = 0;
    let upperBound = Infinity;
    let phase = 'growth';
    let iteration = 0;
    const maxIterations = 500;
    let lastPassTime = FRAME_BUDGET; // Track avgTime from last PASS for convergence logging

    // For SWCanvas (pure JavaScript), use performance.now() timing
    // JavaScript execution is synchronous, no GPU deferral issues
    function measureAtCount(targetCount, measuredCallback) {
      animationFrameId = requestAnimationFrame(() => {
        swCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        SeededRandom.seedWithInteger(iteration);

        const startTime = performance.now();
        testType.drawFunction(swCtx, 0, targetCount);
        if (includeBlitting) blitSwCanvasToDisplay();
        const endTime = performance.now();

        if (!includeBlitting) blitSwCanvasToDisplay(); // Visual feedback

        measuredCallback(endTime - startTime);
      });
    }

    function iterate() {
      if (abortRequested) {
        testData.swMaxShapes = lowerBound;
        resultsContainer.innerHTML += `SWCanvas aborted: ${lowerBound} shapes @ ${lastPassTime.toFixed(1)}ms\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      if (iteration >= maxIterations) {
        testData.swMaxShapes = lowerBound;
        resultsContainer.innerHTML += `SWCanvas max iterations: ${lowerBound} shapes @ ${lastPassTime.toFixed(1)}ms (${iteration} iter)\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      // Check convergence
      if (upperBound !== Infinity && (upperBound - lowerBound) <= precision) {
        testData.swMaxShapes = lowerBound;
        resultsContainer.innerHTML += `SWCanvas converged: ${lowerBound} shapes @ ${lastPassTime.toFixed(1)}ms (${iteration} iter)\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      iteration++;

      // Update progress estimate
      const estimatedTotal = upperBound === Infinity ? 20 : Math.ceil(Math.log2(Math.max(1, upperBound - lowerBound))) + iteration;
      const progress = Math.min(50, Math.round((iteration / Math.max(estimatedTotal, iteration + 5)) * 50));
      currentTestProgressBar.style.width = `${progress}%`;
      currentTestProgressBar.textContent = `${progress}%`;
      if (progress > 0) currentTestProgressBar.style.color = 'white';

      measureAtCount(count, (avgTime) => {
        // Record data point for chart
        testData.swShapeCounts.push(count);
        testData.swTimings.push(avgTime);

        if (avgTime < FRAME_BUDGET) {
          // Under budget - this count is safe
          lowerBound = count;
          lastPassTime = avgTime; // Track for convergence logging

          if (upperBound === Infinity) {
            // Growth phase - multiply by growth factor
            const nextCount = Math.floor(count * growthFactor);
            if (!isQuietMode) {
              resultsContainer.innerHTML += `  [Growth] ${count} shapes: ${avgTime.toFixed(2)}ms (PASS) -> trying ${nextCount}\n`;
              resultsContainer.scrollTop = resultsContainer.scrollHeight;
            }
            count = nextCount;
          } else {
            // Refinement phase
            const newCount = Math.floor((lowerBound + upperBound) / 2);
            if (!isQuietMode) {
              resultsContainer.innerHTML += `  [Refine] ${count} shapes: ${avgTime.toFixed(2)}ms (PASS) -> [${lowerBound}, ${upperBound}]\n`;
              resultsContainer.scrollTop = resultsContainer.scrollHeight;
            }
            count = newCount;
          }
        } else {
          // Over budget
          upperBound = count;
          const newCount = Math.floor((lowerBound + upperBound) / 2);

          if (phase === 'growth') {
            phase = 'refinement';
            resultsContainer.innerHTML += `  [Growth->Refine] ${count} shapes: ${avgTime.toFixed(2)}ms (FAIL) -> refining [${lowerBound}, ${upperBound}]\n`;
            resultsContainer.scrollTop = resultsContainer.scrollHeight;
          } else if (!isQuietMode) {
            resultsContainer.innerHTML += `  [Refine] ${count} shapes: ${avgTime.toFixed(2)}ms (FAIL) -> [${lowerBound}, ${upperBound}]\n`;
            resultsContainer.scrollTop = resultsContainer.scrollHeight;
          }
          count = newCount;
        }

        animationFrameId = requestAnimationFrame(iterate);
      });
    }

    iterate();
  }); // End of warm-up callback
}

// Legacy SWCanvas Ramp Test (kept for reference, can be removed later)
function runSWCanvasRampTest(testType, startCount, incrementSize, includeBlitting, requiredExceedances, testData, callback) {
  let currentShapeCount = startCount;
  let exceededBudget = false;
  let totalPhaseSteps = 1000;
  let currentPhaseStep = 0;
  let consecutiveExceedances = 0;
  let lastLoggedShapeCount = 0;
  const isQuietMode = testData.isQuietMode;

  resultsContainer.innerHTML += "PHASE 1: Testing SWCanvas...\n";
  if (isQuietMode) {
    resultsContainer.innerHTML += "(Running in quieter mode, suppressing frame-by-frame logs)\n";
  }
  resultsContainer.scrollTop = resultsContainer.scrollHeight;

  function testNextShapeCount() {
    if (abortRequested || exceededBudget) {
      testData.swMaxShapes = findMaxShapes(testData.swShapeCounts, testData.swTimings);
      resultsContainer.innerHTML += `SWCanvas Maximum Shapes: ${testData.swMaxShapes}\n`;
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
      callback();
      return;
    }

    currentPhaseStep++;
    const progress = Math.min(100, Math.round((currentPhaseStep / totalPhaseSteps) * 50));
    currentTestProgressBar.style.width = `${progress}%`;
    currentTestProgressBar.textContent = `${progress}%`;

    if (progress > 0) {
      currentTestProgressBar.style.color = 'white';
    }

    // Clear and redraw on SWCanvas
    swCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Seed random for consistent shapes
    SeededRandom.seedWithInteger(currentPhaseStep);

    let startTime = performance.now();

    // Draw shapes using the test function
    testType.drawFunction(swCtx, 0, currentShapeCount);

    // Include blitting time if requested
    if (includeBlitting) {
      blitSwCanvasToDisplay();
    }

    let endTime = performance.now();
    let elapsedTime = endTime - startTime;

    // Always blit for visual feedback (if not already done above)
    if (!includeBlitting) {
      blitSwCanvasToDisplay();
    }

    testData.swShapeCounts.push(currentShapeCount);
    testData.swTimings.push(elapsedTime);

    if (!isQuietMode || (isQuietMode && (currentShapeCount - lastLoggedShapeCount >= 100) && consecutiveExceedances === 0)) {
      resultsContainer.innerHTML += `SWCanvas with ${currentShapeCount} shapes: ${elapsedTime.toFixed(2)}ms\n`;
      lastLoggedShapeCount = currentShapeCount;
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

    if (elapsedTime > FRAME_BUDGET) {
      consecutiveExceedances++;

      if (!isQuietMode || consecutiveExceedances === 1 || consecutiveExceedances === requiredExceedances) {
        if (isQuietMode) {
          resultsContainer.innerHTML += `SWCanvas with ${currentShapeCount} shapes: ${elapsedTime.toFixed(2)}ms\n`;
        }
        resultsContainer.innerHTML += `  Exceeded budget (${consecutiveExceedances}/${requiredExceedances})\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
      }

      if (consecutiveExceedances >= requiredExceedances) {
        exceededBudget = true;
      }
    } else {
      consecutiveExceedances = 0;
      currentShapeCount += incrementSize;
    }

    animationFrameId = requestAnimationFrame(testNextShapeCount);
  }

  testNextShapeCount();
}

// Adaptive HTML5 Canvas Ramp Test (Geometric Growth + Binary Search)
function runAdaptiveHTML5CanvasRampTest(testType, startCount, precision, growthFactor, testData, callback) {
  const isQuietMode = testData.isQuietMode;

  resultsContainer.innerHTML += "\nPHASE 2: Testing HTML5 Canvas (Adaptive Algorithm)...\n";
  resultsContainer.innerHTML += `  Precision: ${precision} shapes, Growth factor: ${growthFactor}\n`;
  resultsContainer.scrollTop = resultsContainer.scrollHeight;

  // Warm-up phase first to ensure JIT optimization
  runWarmup(testType, ctx, 500, 100, false, () => {
    // Now run the actual adaptive measurement
    let count = startCount;
    let lowerBound = 0;
    let upperBound = Infinity;
    let phase = 'growth';
    let iteration = 0;
    const maxIterations = 500;
    let lastPassTime = FRAME_BUDGET; // Track avgFrameTime from last PASS for scaling

    // VSync Cliff Detection for HTML5 Canvas
    // Treats measurement as Pass/Fail stress test to work around VSync-locked RAF
    // Instead of measuring render time, we detect when frames start dropping
    function measureAtCount(targetCount, measuredCallback) {
      const WARMUP_FRAMES = 5;   // Let GPU settle per-measurement
      const MEASURE_FRAMES = 15; // Average out OS/GC jitter

      // Dynamic threshold: 50% above VSync interval
      const DROP_THRESHOLD_MS = FRAME_BUDGET * 1.5;

      let frameCount = 0;
      let rafStartTime = 0;      // RAF timestamp-based timing
      let perfStartTime = 0;     // performance.now() timing for diagnostics

      // Frame-by-frame diagnostics for Safari timing investigation
      let rafTimestamps = [];
      let perfTimestamps = [];

      // Seed random once per measurement for reproducibility
      SeededRandom.seedWithInteger(iteration);

      function runFrame(timestamp) {
        // Handle abort
        if (abortRequested) {
          measuredCallback(false, FRAME_BUDGET * 2, null);
          return;
        }

        // Warmup Phase: Render but don't measure
        if (frameCount < WARMUP_FRAMES) {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          testType.drawFunction(ctx, 0, targetCount);
          frameCount++;
          animationFrameId = requestAnimationFrame(runFrame);
          return;
        }

        // Start timing at beginning of measurement phase
        if (frameCount === WARMUP_FRAMES) {
          rafStartTime = timestamp;
          perfStartTime = performance.now();
        }

        // Record frame-by-frame timing for diagnostics
        if (frameCount >= WARMUP_FRAMES) {
          rafTimestamps.push(timestamp);
          perfTimestamps.push(performance.now());
        }

        // Measurement Phase: Render and continue
        if (frameCount < WARMUP_FRAMES + MEASURE_FRAMES) {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          testType.drawFunction(ctx, 0, targetCount);
          frameCount++;
          animationFrameId = requestAnimationFrame(runFrame);
          return;
        }

        // Calculation Phase
        const rafEndTime = timestamp;
        const perfEndTime = performance.now();

        const rafTotalTime = rafEndTime - rafStartTime;
        const perfTotalTime = perfEndTime - perfStartTime;

        const rafAvgFrameTime = rafTotalTime / MEASURE_FRAMES;
        const perfAvgFrameTime = perfTotalTime / MEASURE_FRAMES;

        // Diagnostic data for timing investigation
        const diagnostics = {
          rafAvgFrameTime,
          perfAvgFrameTime,
          rafTotalTime,
          perfTotalTime,
          rafTimestamps,
          perfTimestamps,
          timingDivergence: Math.abs(rafAvgFrameTime - perfAvgFrameTime),
          browser: browserName
        };

        // VSync Cliff Detection:
        // PASS: avgFrameTime < threshold → GPU keeping up
        // FAIL: avgFrameTime >= threshold → frames dropping
        const passed = rafAvgFrameTime < DROP_THRESHOLD_MS;
        measuredCallback(passed, rafAvgFrameTime, diagnostics);
      }

      animationFrameId = requestAnimationFrame(runFrame);
    }

    // Helper to calculate final result with scaling if avgFrameTime > FRAME_BUDGET
    // Returns { shapes, wasScaled, rawShapes, scalingFactor, measuredTime } for convergence logging
    function getFinalMaxShapes() {
      if (lastPassTime > FRAME_BUDGET) {
        // Scale down: if N shapes took T ms, estimate shapes for FRAME_BUDGET
        const scalingFactor = FRAME_BUDGET / lastPassTime;
        const scaled = Math.floor(lowerBound * scalingFactor);
        return {
          shapes: scaled,
          wasScaled: true,
          rawShapes: lowerBound,
          scalingFactor: scalingFactor,
          measuredTime: lastPassTime
        };
      }
      return {
        shapes: lowerBound,
        wasScaled: false,
        rawShapes: lowerBound,
        scalingFactor: 1.0,
        measuredTime: lastPassTime
      };
    }

    // Helper to format convergence message with optional scaling info
    function formatConvergenceMsg(prefix, result, iterCount) {
      if (result.wasScaled) {
        return `${prefix}: ${result.shapes} shapes (scaled x${result.scalingFactor.toFixed(2)} from ${result.rawShapes} @ ${result.measuredTime.toFixed(1)}ms) (${iterCount} iter)\n`;
      } else {
        return `${prefix}: ${result.shapes} shapes @ ${result.measuredTime.toFixed(1)}ms (${iterCount} iter)\n`;
      }
    }

    function iterate() {
      if (abortRequested) {
        const result = getFinalMaxShapes();
        testData.canvasMaxShapes = result.shapes;
        resultsContainer.innerHTML += formatConvergenceMsg('HTML5 aborted', result, iteration);
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      if (iteration >= maxIterations) {
        const result = getFinalMaxShapes();
        testData.canvasMaxShapes = result.shapes;
        resultsContainer.innerHTML += formatConvergenceMsg('HTML5 max iterations', result, iteration);
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      // Check convergence
      if (upperBound !== Infinity && (upperBound - lowerBound) <= precision) {
        const result = getFinalMaxShapes();
        testData.canvasMaxShapes = result.shapes;
        resultsContainer.innerHTML += formatConvergenceMsg('HTML5 converged', result, iteration);
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
        callback();
        return;
      }

      iteration++;

      // Update progress estimate (second half of progress bar, 50-100%)
      const estimatedTotal = upperBound === Infinity ? 20 : Math.ceil(Math.log2(Math.max(1, upperBound - lowerBound))) + iteration;
      const progress = Math.min(100, 50 + Math.round((iteration / Math.max(estimatedTotal, iteration + 5)) * 50));
      currentTestProgressBar.style.width = `${progress}%`;
      currentTestProgressBar.textContent = `${progress}%`;
      if (progress > 0) currentTestProgressBar.style.color = 'white';

      measureAtCount(count, (passed, actualTime, diagnostics) => {
        // Record actual time for chart
        testData.canvasShapeCounts.push(count);
        testData.canvasTimings.push(actualTime);

        // Timing diagnostics (enable with DEBUG_TIMING = true)
        // Logs every 5th iteration to diagnose Safari vs Chrome timing differences
        if (DEBUG_TIMING && diagnostics && iteration % 5 === 0) {
          console.log(`[TIMING] ${diagnostics.browser} | iter:${iteration} | shapes:${count} | RAF:${diagnostics.rafAvgFrameTime.toFixed(2)}ms | perf:${diagnostics.perfAvgFrameTime.toFixed(2)}ms | div:${diagnostics.timingDivergence.toFixed(2)}ms`);
        }

        // Log detailed timing diagnostics when there's significant divergence (>2ms)
        // Enable with DEBUG_TIMING = true
        if (DEBUG_TIMING && diagnostics && diagnostics.timingDivergence > 2) {
          console.warn(`[TIMING DIAGNOSTIC] Shape count: ${count}`);
          console.warn(`  Browser: ${diagnostics.browser}`);
          console.warn(`  RAF avg: ${diagnostics.rafAvgFrameTime.toFixed(2)}ms`);
          console.warn(`  perf.now() avg: ${diagnostics.perfAvgFrameTime.toFixed(2)}ms`);
          console.warn(`  Divergence: ${diagnostics.timingDivergence.toFixed(2)}ms`);

          // Log frame intervals for detailed analysis
          const rafIntervals = [];
          const perfIntervals = [];
          for (let i = 1; i < diagnostics.rafTimestamps.length; i++) {
            rafIntervals.push(diagnostics.rafTimestamps[i] - diagnostics.rafTimestamps[i-1]);
            perfIntervals.push(diagnostics.perfTimestamps[i] - diagnostics.perfTimestamps[i-1]);
          }
          console.warn(`  RAF intervals: [${rafIntervals.map(x => x.toFixed(1)).join(', ')}]`);
          console.warn(`  perf intervals: [${perfIntervals.map(x => x.toFixed(1)).join(', ')}]`);
        }

        const status = passed ? 'PASS' : 'FAIL';

        if (passed) {
          // Under budget - this count is safe
          lowerBound = count;
          lastPassTime = actualTime; // Track for scaling at convergence

          if (upperBound === Infinity) {
            // Growth phase - multiply by growth factor
            const nextCount = Math.floor(count * growthFactor);
            if (!isQuietMode) {
              resultsContainer.innerHTML += `  [Growth] ${count} shapes: ${actualTime.toFixed(2)}ms (${status}) -> trying ${nextCount}\n`;
              resultsContainer.scrollTop = resultsContainer.scrollHeight;
            }
            count = nextCount;
          } else {
            // Refinement phase
            const newCount = Math.floor((lowerBound + upperBound) / 2);
            if (!isQuietMode) {
              resultsContainer.innerHTML += `  [Refine] ${count} shapes: ${actualTime.toFixed(2)}ms (${status}) -> [${lowerBound}, ${upperBound}]\n`;
              resultsContainer.scrollTop = resultsContainer.scrollHeight;
            }
            count = newCount;
          }
        } else {
          // Over budget
          upperBound = count;
          const newCount = Math.floor((lowerBound + upperBound) / 2);

          if (phase === 'growth') {
            phase = 'refinement';
            resultsContainer.innerHTML += `  [Growth->Refine] ${count} shapes: ${actualTime.toFixed(2)}ms (${status}) -> refining [${lowerBound}, ${upperBound}]\n`;
            resultsContainer.scrollTop = resultsContainer.scrollHeight;
          } else if (!isQuietMode) {
            resultsContainer.innerHTML += `  [Refine] ${count} shapes: ${actualTime.toFixed(2)}ms (${status}) -> [${lowerBound}, ${upperBound}]\n`;
            resultsContainer.scrollTop = resultsContainer.scrollHeight;
          }
          count = newCount;
        }

        animationFrameId = requestAnimationFrame(iterate);
      });
    }

    iterate();
  }); // End of warm-up callback
}

// Legacy HTML5 Canvas Ramp Test (kept for reference, can be removed later)
function runHTML5CanvasRampTest(testType, startCount, incrementSize, requiredExceedances, testData, callback) {
  let currentShapeCount = startCount;
  let exceededBudget = false;
  let totalPhaseSteps = 1000;
  let currentPhaseStep = 0;
  let consecutiveExceedances = 0;
  let lastLoggedShapeCount = 0;
  const isQuietMode = testData.isQuietMode;

  resultsContainer.innerHTML += "\nPHASE 2: Testing HTML5 Canvas...\n";
  if (isQuietMode) {
    resultsContainer.innerHTML += "(Running in quieter mode, suppressing frame-by-frame logs)\n";
  }
  resultsContainer.scrollTop = resultsContainer.scrollHeight;

  function testNextShapeCount() {
    if (abortRequested || exceededBudget) {
      testData.canvasMaxShapes = findMaxShapes(testData.canvasShapeCounts, testData.canvasTimings);
      resultsContainer.innerHTML += `HTML5 Canvas Maximum Shapes: ${testData.canvasMaxShapes}\n`;
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
      callback();
      return;
    }

    currentPhaseStep++;
    const progress = Math.min(100, 50 + Math.round((currentPhaseStep / totalPhaseSteps) * 50));
    currentTestProgressBar.style.width = `${progress}%`;
    currentTestProgressBar.textContent = `${progress}%`;

    if (progress > 0) {
      currentTestProgressBar.style.color = 'white';
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    SeededRandom.seedWithInteger(currentPhaseStep);

    let startTime = performance.now();

    testType.drawFunction(ctx, 0, currentShapeCount);

    let endTime = performance.now();
    let elapsedTime = endTime - startTime;

    testData.canvasShapeCounts.push(currentShapeCount);
    testData.canvasTimings.push(elapsedTime);

    if (!isQuietMode || (isQuietMode && (currentShapeCount - lastLoggedShapeCount >= 1000) && consecutiveExceedances === 0)) {
      resultsContainer.innerHTML += `HTML5 Canvas with ${currentShapeCount} shapes: ${elapsedTime.toFixed(2)}ms\n`;
      lastLoggedShapeCount = currentShapeCount;
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

    if (elapsedTime > FRAME_BUDGET) {
      consecutiveExceedances++;

      if (!isQuietMode || consecutiveExceedances === 1 || consecutiveExceedances === requiredExceedances) {
        if (isQuietMode) {
          resultsContainer.innerHTML += `HTML5 Canvas with ${currentShapeCount} shapes: ${elapsedTime.toFixed(2)}ms\n`;
        }
        resultsContainer.innerHTML += `  Exceeded budget (${consecutiveExceedances}/${requiredExceedances})\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
      }

      if (consecutiveExceedances >= requiredExceedances) {
        exceededBudget = true;
      }
    } else {
      consecutiveExceedances = 0;
      currentShapeCount += incrementSize;
    }

    animationFrameId = requestAnimationFrame(testNextShapeCount);
  }

  testNextShapeCount();
}

// Results display functions
function displayRampTestResults(testData) {
  let results = "";
  results += `\n=== ${testData.testPerfName.toUpperCase()} TEST RESULTS ===\n`;
  if (testData.numRuns && testData.numRuns > 1) {
    results += `(Averaged over ${testData.numRuns} runs)\n`;
  }
  results += `Test Parameters:\n`;
  results += `- Display refresh rate: ${DETECTED_FPS} fps (standard rate, raw detected: ${window.RAW_DETECTED_FPS || DETECTED_FPS} fps)\n`;
  results += `- Frame budget: ${FRAME_BUDGET.toFixed(2)}ms\n`;
  results += `- Algorithm: Adaptive (geometric growth + binary search)\n`;
  results += `- SW Canvas start count: ${testData.swStartCount}\n`;
  results += `- HTML5 Canvas start count: ${testData.htmlStartCount}\n`;
  results += `- Convergence precision: ${testData.precision} shapes\n`;
  results += `- Growth factor: ${testData.growthFactor}\n`;
  results += `- Blitting time: ${testData.includeBlitting ? "Included" : "Excluded"}\n`;
  if (testData.isQuietMode) {
    results += `- Log mode: Quieter (frame-by-frame logs suppressed)\n`;
  } else {
    results += `- Log mode: Verbose (all frames logged)\n`;
  }
  results += `\n`;

  results += `SWCanvas Performance:\n`;
  results += `- Maximum shapes per frame: ${Math.round(testData.swMaxShapes)}\n\n`;

  results += `HTML5 Canvas Performance:\n`;
  results += `- Maximum shapes per frame: ${Math.round(testData.canvasMaxShapes)}\n\n`;

  results += `Performance Ratio (HTML5 / SWCanvas): ${testData.ratio.toFixed(2)}x`;

  if (testData.numRuns && testData.numRuns > 1 && testData.individualRatios && testData.individualRatios.length > 0) {
    const individualRatiosFormatted = testData.individualRatios.map(r => isNaN(r) ? 'NaN' : r.toFixed(2)).join(', ');
    results += ` (average of: ${individualRatiosFormatted})`;
  }
  results += `\n`;

  results += `HTML5 canvas can render ${testData.ratio.toFixed(2)}x ${testData.ratio > 1 ? "more" : "fewer"} shapes than SWCanvas within frame budget.\n\n`;

  resultsContainer.innerHTML += results;
  resultsContainer.scrollTop = resultsContainer.scrollHeight;
}

function displayOverallResults(allResults) {
  const avgSwMaxShapes = calculateAverage(allResults.swMaxShapes);
  const avgCanvasMaxShapes = calculateAverage(allResults.canvasMaxShapes);
  const avgRatio = calculateAverage(allResults.ratios);

  let results = "\n=== OVERALL TEST RESULTS ===\n";
  results += `Display refresh rate: ${DETECTED_FPS} fps (standard rate, raw detected: ${window.RAW_DETECTED_FPS || DETECTED_FPS} fps)\n`;
  results += `Frame budget: ${FRAME_BUDGET.toFixed(2)}ms\n`;
  results += `Tests run: ${allResults.tests.length}\n`;
  results += `Log mode: ${quietModeCheckbox.checked ? "Quiet" : "Verbose"}\n\n`;

  results += "Test Summary:\n";
  for (let i = 0; i < allResults.tests.length; i++) {
    results += `- ${allResults.tests[i]}: SW=${Math.round(allResults.swMaxShapes[i])} | HTML5=${Math.round(allResults.canvasMaxShapes[i])} | ${allResults.ratios[i].toFixed(2)}x\n`;
  }
  results += "\n";

  results += "Average Performance Across All Tests:\n";
  results += `- SWCanvas: ${Math.round(avgSwMaxShapes)} shapes/frame\n`;
  results += `- HTML5 Canvas: ${Math.round(avgCanvasMaxShapes)} shapes/frame\n`;
  results += `- Average Ratio: ${avgRatio.toFixed(2)}x\n`;
  results += `HTML5 canvas can render on average ${avgRatio.toFixed(2)}x ${avgRatio > 1 ? "more" : "fewer"} shapes than SWCanvas within frame budget.\n\n`;

  resultsContainer.innerHTML += results;
  resultsContainer.scrollTop = resultsContainer.scrollHeight;
}

// Simple chart generation function
function generatePerformanceChart(testData) {
  chartContainer.innerHTML = '';

  const chartCanvas = document.createElement('canvas');
  chartCanvas.width = chartContainer.clientWidth - 20;
  chartCanvas.height = chartContainer.clientHeight - 20;
  chartContainer.appendChild(chartCanvas);

  const chartCtx = chartCanvas.getContext('2d');

  const chartPadding = { top: 40, right: 40, bottom: 40, left: 60 };
  const chartWidth = chartCanvas.width - chartPadding.left - chartPadding.right;
  const chartHeight = chartCanvas.height - chartPadding.top - chartPadding.bottom;

  const maxShapeCount = Math.max(
    ...testData.swShapeCounts,
    ...testData.canvasShapeCounts
  );

  const maxTime = Math.max(
    ...testData.swTimings,
    ...testData.canvasTimings,
    FRAME_BUDGET * 1.5
  );

  // Draw chart background
  chartCtx.fillStyle = '#f8f8f8';
  chartCtx.fillRect(0, 0, chartCanvas.width, chartCanvas.height);

  // Draw frame budget line
  const budgetY = chartPadding.top + chartHeight - (FRAME_BUDGET / maxTime) * chartHeight;

  chartCtx.beginPath();
  chartCtx.moveTo(chartPadding.left, budgetY);
  chartCtx.lineTo(chartPadding.left + chartWidth, budgetY);
  chartCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  chartCtx.lineWidth = 2;
  chartCtx.setLineDash([5, 5]);
  chartCtx.stroke();
  chartCtx.setLineDash([]);

  chartCtx.fillStyle = 'rgba(255, 0, 0, 0.9)';
  chartCtx.font = '12px Arial';
  chartCtx.textAlign = 'right';
  const rawFpsDisplay = window.RAW_DETECTED_FPS ? `, raw: ${window.RAW_DETECTED_FPS}fps` : '';
  chartCtx.fillText(`Frame Budget (${FRAME_BUDGET.toFixed(2)}ms @ ${DETECTED_FPS}fps${rawFpsDisplay})`, chartPadding.left + chartWidth - 10, budgetY - 5);

  // Draw axes
  chartCtx.beginPath();
  chartCtx.moveTo(chartPadding.left, chartPadding.top);
  chartCtx.lineTo(chartPadding.left, chartPadding.top + chartHeight);
  chartCtx.lineTo(chartPadding.left + chartWidth, chartPadding.top + chartHeight);
  chartCtx.strokeStyle = '#333';
  chartCtx.lineWidth = 2;
  chartCtx.stroke();

  // Draw axis labels
  chartCtx.fillStyle = '#333';
  chartCtx.font = '14px Arial';
  chartCtx.textAlign = 'center';
  chartCtx.fillText('Number of Shapes', chartPadding.left + chartWidth / 2, chartPadding.top + chartHeight + 30);

  chartCtx.save();
  chartCtx.translate(15, chartPadding.top + chartHeight / 2);
  chartCtx.rotate(-Math.PI / 2);
  chartCtx.textAlign = 'center';
  chartCtx.fillText('Render Time (ms)', 0, 0);
  chartCtx.restore();

  // Draw title
  chartCtx.font = '16px Arial';
  chartCtx.textAlign = 'center';
  const chartTitle = testData.numRuns && testData.numRuns > 1
    ? `${testData.testPerfName} Test: Render Time vs. Shape Count (Last Run Data)`
    : `${testData.testPerfName} Test: Render Time vs. Shape Count`;
  chartCtx.fillText(chartTitle, chartPadding.left + chartWidth / 2, 20);

  // Draw SWCanvas data points
  drawChartLine(
    chartCtx,
    testData.swShapeCounts,
    testData.swTimings,
    maxShapeCount,
    maxTime,
    chartPadding,
    chartWidth,
    chartHeight,
    'rgba(0, 0, 255, 0.8)',
    'SWCanvas'
  );

  // Draw HTML5 Canvas data points
  drawChartLine(
    chartCtx,
    testData.canvasShapeCounts,
    testData.canvasTimings,
    maxShapeCount,
    maxTime,
    chartPadding,
    chartWidth,
    chartHeight,
    'rgba(0, 128, 0, 0.8)',
    'HTML5 Canvas'
  );

  // Draw legend
  const legendY = chartPadding.top + 20;

  chartCtx.fillStyle = 'rgba(0, 0, 255, 0.8)';
  chartCtx.fillRect(chartPadding.left + 10, legendY, 20, 10);
  chartCtx.fillStyle = '#333';
  chartCtx.textAlign = 'left';
  chartCtx.fillText('SWCanvas', chartPadding.left + 40, legendY + 9);

  chartCtx.fillStyle = 'rgba(0, 128, 0, 0.8)';
  chartCtx.fillRect(chartPadding.left + 130, legendY, 20, 10);
  chartCtx.fillStyle = '#333';
  chartCtx.fillText('HTML5 Canvas', chartPadding.left + 160, legendY + 9);
}

function drawChartLine(ctx, xValues, yValues, maxX, maxY, padding, width, height, color, label) {
  if (xValues.length < 2) return;

  ctx.beginPath();

  for (let i = 0; i < xValues.length; i++) {
    const x = padding.left + (xValues[i] / maxX) * width;
    const y = padding.top + height - (yValues[i] / maxY) * height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Utility functions
function calculateAverage(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStandardDeviation(values, avg) {
  if (values.length <= 1) return 0;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

// Canvas visibility management functions
function showSwCanvas() {
  document.getElementById("sw-canvas-container").style.display = "block";
  document.getElementById("html5-canvas-container").style.display = "none";
  document.getElementById("canvas-label").textContent = "SWCanvas";
}

function showHtml5Canvas() {
  document.getElementById("sw-canvas-container").style.display = "none";
  document.getElementById("html5-canvas-container").style.display = "block";
  document.getElementById("canvas-label").textContent = "HTML5 Canvas";
}

function hideAllCanvases() {
  document.getElementById("sw-canvas-container").style.display = "none";
  document.getElementById("html5-canvas-container").style.display = "none";
  document.getElementById("canvas-label").textContent = "Graphics will be shown here when tests start";
}
