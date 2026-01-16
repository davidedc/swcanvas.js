// Main user interface functionality for performance tests

// Function to dynamically generate test list with checkboxes and run buttons
function generateTestButtons() {
  if (typeof document.querySelector !== 'function') return;

  // Get containers for each test type
  const lineTestsContainer = document.getElementById('line-tests');
  const rectangleTestsContainer = document.getElementById('rectangle-tests');
  const roundedRectangleTestsContainer = document.getElementById('rounded-rectangle-tests');
  const circleTestsContainer = document.getElementById('circle-tests');
  const arcTestsContainer = document.getElementById('arc-tests');

  if (!lineTestsContainer || !rectangleTestsContainer || !circleTestsContainer ||
    !roundedRectangleTestsContainer || !arcTestsContainer) return;

  // Clear existing content
  lineTestsContainer.innerHTML = '';
  rectangleTestsContainer.innerHTML = '';
  roundedRectangleTestsContainer.innerHTML = '';
  circleTestsContainer.innerHTML = '';
  arcTestsContainer.innerHTML = '';

  // Create test list containers if there are tests for them
  const linesList = window.DIRECT_RENDERING_PERF_REGISTRY.some(t => t.category === 'lines') ?
    createTestList('Lines Tests', lineTestsContainer) : null;
  const rectanglesList = window.DIRECT_RENDERING_PERF_REGISTRY.some(t => t.category === 'rects') ?
    createTestList('Rectangle Tests', rectangleTestsContainer) : null;
  const roundedRectanglesList = window.DIRECT_RENDERING_PERF_REGISTRY.some(t => t.category === 'rounded-rects') ?
    createTestList('Rounded Rectangle Tests', roundedRectangleTestsContainer) : null;
  const circlesList = window.DIRECT_RENDERING_PERF_REGISTRY.some(t => t.category === 'circles') ?
    createTestList('Circle Tests', circleTestsContainer) : null;
  const arcsList = window.DIRECT_RENDERING_PERF_REGISTRY.some(t => t.category === 'arcs') ?
    createTestList('Arc Tests', arcTestsContainer) : null;

  // Add test entries to the appropriate list
  window.DIRECT_RENDERING_PERF_REGISTRY.forEach(test => {
    let targetListElement;

    if (test.category === 'lines') {
      targetListElement = linesList;
    } else if (test.category === 'rects') {
      targetListElement = rectanglesList;
    } else if (test.category === 'rounded-rects') {
      targetListElement = roundedRectanglesList;
    } else if (test.category === 'circles') {
      targetListElement = circlesList;
    } else if (test.category === 'arcs') {
      targetListElement = arcsList;
    }

    if (targetListElement) {
      createTestEntry(test, targetListElement);
    } else {
      if (test && test.category &&
        !['lines', 'rects', 'circles', 'rounded-rects', 'arcs'].includes(test.category)) {
        console.warn(`[UI] Test "${test.perfName}" has unhandled category: ${test.category}`);
      }
    }
  });
}

// Create a test list container with a title and check/uncheck all buttons
function createTestList(title, parentContainer) {
  const listContainer = document.createElement('div');
  listContainer.className = 'test-list-container';

  const headerContainer = document.createElement('div');
  headerContainer.className = 'test-list-header';

  const listTitle = document.createElement('h4');
  listTitle.textContent = title;
  listTitle.className = 'test-list-title';

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'checkbox-buttons';

  const checkAllBtn = document.createElement('button');
  checkAllBtn.textContent = 'Check All';
  checkAllBtn.className = 'small-button';

  const listItemsDiv = document.createElement('div');
  listItemsDiv.className = 'test-list';

  checkAllBtn.addEventListener('click', () => {
    listItemsDiv.querySelectorAll('.test-checkbox').forEach(checkbox => {
      checkbox.checked = true;
    });
  });

  const uncheckAllBtn = document.createElement('button');
  uncheckAllBtn.textContent = 'Uncheck All';
  uncheckAllBtn.className = 'small-button';
  uncheckAllBtn.addEventListener('click', () => {
    listItemsDiv.querySelectorAll('.test-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
  });

  buttonContainer.appendChild(checkAllBtn);
  buttonContainer.appendChild(uncheckAllBtn);

  headerContainer.appendChild(listTitle);
  headerContainer.appendChild(buttonContainer);

  listContainer.appendChild(headerContainer);
  listContainer.appendChild(listItemsDiv);

  if (parentContainer) {
    parentContainer.appendChild(listContainer);
  }

  return listItemsDiv;
}

// Create a test entry with checkbox and run button
function createTestEntry(test, actualListElement) {
  const testItem = document.createElement('div');
  testItem.className = 'test-item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'test-checkbox';
  checkbox.dataset.testId = test.id;

  const label = document.createElement('label');
  label.className = 'test-label';
  label.textContent = test.perfName;

  const runButton = document.createElement('button');
  runButton.textContent = 'Run';
  runButton.className = 'test-button run-button';
  runButton.dataset.testId = test.id;

  runButton.addEventListener('click', () => runTest(test));

  testItem.appendChild(checkbox);
  testItem.appendChild(label);
  testItem.appendChild(runButton);

  if (actualListElement) {
    actualListElement.appendChild(testItem);
  } else {
    console.error('[UI] In createTestEntry, actualListElement is null. Cannot append testItem for:', test ? test.id : 'N/A');
  }

  return testItem;
}

// Initialize UI
function initializeUI() {
  hideAllCanvases();
  generateTestButtons();

  document.getElementById('btn-check-all').addEventListener('click', checkAllTests);
  document.getElementById('btn-uncheck-all').addEventListener('click', uncheckAllTests);

  if (typeof btnRunChecked !== 'undefined' && btnRunChecked) {
    btnRunChecked.addEventListener('click', runCheckedTests);
  }
  if (typeof btnRunAll !== 'undefined' && btnRunAll) {
    btnRunAll.addEventListener('click', runAllTests);
  }
  if (typeof btnAbort !== 'undefined' && btnAbort) {
    btnAbort.addEventListener('click', abortTests);
  }

  if (!refreshRateDetected) {
    setButtonsState(false);
    resultsContainer.innerHTML = "Detecting display refresh rate... Please wait.\n";

    detectRefreshRate(() => {
      setButtonsState(true);
      resultsContainer.innerHTML = `Display refresh rate detected: ${DETECTED_FPS} fps (standard rate, raw detected: ${window.RAW_DETECTED_FPS || DETECTED_FPS} fps)\nFrame budget: ${FRAME_BUDGET.toFixed(2)}ms\nReady to run tests.\n`;
    });
  }
}

// Check all tests across all categories
function checkAllTests() {
  document.querySelectorAll('.test-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
}

// Uncheck all tests across all categories
function uncheckAllTests() {
  document.querySelectorAll('.test-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
}

// Profiling mode toggle (simplified for adaptive algorithm)
document.getElementById('btn-profiling-mode').addEventListener('click', function () {
  const button = this;
  const isProfilingMode = button.textContent.includes('Disable');

  if (isProfilingMode) {
    button.textContent = 'Enable Profiling Mode';
    button.style.backgroundColor = '#007bff';
    convergencePrecision.value = '10';
    quietModeCheckbox.checked = true;
  } else {
    button.textContent = 'Disable Profiling Mode';
    button.style.backgroundColor = '#ff4d4d';
    // In profiling mode, use larger precision for longer stable runs
    convergencePrecision.value = '1000';
    quietModeCheckbox.checked = true;

    const originalHtml = resultsContainer.innerHTML;
    resultsContainer.innerHTML = "Profiling mode enabled. Tests will run with larger precision for longer stable rendering, suitable for browser profiling tools.\n\n" + originalHtml;
    resultsContainer.scrollTop = resultsContainer.scrollHeight;
  }
});

// Run all checked tests
function runCheckedTests() {
  const checkedBoxes = document.querySelectorAll('.test-checkbox:checked');

  const testsToRun = [];
  checkedBoxes.forEach(checkbox => {
    const testId = checkbox.dataset.testId;
    const test = findTestById(testId);
    if (test) {
      testsToRun.push(test);
    }
  });

  if (testsToRun.length === 0) {
    resultsContainer.innerHTML = "No tests selected. Please check at least one test to run.\n";
    return;
  }

  runTestSeries(testsToRun, `Running ${testsToRun.length} checked tests...`);
}

// Run all tests regardless of checkbox state
function runAllTests() {
  const testsToRun = window.DIRECT_RENDERING_PERF_REGISTRY.slice();
  runTestSeries(testsToRun, "Running all tests...");
}

// Common function to run a series of tests
function runTestSeries(testsToRun, statusMessage) {
  let currentIndex = 0;

  resultsContainer.innerHTML = statusMessage + "\n\n";

  document.querySelector('#overall-progress-container .progress-label').textContent = `Overall progress (0/${testsToRun.length}):`;

  overallProgressContainer.style.display = 'block';
  overallProgressBar.style.width = '0%';
  overallProgressBar.textContent = '0%';
  overallProgressBar.style.color = '#333';

  const allResults = {
    tests: [],
    swMaxShapes: [],
    canvasMaxShapes: [],
    ratios: []
  };

  function runNextTest() {
    if (currentIndex < testsToRun.length && !abortRequested) {
      const overallProgress = Math.round((currentIndex / testsToRun.length) * 100);
      overallProgressBar.style.width = overallProgress + '%';
      overallProgressBar.textContent = overallProgress + '%';

      if (overallProgress > 0) {
        overallProgressBar.style.color = 'white';
      }

      document.querySelector('#overall-progress-container .progress-label').textContent =
        `Overall progress (${currentIndex + 1}/${testsToRun.length}):`;

      runTest(testsToRun[currentIndex], (testResults) => {
        allResults.tests.push(testsToRun[currentIndex].perfName);
        allResults.swMaxShapes.push(testResults.swMaxShapes);
        allResults.canvasMaxShapes.push(testResults.canvasMaxShapes);
        allResults.ratios.push(testResults.ratio);

        currentIndex++;
        runNextTest();
      }, false);
    } else {
      overallProgressBar.style.width = '100%';
      overallProgressBar.textContent = '100%';

      displayOverallResults(allResults);

      setTimeout(() => {
        overallProgressContainer.style.display = 'none';
      }, 1000);

      resetTestState();
    }
  }

  runNextTest();
}

// Find test by ID
function findTestById(testId) {
  return window.DIRECT_RENDERING_PERF_REGISTRY.find(test => test.id === testId);
}

function abortTests() {
  abortRequested = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  hideAllCanvases();
  resetTestState();
  resultsContainer.innerHTML += "Tests aborted by user.\n";
}

function resetTestState() {
  currentTest = null;
  abortRequested = false;
  setButtonsState(true);

  document.querySelector('#current-test-progress-container .progress-label').textContent = 'Current test progress:';
  document.querySelector('#overall-progress-container .progress-label').textContent = 'Overall progress:';

  currentTestProgressBar.style.width = '0%';
  currentTestProgressBar.textContent = '0%';
  currentTestProgressBar.style.color = '#333';

  overallProgressBar.style.width = '0%';
  overallProgressBar.textContent = '0%';
  overallProgressBar.style.color = '#333';

  currentTestProgressContainer.style.display = 'none';
  overallProgressContainer.style.display = 'none';
}

function setButtonsState(enabled) {
  btnRunChecked.disabled = !enabled;
  btnRunAll.disabled = !enabled;
  btnAbort.disabled = enabled;

  document.querySelectorAll('.run-button').forEach(btn => {
    btn.disabled = !enabled;
  });

  document.querySelectorAll('.test-checkbox').forEach(checkbox => {
    checkbox.disabled = !enabled;
  });
}

// Get references to input fields
const numRunsInput = document.getElementById('num-runs');
const swStartCountInput = document.getElementById('sw-start-count');
const htmlStartCountInput = document.getElementById('html-start-count');
const growthFactorInput = document.getElementById('growth-factor');

function runTest(testType, callback = null, clearResults = true) {
  setButtonsState(false);
  currentTest = testType;
  abortRequested = false;

  const precision = parseInt(convergencePrecision.value) || 1;
  const swStartCount = parseInt(swStartCountInput.value) || 10;
  const htmlStartCount = parseInt(htmlStartCountInput.value) || 10;
  const growthFactor = parseFloat(growthFactorInput.value) || 1.1;
  const includeBlitting = includeBlittingCheckbox.checked;
  const isQuietMode = quietModeCheckbox.checked;
  const numRuns = parseInt(numRunsInput.value) || 3;

  const testPerfName = testType.perfName;

  if (clearResults) {
    let header = `Running ${testPerfName} test (averaging ${numRuns} runs) with adaptive algorithm`;
    header += `${includeBlitting ? ' (including blitting time)' : ' (excluding blitting time)'}`;
    header += `${isQuietMode ? ' in quieter mode' : ''}...\n\n`;
    resultsContainer.innerHTML = header;
  } else {
    let header = `\nRunning ${testPerfName} test (averaging ${numRuns} runs) with adaptive algorithm`;
    header += `${includeBlitting ? ' (including blitting time)' : ' (excluding blitting time)'}`;
    header += `${isQuietMode ? ' in quieter mode' : ''}...\n\n`;
    resultsContainer.innerHTML += header;
  }

  document.querySelector('#current-test-progress-container .progress-label').textContent =
    `Current test progress (${testPerfName}, ${numRuns} runs):`;

  currentTestProgressContainer.style.display = 'block';
  currentTestProgressBar.style.width = '0%';
  currentTestProgressBar.textContent = '0%';
  currentTestProgressBar.style.color = '#333';

  const accumulatedData = {
    swMaxShapesTotal: 0,
    canvasMaxShapesTotal: 0,
    runCount: 0,
    individualRatios: []
  };

  let lastSingleRunData = null;

  function runSingleIteration(iterationCallback) {
    const singleRunData = {
      testType: testType,
      testPerfName: testPerfName,
      precision,
      growthFactor,
      includeBlitting,
      isQuietMode,
      swShapeCounts: [],
      swTimings: [],
      swMaxShapes: 0,
      canvasShapeCounts: [],
      canvasTimings: [],
      canvasMaxShapes: 0
    };

    const runNum = accumulatedData.runCount + 1;
    resultsContainer.innerHTML += `Starting Run ${runNum}/${numRuns}...\n`;
    resultsContainer.scrollTop = resultsContainer.scrollHeight;

    showSwCanvas();
    runAdaptiveSWCanvasRampTest(testType, swStartCount, precision, growthFactor, includeBlitting, singleRunData, () => {
      if (abortRequested) return iterationCallback(null);

      showHtml5Canvas();
      resultsContainer.scrollTop = resultsContainer.scrollHeight;

      runAdaptiveHTML5CanvasRampTest(testType, htmlStartCount, precision, growthFactor, singleRunData, () => {
        if (abortRequested) return iterationCallback(null);

        accumulatedData.swMaxShapesTotal += singleRunData.swMaxShapes;
        accumulatedData.canvasMaxShapesTotal += singleRunData.canvasMaxShapes;
        accumulatedData.runCount++;

        const runRatio = singleRunData.canvasMaxShapes / singleRunData.swMaxShapes;
        accumulatedData.individualRatios.push(runRatio);

        lastSingleRunData = singleRunData;

        const runRatioValue = (singleRunData.canvasMaxShapes / singleRunData.swMaxShapes).toFixed(2);
        resultsContainer.innerHTML += `  Run ${runNum}: SW=${singleRunData.swMaxShapes} | HTML5=${singleRunData.canvasMaxShapes} | ${runRatioValue}x\n`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;

        iterationCallback(singleRunData);
      });
    });
  }

  function runAverageLoop() {
    if (accumulatedData.runCount < numRuns && !abortRequested) {
      const currentRunProgress = Math.round((accumulatedData.runCount / numRuns) * 100);
      currentTestProgressBar.style.width = currentRunProgress + '%';
      currentTestProgressBar.textContent = currentRunProgress + '%';
      if (currentRunProgress > 0) {
        currentTestProgressBar.style.color = 'white';
      } else {
        currentTestProgressBar.style.color = '#333';
      }

      runSingleIteration(() => {
        if (!abortRequested) {
          setTimeout(runAverageLoop, 50);
        } else {
          finalizeTest(null);
        }
      });
    } else {
      finalizeTest(accumulatedData);
    }
  }

  function finalizeTest(finalAccumulatedData) {
    if (abortRequested && !finalAccumulatedData) {
      resultsContainer.innerHTML += "\nTest aborted during averaging runs.\n";
      resultsContainer.scrollTop = resultsContainer.scrollHeight;
      hideAllCanvases();
      resetTestState();
      if (callback) callback(null);
      return;
    }

    const avgSwMaxShapes = finalAccumulatedData.swMaxShapesTotal / finalAccumulatedData.runCount;
    const avgCanvasMaxShapes = finalAccumulatedData.canvasMaxShapesTotal / finalAccumulatedData.runCount;
    const avgRatio = avgCanvasMaxShapes / avgSwMaxShapes;

    const finalResultsData = {
      testType: testType,
      testPerfName: testPerfName,
      precision,
      growthFactor,
      swStartCount,
      htmlStartCount,
      includeBlitting,
      isQuietMode,
      numRuns: finalAccumulatedData.runCount,
      swMaxShapes: avgSwMaxShapes,
      canvasMaxShapes: avgCanvasMaxShapes,
      ratio: avgRatio,
      swShapeCounts: lastSingleRunData ? lastSingleRunData.swShapeCounts : [],
      swTimings: lastSingleRunData ? lastSingleRunData.swTimings : [],
      canvasShapeCounts: lastSingleRunData ? lastSingleRunData.canvasShapeCounts : [],
      canvasTimings: lastSingleRunData ? lastSingleRunData.canvasTimings : [],
      individualRatios: finalAccumulatedData.individualRatios
    };

    hideAllCanvases();
    displayRampTestResults(finalResultsData);
    generatePerformanceChart(finalResultsData);

    currentTestProgressBar.style.width = '100%';
    currentTestProgressBar.textContent = '100%';
    currentTestProgressBar.style.color = 'white';

    setTimeout(() => {
      currentTestProgressContainer.style.display = 'none';
    }, 1000);

    if (!callback) {
      resetTestState();
    }

    if (callback) callback(finalResultsData);
  }

  runAverageLoop();
}

// Initialize UI when script loads
initializeUI();
